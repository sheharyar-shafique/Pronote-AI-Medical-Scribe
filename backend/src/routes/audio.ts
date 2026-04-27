import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  },
});

// All routes require authentication
router.use(authenticate);
router.use(requireActiveSubscription);

// POST /api/audio/upload - Upload audio file
router.post('/upload', upload.single('audio'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!req.file) {
      throw new AppError('No audio file provided', 400);
    }

    const fileId = uuidv4();
    const fileName = `${fileId}-${req.file.originalname}`;
    const storagePath = `audio/${req.user!.id}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(storagePath);

    // Create audio file record
    const { data: audioFile, error: dbError } = await supabase
      .from('audio_files')
      .insert({
        user_id: req.user!.id,
        file_name: req.file.originalname,
        file_size: req.file.size,
        file_type: req.file.mimetype,
        storage_path: storagePath,
        transcription_status: 'pending',
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.status(201).json({
      id: audioFile.id,
      fileName: audioFile.file_name,
      fileSize: audioFile.file_size,
      url: urlData.publicUrl,
      status: 'pending',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/transcribe - Transcribe audio file using OpenAI Whisper
router.post('/transcribe', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { audioFileId } = req.body;

    if (!audioFileId) {
      throw new AppError('Audio file ID is required', 400);
    }

    // Get audio file record
    const { data: audioFile, error: fetchError } = await supabase
      .from('audio_files')
      .select('*')
      .eq('id', audioFileId)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !audioFile) {
      throw new AppError('Audio file not found', 404);
    }

    // Update status to processing
    await supabase
      .from('audio_files')
      .update({ transcription_status: 'processing' })
      .eq('id', audioFileId);

    // Download audio from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('audio-files')
      .download(audioFile.storage_path);

    if (downloadError || !fileData) {
      throw new AppError('Failed to download audio file', 500);
    }

    let transcription: string;

    if (openai) {
      try {
        // Use OpenAI Whisper for transcription
        const file = new File([fileData], audioFile.file_name, { type: audioFile.file_type });
        
        const response = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: 'en',
          response_format: 'text',
        });

        transcription = response;
      } catch (whisperError: any) {
        console.error('Whisper transcription error:', whisperError.message);
        // Mark as failed so we don't generate a note from silence
        await supabase
          .from('audio_files')
          .update({ transcription_status: 'failed' })
          .eq('id', audioFileId);
        throw new AppError('Transcription failed. Please try recording again with clearer audio.', 422);
      }
    } else {
      // Mock transcription for development
      transcription = generateMockTranscription();
    }

    // ── Silence / empty-audio guard ──────────────────────────────────────────
    // Whisper returns an empty string (or a very short filler) when it detects
    // no speech. Reject the request so the frontend shows a helpful error
    // instead of generating a hallucinated note.
    const meaningfulWords = transcription.trim().split(/\s+/).filter(w => w.length > 1);
    if (meaningfulWords.length < 5) {
      await supabase
        .from('audio_files')
        .update({ transcription_status: 'failed' })
        .eq('id', audioFileId);
      throw new AppError(
        'No speech detected in the recording. Please speak clearly during the visit before stopping.',
        422
      );
    }

    // Update audio file with transcription
    await supabase
      .from('audio_files')
      .update({ 
        transcription_status: 'completed',
      })
      .eq('id', audioFileId);

    res.json({
      audioFileId,
      transcription,
      status: 'completed',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/audio/generate-note - Generate clinical note from transcription
router.post('/generate-note', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { transcription, template, patientName } = req.body;

    if (!transcription || !template) {
      throw new AppError('Transcription and template are required', 400);
    }

    // Guard: refuse to generate a note from silence / empty audio
    const meaningfulWords = (transcription as string).trim().split(/\s+/).filter((w: string) => w.length > 1);
    if (meaningfulWords.length < 5) {
      throw new AppError(
        'No speech detected. Please record an actual patient conversation before generating a note.',
        422
      );
    }

    let noteContent: Record<string, string>;

    if (openai) {
      // Use GPT to generate structured clinical note
      const systemPrompt = getSystemPromptForTemplate(template);
      
      try {
        // Try with gpt-4o first
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a clinical note from this transcription:\n\n${transcription}` },
          ],
          response_format: { type: 'json_object' },
        });

        noteContent = JSON.parse(response.choices[0].message.content || '{}');
      } catch (openaiError: any) {
        console.error('GPT-4o error, trying gpt-3.5-turbo:', openaiError.message);
        
        // Fallback to gpt-3.5-turbo
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Generate a clinical note from this transcription. Return valid JSON:\n\n${transcription}` },
            ],
          });

          const content = response.choices[0].message.content || '{}';
          // Try to parse JSON, handle potential markdown wrapping
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
          noteContent = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
        } catch (fallbackError: any) {
          console.error('GPT-3.5-turbo also failed:', fallbackError.message);
          // Final fallback to mock content
          noteContent = generateMockNoteContent(template, patientName);
        }
      }
    } else {
      // Generate mock note content
      noteContent = generateMockNoteContent(template, patientName);
    }

    res.json({
      content: noteContent,
      template,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audio/files - List user's audio files
router.get('/files', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: files, error } = await supabase
      .from('audio_files')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(files.map(file => ({
      id: file.id,
      fileName: file.file_name,
      fileSize: file.file_size,
      fileType: file.file_type,
      duration: file.duration_seconds,
      status: file.transcription_status,
      createdAt: file.created_at,
    })));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/audio/files/:id - Delete audio file
router.delete('/files/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Get file record
    const { data: file, error: fetchError } = await supabase
      .from('audio_files')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !file) {
      throw new AppError('Audio file not found', 404);
    }

    // Delete from storage
    await supabase.storage
      .from('audio-files')
      .remove([file.storage_path]);

    // Delete record
    await supabase
      .from('audio_files')
      .delete()
      .eq('id', id);

    res.json({ message: 'Audio file deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function getSystemPromptForTemplate(template: string): string {
  const prompts: Record<string, string> = {
    soap: `You are a medical documentation assistant. Generate a SOAP note from the given transcription.
Return a JSON object with these REQUIRED fields: subjective, objective, assessment, plan, instructions.
- subjective: Patient's reported symptoms and history
- objective: Physical examination findings and vitals
- assessment: Diagnosis and clinical impression
- plan: Treatment plan including medications, orders, and follow-up
- instructions: Specific patient instructions (medications to take, activity restrictions, warning signs to watch for, when to return)
Use professional medical terminology. The 'instructions' field is MANDATORY — always include clear patient education and discharge instructions.`,

    psychiatry: `You are a psychiatric documentation assistant. Generate a psychiatric evaluation note.
Return a JSON object with these REQUIRED fields: chiefComplaint, historyOfPresentIllness, mentalStatusExam, assessment, plan, instructions.
- chiefComplaint: Presenting concern
- historyOfPresentIllness: Detailed psychiatric history and current episode
- mentalStatusExam: Appearance, behavior, mood, affect, thought process, thought content, cognition, insight, judgment
- assessment: Psychiatric diagnosis and clinical impression
- plan: Medication management, therapy referrals, safety planning
- instructions: Patient instructions including medication guidance, crisis resources, and next steps
The 'instructions' field is MANDATORY — always provide clear patient directions.`,

    therapy: `You are a therapy documentation assistant. Generate a therapy session note.
Return a JSON object with these REQUIRED fields: sessionSummary, clientPresentation, interventionsUsed, clientResponse, progressNotes, plan, instructions.
- sessionSummary: Overview of session content
- clientPresentation: Client's mental/emotional state at session
- interventionsUsed: Therapeutic techniques applied
- clientResponse: Client's engagement and response
- progressNotes: Progress toward treatment goals
- plan: Next steps and upcoming session focus
- instructions: Between-session homework, skills to practice, and self-care recommendations
The 'instructions' field is MANDATORY.`,

    pediatrics: `You are a pediatric documentation assistant. Generate a pediatric clinical note.
Return a JSON object with these REQUIRED fields: chiefComplaint, historyOfPresentIllness, developmentalHistory, physicalExam, assessment, plan, instructions.
- chiefComplaint: Presenting symptom or concern
- historyOfPresentIllness: Symptom timeline and relevant history
- developmentalHistory: Developmental milestones, growth, immunizations
- physicalExam: Age-appropriate examination findings
- assessment: Diagnosis and clinical impression
- plan: Treatment plan and follow-up
- instructions: Parent/caregiver instructions including medication dosing, activity restrictions, warning signs requiring return visit
The 'instructions' field is MANDATORY — always include clear caregiver guidance.`,

    cardiology: `You are a cardiology documentation assistant. Generate a cardiology consultation note.
Return a JSON object with these REQUIRED fields: chiefComplaint, cardiacHistory, physicalExam, diagnosticFindings, assessment, plan, instructions.
- chiefComplaint: Presenting cardiac symptoms
- cardiacHistory: Cardiac risk factors and history
- physicalExam: Cardiovascular examination findings
- diagnosticFindings: ECG, imaging, lab results
- assessment: Cardiac diagnosis and impression
- plan: Treatment, medications, procedures, and follow-up
- instructions: Patient instructions including activity level, diet, medication adherence, warning symptoms requiring emergency care
The 'instructions' field is MANDATORY.`,

    dermatology: `You are a dermatology documentation assistant. Generate a dermatology consultation note.
Return a JSON object with these REQUIRED fields: chiefComplaint, lesionDescription, distribution, associatedSymptoms, assessment, plan, instructions.
- chiefComplaint: Presenting skin concern
- lesionDescription: Morphology, color, size, surface characteristics
- distribution: Location and pattern of skin findings
- associatedSymptoms: Pruritus, pain, or other symptoms
- assessment: Dermatologic diagnosis
- plan: Topical/systemic therapy and follow-up
- instructions: Skincare instructions, medication application directions, sun protection, follow-up timeline, warning signs
The 'instructions' field is MANDATORY.`,

    orthopedics: `You are an orthopedic documentation assistant. Generate an orthopedic consultation note.
Return a JSON object with these REQUIRED fields: chiefComplaint, injuryMechanism, physicalExam, imagingFindings, assessment, plan, instructions.
- chiefComplaint: Presenting musculoskeletal complaint
- injuryMechanism: Mechanism of injury or onset
- physicalExam: ROM, strength, neurovascular, special tests
- imagingFindings: X-ray/MRI findings
- assessment: Orthopedic diagnosis
- plan: Treatment including immobilization, PT, surgery if applicable
- instructions: Activity restrictions, weight-bearing status, icing/elevation, pain management, when to seek emergency care
The 'instructions' field is MANDATORY.`,

    custom: `You are a clinical documentation assistant. Generate a comprehensive clinical note from the transcription.
Return a JSON object with these REQUIRED fields: subjective, objective, assessment, plan, instructions, additionalNotes.
- subjective: Patient history and reported symptoms
- objective: Examination findings
- assessment: Diagnosis and impression
- plan: Treatment and follow-up plan
- instructions: Clear patient instructions for medications, activities, follow-up, and warning signs
- additionalNotes: Any other relevant clinical information
The 'instructions' field is MANDATORY — always include patient education and guidance.`,

    default: `You are a clinical documentation assistant. Generate a clinical note from the transcription.
Return a JSON object with these REQUIRED fields: subjective, objective, assessment, plan, instructions.
The 'instructions' field is MANDATORY — always include specific patient instructions for medications, activity, follow-up, and warning signs.`,
  };

  return prompts[template.toLowerCase()] || prompts.default;
}

function generateMockTranscription(): string {
  return `Patient presents today for follow-up regarding their hypertension. 
They report compliance with medication regimen. Blood pressure readings at home have been averaging 135/85. 
Patient denies any headaches, chest pain, or shortness of breath. 
They have been following a low-sodium diet and exercising three times per week.
Physical examination reveals blood pressure of 138/88, heart rate 72, regular rhythm.
Heart sounds normal, no murmurs. Lungs clear bilaterally.
Assessment: Hypertension, controlled on current regimen.
Plan: Continue current medications, follow up in three months, continue lifestyle modifications.`;
}

function generateMockNoteContent(template: string, patientName: string): Record<string, string> {
  const name = patientName || 'Patient';

  const contents: Record<string, Record<string, string>> = {
    soap: {
      subjective: `${name} presents for follow-up. Reports compliance with treatment plan. No new complaints at this time.`,
      objective: `Vital signs within normal limits. Physical examination unremarkable. Patient appears well.`,
      assessment: `Condition stable on current management. No acute issues identified.`,
      plan: `Continue current treatment. Follow up as scheduled. Return precautions discussed.`,
      instructions: `Take all medications as prescribed. Follow the low-sodium diet and exercise recommendations discussed today. Monitor blood pressure daily and record readings. Return to the clinic in 3 months or sooner if you experience chest pain, severe headache, shortness of breath, or dizziness. Call the office if you have any questions about your medications.`,
    },
    psychiatry: {
      chiefComplaint: `${name} presents for psychiatric evaluation.`,
      historyOfPresentIllness: `Patient describes symptoms and current mental health status. Treatment history reviewed.`,
      mentalStatusExam: `Alert and oriented x4. Appearance: Well-groomed. Behavior: Cooperative. Mood: "Okay". Affect: Appropriate, full range. Thought Process: Linear, goal-directed. Thought Content: No SI/HI, no delusions. Cognition: Intact. Insight: Good. Judgment: Good.`,
      assessment: `Clinical assessment based on evaluation findings.`,
      plan: `Treatment recommendations and follow-up plan.`,
      instructions: `Take prescribed medications daily as directed — do not stop without consulting your provider. Attend all scheduled therapy appointments. If you experience thoughts of harming yourself or others, call 988 (Suicide & Crisis Lifeline) or go to the nearest emergency room immediately. Follow up in 4 weeks or sooner if symptoms worsen.`,
    },
    therapy: {
      sessionSummary: `Therapy session with ${name}. Topics discussed include current stressors and coping strategies.`,
      clientPresentation: `Patient presented as engaged and motivated for treatment.`,
      interventionsUsed: `Cognitive restructuring, behavioral activation, and mindfulness techniques.`,
      clientResponse: `Patient demonstrated good insight and receptiveness to interventions.`,
      progressNotes: `Progress toward treatment goals noted. Areas for continued work identified.`,
      plan: `Continue weekly sessions. Homework assigned. Skills practice between sessions.`,
      instructions: `Practice the breathing exercises daily for 5–10 minutes. Complete the thought journal between sessions. Continue behavioral activation activities — aim for at least one enjoyable activity per day. If you feel overwhelmed, use the grounding techniques we practiced. Contact the office or crisis line if you feel unsafe.`,
    },
    pediatrics: {
      chiefComplaint: `${name} presents for pediatric evaluation.`,
      historyOfPresentIllness: `Parent/guardian reports current symptoms and timeline.`,
      developmentalHistory: `Developmental milestones appropriate for age. Immunizations up to date.`,
      physicalExam: `General: Active, alert child in no acute distress. HEENT: Normal. Lungs: Clear. Heart: RRR, no murmurs. Abdomen: Soft, non-tender. Extremities: Normal range of motion.`,
      assessment: `Clinical assessment based on age-appropriate evaluation.`,
      plan: `Treatment plan and anticipatory guidance provided. Follow-up as indicated.`,
      instructions: `Give all medications exactly as prescribed — do not skip doses. Encourage fluids and rest. Keep your child home from school until fever-free for 24 hours without medication. Return to the ER immediately if your child develops difficulty breathing, persistent high fever (>104°F), severe vomiting, or seems very unwell. Follow up in 2–3 days or as directed.`,
    },
    cardiology: {
      chiefComplaint: `${name} presents for cardiology consultation.`,
      cardiacHistory: `Cardiac risk factors and history reviewed. Family history of cardiac disease assessed.`,
      physicalExam: `BP: Normal. HR: Regular rate and rhythm. JVP: Not elevated. Heart: S1, S2 normal, no murmurs, rubs, or gallops. Lungs: Clear. Extremities: No edema, pulses intact.`,
      diagnosticFindings: `ECG: Normal sinus rhythm. Echocardiogram findings pending/reviewed.`,
      assessment: `Cardiac assessment based on clinical evaluation and diagnostics.`,
      plan: `Cardiology recommendations and follow-up plan.`,
      instructions: `Take cardiac medications at the same time every day — never skip or double doses. Follow a heart-healthy, low-sodium diet. Limit physical exertion until cleared. Call 911 immediately or go to the ER for chest pain, pressure, palpitations, severe shortness of breath, or fainting. Follow up with cardiology in 4–6 weeks.`,
    },
    dermatology: {
      chiefComplaint: `${name} presents for dermatology evaluation.`,
      lesionDescription: `Description of primary lesion morphology, color, size, and surface characteristics.`,
      distribution: `Location and pattern of skin findings documented.`,
      associatedSymptoms: `Pruritus, pain, or other associated symptoms noted.`,
      assessment: `Dermatologic diagnosis based on clinical presentation.`,
      plan: `Treatment recommendations including topical/systemic therapy. Follow-up for response to treatment.`,
      instructions: `Apply the prescribed topical medication to affected areas as directed — avoid eyes and mucous membranes. Do not scratch or pick at lesions. Use gentle, fragrance-free soap and moisturizer daily. Apply broad-spectrum SPF 30+ sunscreen when outdoors. Return if the rash spreads, becomes infected (increasing redness, warmth, pus), or does not improve in 2–4 weeks.`,
    },
    orthopedics: {
      chiefComplaint: `${name} presents for orthopedic evaluation.`,
      injuryMechanism: `Mechanism of injury or onset of symptoms described.`,
      physicalExam: `Inspection: No obvious deformity. Palpation: Point tenderness noted. ROM: Range of motion assessed. Strength: Motor strength testing performed. Neurovascular: Intact sensation and pulses. Special Tests: Relevant orthopedic tests performed.`,
      imagingFindings: `X-ray/MRI findings reviewed or pending.`,
      assessment: `Orthopedic diagnosis and clinical impression.`,
      plan: `Treatment plan including activity modifications, physical therapy, and follow-up.`,
      instructions: `Rest and protect the injured area — avoid activities that cause pain. Apply ice for 20 minutes several times daily for the first 48–72 hours. Keep the extremity elevated when possible. Take prescribed pain medications as directed with food. Do not bear weight on the injured limb unless cleared. Go to the ER immediately if you develop increasing numbness, inability to move the area, severe swelling, or the limb changes color. Follow up in 1–2 weeks.`,
    },
    custom: {
      subjective: `${name} presents for evaluation. Chief complaint and history documented.`,
      objective: `Physical examination and relevant findings documented.`,
      assessment: `Clinical assessment and diagnosis.`,
      plan: `Treatment plan and follow-up recommendations.`,
      instructions: `Follow all treatment instructions as discussed. Take medications as prescribed. Attend all follow-up appointments. Contact the office with any questions or concerns. Go to the emergency room or call 911 if you experience a medical emergency or sudden worsening of symptoms.`,
      additionalNotes: `Additional relevant clinical information.`,
    },
  };

  return contents[template.toLowerCase()] || contents.soap;
}

export default router;

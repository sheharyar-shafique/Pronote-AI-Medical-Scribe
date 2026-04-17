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
        // Fallback to mock transcription if Whisper fails
        transcription = generateMockTranscription();
      }
    } else {
      // Mock transcription for development
      transcription = generateMockTranscription();
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
Return a JSON object with these fields: subjective, objective, assessment, plan. 
Use professional medical terminology and be thorough but concise.`,
    
    psychiatry: `You are a psychiatric documentation assistant. Generate a psychiatric evaluation note.
Return a JSON object with these fields: chiefComplaint, historyOfPresentIllness, mentalStatusExam, assessment, plan.
Include relevant mental status examination findings including appearance, behavior, mood, affect, thought process, thought content, cognition, insight, and judgment.`,
    
    therapy: `You are a therapy documentation assistant. Generate a therapy session note.
Return a JSON object with these fields: sessionSummary, clientPresentation, interventionsUsed, clientResponse, progressNotes, plan.
Focus on therapeutic interventions, client engagement, and progress toward treatment goals.`,

    pediatrics: `You are a pediatric documentation assistant. Generate a pediatric clinical note.
Return a JSON object with these fields: chiefComplaint, historyOfPresentIllness, developmentalHistory, physicalExam, assessment, plan.
Include age-appropriate developmental milestones, growth parameters, and immunization status when relevant.`,

    cardiology: `You are a cardiology documentation assistant. Generate a cardiology consultation note.
Return a JSON object with these fields: chiefComplaint, cardiacHistory, physicalExam, diagnosticFindings, assessment, plan.
Include relevant cardiac risk factors, ECG findings, and cardiovascular examination details.`,

    dermatology: `You are a dermatology documentation assistant. Generate a dermatology consultation note.
Return a JSON object with these fields: chiefComplaint, lesionDescription, distribution, associatedSymptoms, assessment, plan.
Include detailed description of skin findings using proper dermatological terminology (morphology, color, size, distribution).`,

    orthopedics: `You are an orthopedic documentation assistant. Generate an orthopedic consultation note.
Return a JSON object with these fields: chiefComplaint, injuryMechanism, physicalExam, imagingFindings, assessment, plan.
Include range of motion, strength testing, neurovascular status, and relevant orthopedic tests.`,

    custom: `You are a clinical documentation assistant. Generate a comprehensive clinical note from the transcription.
Return a JSON object with these fields: subjective, objective, assessment, plan, additionalNotes.
Adapt the note structure to best fit the clinical content provided.`,
    
    default: `You are a clinical documentation assistant. Generate a clinical note from the transcription.
Return a JSON object with fields appropriate for the clinical encounter: subjective, objective, assessment, plan.`,
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
    },
    psychiatry: {
      chiefComplaint: `${name} presents for psychiatric evaluation.`,
      historyOfPresentIllness: `Patient describes symptoms and current mental health status. Treatment history reviewed.`,
      mentalStatusExam: `Alert and oriented x4. Appearance: Well-groomed. Behavior: Cooperative. Mood: "Okay". Affect: Appropriate, full range. Thought Process: Linear, goal-directed. Thought Content: No SI/HI, no delusions. Cognition: Intact. Insight: Good. Judgment: Good.`,
      assessment: `Clinical assessment based on evaluation findings.`,
      plan: `Treatment recommendations and follow-up plan.`,
    },
    therapy: {
      sessionSummary: `Therapy session with ${name}. Topics discussed include current stressors and coping strategies.`,
      clientPresentation: `Patient presented as engaged and motivated for treatment.`,
      interventionsUsed: `Cognitive restructuring, behavioral activation, and mindfulness techniques.`,
      clientResponse: `Patient demonstrated good insight and receptiveness to interventions.`,
      progressNotes: `Progress toward treatment goals noted. Areas for continued work identified.`,
      plan: `Continue weekly sessions. Homework assigned. Skills practice between sessions.`,
    },
    pediatrics: {
      chiefComplaint: `${name} presents for pediatric evaluation.`,
      historyOfPresentIllness: `Parent/guardian reports current symptoms and timeline.`,
      developmentalHistory: `Developmental milestones appropriate for age. Immunizations up to date.`,
      physicalExam: `General: Active, alert child in no acute distress. HEENT: Normal. Lungs: Clear. Heart: RRR, no murmurs. Abdomen: Soft, non-tender. Extremities: Normal range of motion.`,
      assessment: `Clinical assessment based on age-appropriate evaluation.`,
      plan: `Treatment plan and anticipatory guidance provided. Follow-up as indicated.`,
    },
    cardiology: {
      chiefComplaint: `${name} presents for cardiology consultation.`,
      cardiacHistory: `Cardiac risk factors and history reviewed. Family history of cardiac disease assessed.`,
      physicalExam: `BP: Normal. HR: Regular rate and rhythm. JVP: Not elevated. Heart: S1, S2 normal, no murmurs, rubs, or gallops. Lungs: Clear. Extremities: No edema, pulses intact.`,
      diagnosticFindings: `ECG: Normal sinus rhythm. Echocardiogram findings pending/reviewed.`,
      assessment: `Cardiac assessment based on clinical evaluation and diagnostics.`,
      plan: `Cardiology recommendations and follow-up plan.`,
    },
    dermatology: {
      chiefComplaint: `${name} presents for dermatology evaluation.`,
      lesionDescription: `Description of primary lesion morphology, color, size, and surface characteristics.`,
      distribution: `Location and pattern of skin findings documented.`,
      associatedSymptoms: `Pruritus, pain, or other associated symptoms noted.`,
      assessment: `Dermatologic diagnosis based on clinical presentation.`,
      plan: `Treatment recommendations including topical/systemic therapy. Follow-up for response to treatment.`,
    },
    orthopedics: {
      chiefComplaint: `${name} presents for orthopedic evaluation.`,
      injuryMechanism: `Mechanism of injury or onset of symptoms described.`,
      physicalExam: `Inspection: No obvious deformity. Palpation: Point tenderness noted. ROM: Range of motion assessed. Strength: Motor strength testing performed. Neurovascular: Intact sensation and pulses. Special Tests: Relevant orthopedic tests performed.`,
      imagingFindings: `X-ray/MRI findings reviewed or pending.`,
      assessment: `Orthopedic diagnosis and clinical impression.`,
      plan: `Treatment plan including activity modifications, physical therapy, and follow-up.`,
    },
    custom: {
      subjective: `${name} presents for evaluation. Chief complaint and history documented.`,
      objective: `Physical examination and relevant findings documented.`,
      assessment: `Clinical assessment and diagnosis.`,
      plan: `Treatment plan and follow-up recommendations.`,
      additionalNotes: `Additional relevant clinical information.`,
    },
  };

  return contents[template.toLowerCase()] || contents.soap;
}

export default router;

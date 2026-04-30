import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { toFile } from 'openai';
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
        // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm").
        // Whisper sniffs the binary container; the codec hint can confuse multipart parsing.
        const cleanType = (audioFile.file_type || 'audio/webm').split(';')[0].trim();

        // Whisper rejects requests with "Invalid file format" when the multipart filename
        // doesn't end in a recognized extension. Force one based on the MIME type.
        const extFromType: Record<string, string> = {
          'audio/webm': 'webm',
          'audio/mp4': 'mp4',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/wav': 'wav',
          'audio/x-wav': 'wav',
          'audio/ogg': 'ogg',
          'audio/m4a': 'm4a',
          'audio/x-m4a': 'm4a',
        };
        const knownExts = ['mp3', 'mp4', 'm4a', 'wav', 'webm', 'ogg', 'flac', 'mpeg', 'mpga', 'oga'];
        const lowerName = (audioFile.file_name || '').toLowerCase();
        const hasGoodExt = knownExts.some(e => lowerName.endsWith('.' + e));
        const fileName = hasGoodExt
          ? audioFile.file_name
          : `recording.${extFromType[cleanType] || 'webm'}`;

        // The OpenAI SDK's `toFile` helper builds a Uploadable that reliably forwards
        // the filename and content-type into the multipart request. `new File([blob], …)`
        // didn't always preserve the filename in Node, which is why Whisper kept rejecting
        // the upload as "Invalid file format" even when the bytes were valid webm.
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const uploadable = await toFile(buffer, fileName, { type: cleanType });

        const response = await openai.audio.transcriptions.create({
          file: uploadable,
          model: 'whisper-1',
          language: 'en',
          response_format: 'text',
        });

        transcription = response;
      } catch (whisperError: any) {
        console.error('Whisper transcription error:', whisperError?.message, whisperError?.status, whisperError?.error);
        await supabase
          .from('audio_files')
          .update({ transcription_status: 'failed' })
          .eq('id', audioFileId);

        // Surface the real Whisper error to the client so failures are diagnosable
        // instead of always reading "try again with clearer audio."
        const detail =
          whisperError?.error?.message ||
          whisperError?.message ||
          'unknown error';
        throw new AppError(`Transcription failed: ${detail}`, 422);
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
    const { transcription, template, patientName, sectionSettings } = req.body;

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
    let source: 'ai' | 'mock' = 'ai';

    if (openai) {
      // ── Real AI path ──────────────────────────────────────────────────────
      // Use dynamic prompt if sectionSettings provided, otherwise use template-based prompt
      const systemPrompt = sectionSettings && sectionSettings.length > 0
        ? buildDynamicPrompt(sectionSettings)
        : getSystemPromptForTemplate(template);
      const userMessage = `Generate a clinical note from this transcription:\n\n${transcription}`;

      let lastError: Error | null = null;

      // Try GPT-4o first
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });
        noteContent = JSON.parse(response.choices[0].message.content || '{}');
        console.log(`✅ GPT-4o note generated for template: ${template}`);
      } catch (gpt4oError: any) {
        console.error('GPT-4o failed, trying gpt-4o-mini:', gpt4oError.message);
        lastError = gpt4oError;

        // Fallback to gpt-4o-mini
        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage + ' Return valid JSON only.' },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          });
          const raw = response.choices[0].message.content || '{}';
          noteContent = JSON.parse(raw);
          console.log(`✅ GPT-4o-mini note generated for template: ${template}`);
          lastError = null;
        } catch (miniError: any) {
          console.error('GPT-4o-mini also failed:', miniError.message);
          lastError = miniError;

          // Last resort: gpt-3.5-turbo (no json_object mode — parse manually)
          try {
            const response = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage + ' Return ONLY valid JSON, no markdown.' },
              ],
              temperature: 0.3,
            });
            const raw = response.choices[0].message.content || '{}';
            const match = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/);
            noteContent = JSON.parse(match ? (match[1] || match[0]) : raw);
            console.log(`✅ GPT-3.5-turbo note generated for template: ${template}`);
            lastError = null;
          } catch (gpt35Error: any) {
            console.error('All GPT models failed:', gpt35Error.message);
            lastError = gpt35Error;
          }
        }
      }

      // If ALL models failed — throw a proper error. Do NOT silently use mock.
      if (lastError) {
        const msg = (lastError as any).status === 429
          ? 'AI service rate limit reached. Please wait a moment and try again.'
          : (lastError as any).status === 401
          ? 'AI service authentication error — please contact support.'
          : 'AI note generation failed. Please try again.';
        throw new AppError(msg, 503);
      }
    } else {
      // ── Development / no API key ──────────────────────────────────────────
      // Only use mock data when no OpenAI key is configured (local dev)
      console.warn('⚠️  No OpenAI key — returning mock note content (dev mode)');
      noteContent = generateMockNoteContent(template, patientName);
      source = 'mock';
    }

    res.json({
      content: noteContent!,
      template,
      source, // 'ai' = real GPT output, 'mock' = dev placeholder
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

/**
 * Build a dynamic AI system prompt from user-configured section settings.
 * Called when a custom template with sectionSettings is used.
 */
interface SectionSetting {
  title: string;
  verbosity: 'concise' | 'detailed';
  styling: 'paragraph' | 'bullet';
  content: string;
  stylingInstructions: string;
}

function buildDynamicPrompt(settings: SectionSetting[]): string {
  // Map section titles to JSON-safe camelCase keys
  const sectionKeyMap: Record<string, string> = {
    'Subjective': 'subjective',
    'Objective': 'objective',
    'Assessment': 'assessment',
    'Plan': 'plan',
    'Patient Instructions': 'instructions',
    'Instructions': 'instructions',
    'Chief Complaint': 'chiefComplaint',
    'History of Present Illness': 'historyOfPresentIllness',
    'HPI': 'historyOfPresentIllness',
    'Review of Systems': 'reviewOfSystems',
    'Physical Exam': 'physicalExam',
    'Mental Status Exam': 'physicalExam',
    'Medical Decision Making': 'medicalDecisionMaking',
    'Follow-Up': 'followUp',
  };

  const getKey = (title: string): string => {
    return sectionKeyMap[title] || title.replace(/[^a-zA-Z0-9]/g, '').replace(/^(.)/, (_, c) => c.toLowerCase());
  };

  // Build per-section instructions
  const sectionInstructions = settings.map(s => {
    const key = getKey(s.title);
    const verbosityHint = s.verbosity === 'concise'
      ? 'Keep this section concise — 2-3 focused sentences maximum.'
      : 'Be thorough and detailed in this section — provide at minimum 4-6 sentences with comprehensive clinical information.';
    const stylingHint = s.styling === 'bullet'
      ? 'Format this section as bullet points (use "• " prefix for each point).'
      : 'Format this section as flowing narrative paragraphs.';
    const contentHint = s.content
      ? `Content guidance: ${s.content}`
      : '';
    const customHint = s.stylingInstructions
      ? `Additional instructions: ${s.stylingInstructions}`
      : '';

    return `- "${key}" (section title: "${s.title}"):
  ${verbosityHint}
  ${stylingHint}
  ${contentHint}
  ${customHint}`.trim();
  }).join('\n\n');

  // Build the JSON schema example
  const jsonKeys = settings.map(s => `  "${getKey(s.title)}": "..."`).join(',\n');

  // Always include instructions
  const hasInstructions = settings.some(s =>
    s.title.toLowerCase().includes('instruction') || getKey(s.title) === 'instructions'
  );
  const instructionsNote = hasInstructions
    ? ''
    : `\n- "instructions": Always include a comprehensive patient instructions section with medications, activity level, warning signs, and follow-up timeline. Format as bullet points.`;

  return `You are an expert medical documentation assistant specializing in thorough clinical documentation.
Generate a comprehensive clinical note from the given patient-clinician transcription.

Return a JSON object with EXACTLY these fields:
{
${jsonKeys}${hasInstructions ? '' : ',\n  "instructions": "..."'}
}

SECTION-SPECIFIC FORMATTING REQUIREMENTS:

${sectionInstructions}
${instructionsNote}

IMPORTANT RULES:
- Return ONLY valid JSON. Do NOT wrap in markdown code blocks.
- Use proper medical terminology throughout.
- Every section MUST contain real clinical content derived from the transcription.
- If the transcription doesn't mention something for a section, write reasonable clinical defaults or note "Not discussed during this encounter."
- The output MUST respect the formatting preferences specified above (bullet vs paragraph, concise vs detailed).`;
}

function getSystemPromptForTemplate(template: string): string {
  const DETAIL_INSTRUCTION = `
IMPORTANT RULES FOR ALL SECTIONS:
- Each section must be THOROUGH and DETAILED — at minimum 3-5 sentences per section, more if the transcription warrants it.
- Never abbreviate or summarize too briefly. Expand on every detail mentioned in the transcription.
- Use proper medical terminology throughout.
- If the transcription mentions a symptom, describe onset, duration, severity, aggravating/alleviating factors, and associated symptoms.
- Physical exam findings should include all systems examined, not just abnormals.
- The "instructions" field is MANDATORY and must ALWAYS be included. It should contain:
  1. Medications prescribed with dosage, frequency, and duration
  2. Activity restrictions or modifications
  3. Diet or lifestyle recommendations
  4. Warning signs that require immediate medical attention
  5. Follow-up appointment timing
  6. Any referrals given
- Return ONLY valid JSON. Do NOT wrap in markdown code blocks.
`;

  const prompts: Record<string, string> = {
    soap: `You are an expert medical documentation assistant specializing in thorough clinical documentation.
Generate a comprehensive SOAP note from the given patient-clinician transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": DETAILED patient history — include chief complaint, HPI (onset, location, duration, character, aggravating/alleviating factors, radiation, timing, severity), past medical/surgical history, medications, allergies, family history, social history, and review of systems. Must be thorough.
- "objective": COMPLETE physical examination — include vitals (BP, HR, RR, Temp, SpO2, weight), general appearance, and ALL body systems examined (HEENT, neck, cardiovascular, respiratory, abdomen, extremities, neurological, skin). Document both normal and abnormal findings.
- "assessment": Clinical impression with ICD-10 codes when possible. List all diagnoses (primary and secondary). Include clinical reasoning.
- "plan": Detailed management — medications with dosing, diagnostic workup ordered, referrals, patient education provided, disposition, and follow-up timeline.
- "instructions": MANDATORY comprehensive patient instructions — medications to take and how, activity level, diet, warning signs requiring emergency care, when to return, and any home care instructions.
${DETAIL_INSTRUCTION}`,

    psychiatry: `You are an expert psychiatric documentation assistant.
Generate a thorough psychiatric evaluation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": The presenting psychiatric concern in the patient's own words.
- "historyOfPresentIllness": Detailed psychiatric history — current episode (onset, duration, precipitants, symptom progression), past psychiatric history, hospitalizations, suicide attempts, medication trials, substance use history, trauma history.
- "physicalExam": Full Mental Status Exam — appearance, behavior, psychomotor activity, speech, mood (patient-stated), affect (observed), thought process, thought content (delusions, suicidal/homicidal ideation, hallucinations), cognition (orientation, memory, concentration), insight, and judgment.
- "assessment": Psychiatric diagnoses with DSM-5 criteria met, risk assessment (suicide, homicide, self-harm), and functional impairment level.
- "plan": Medication management with specific drugs/doses/changes, therapy type and frequency, safety plan, crisis resources, lab work, and follow-up schedule.
- "instructions": MANDATORY — medication instructions, crisis hotline numbers, safety plan steps, therapy homework, sleep hygiene, and when to seek emergency help.
${DETAIL_INSTRUCTION}`,

    therapy: `You are an expert therapy documentation assistant.
Generate a detailed therapy session note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": Client's self-report — presenting concerns for this session, mood since last visit, life events, stressors, symptom changes, medication adherence, and between-session experiences.
- "objective": Therapist observations — client's appearance, affect, engagement level, speech, psychomotor behavior, therapeutic rapport, and response to interventions during the session.
- "assessment": Clinical progress — themes identified, treatment goal progress, therapeutic insights gained, risk factors assessed, diagnostic impressions, and functional status changes.
- "plan": Next session focus, treatment modifications, skills to develop, referrals, coordination of care, and updated treatment goals.
- "instructions": MANDATORY — between-session homework assignments, coping skills to practice, journaling prompts, mindfulness exercises, self-care recommendations, and emergency contacts.
${DETAIL_INSTRUCTION}`,

    pediatrics: `You are an expert pediatric documentation assistant.
Generate a thorough pediatric clinical note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting symptom or concern as reported by parent/caregiver.
- "historyOfPresentIllness": Detailed symptom history — onset, duration, severity, associated symptoms, exposure history, feeding/sleeping changes, developmental milestones, birth history, immunization status, past medical history.
- "physicalExam": Age-appropriate exam — growth parameters (weight, height, head circumference with percentiles), vitals, general appearance, HEENT, lungs, heart, abdomen, skin, extremities, neurological, developmental assessment.
- "assessment": Diagnosis with clinical reasoning, differential diagnoses considered, growth assessment.
- "plan": Treatment plan — medications with weight-based dosing, follow-up timing, immunizations due, developmental screening, referrals.
- "instructions": MANDATORY caregiver instructions — medication administration (dose, frequency, how to give), fever management, hydration, activity level, dietary recommendations, warning signs requiring ER visit, return precautions.
${DETAIL_INSTRUCTION}`,

    cardiology: `You are an expert cardiology documentation assistant.
Generate a detailed cardiology consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting cardiac symptoms.
- "historyOfPresentIllness": Detailed cardiac history — symptom description (chest pain characteristics, dyspnea class, palpitations, syncope), cardiac risk factors (HTN, DM, smoking, family hx, lipids), prior cardiac history, interventions, medications.
- "physicalExam": Cardiovascular examination — JVP, carotid pulses, PMI, heart sounds (S1, S2, murmurs, gallops), lung auscultation, peripheral edema, peripheral pulses.
- "objective": Diagnostic findings — ECG interpretation, echocardiogram results, stress test, cardiac catheterization, lab values (troponin, BNP, lipid panel).
- "assessment": Cardiac diagnosis, risk stratification, functional class.
- "plan": Medication management, lifestyle modifications, procedures planned, cardiac rehab, follow-up schedule.
- "instructions": MANDATORY — activity level and exercise recommendations, diet (sodium restriction, heart-healthy eating), medication compliance, weight monitoring, warning symptoms (chest pain, SOB, syncope requiring 911), follow-up appointments.
${DETAIL_INSTRUCTION}`,

    dermatology: `You are an expert dermatology documentation assistant.
Generate a detailed dermatology consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "objective": "...",
  "physicalExam": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting skin concern — onset, duration, evolution, prior treatments, family history of skin conditions.
- "objective": Lesion description — morphology (macule, papule, plaque, nodule, vesicle), color, size in cm, surface characteristics (scaling, crusting, ulceration), border, symmetry.
- "physicalExam": Distribution and pattern — location, arrangement (grouped, linear, annular), extent, dermoscopic findings if applicable.
- "assessment": Dermatologic diagnosis with differential diagnoses, biopsy results if applicable.
- "plan": Treatment — topical medications with application instructions, systemic medications, procedures (biopsy, excision, cryotherapy), phototherapy, referrals.
- "instructions": MANDATORY — medication application technique, frequency, and duration; sun protection (SPF, clothing, avoidance); wound care; signs of infection; when to return; skincare routine modifications.
${DETAIL_INSTRUCTION}`,

    orthopedics: `You are an expert orthopedic documentation assistant.
Generate a detailed orthopedic consultation note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "chiefComplaint": "...",
  "historyOfPresentIllness": "...",
  "physicalExam": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "chiefComplaint": Presenting musculoskeletal complaint.
- "historyOfPresentIllness": Mechanism of injury or symptom onset — timing, severity progression, prior injuries, prior treatments, functional limitations, occupation, sport participation.
- "physicalExam": Musculoskeletal exam — inspection, palpation, ROM (active and passive with degrees), strength testing (0-5 scale), neurovascular status (sensation, pulses, capillary refill), special tests (specific to the joint).
- "objective": Imaging findings — X-ray, MRI, CT interpretations with specific findings.
- "assessment": Orthopedic diagnosis, severity grading, stability assessment.
- "plan": Treatment — immobilization type, weight-bearing status, PT/OT referral, surgical planning if indicated, medications, follow-up imaging.
- "instructions": MANDATORY — weight-bearing restrictions, brace/cast care, icing protocol (20 min on/off), elevation, pain management (medications and schedule), exercises to perform, activities to avoid, signs of complications (increased swelling, numbness, color changes), follow-up timing.
${DETAIL_INSTRUCTION}`,

    custom: `You are an expert clinical documentation assistant.
Generate a comprehensive clinical note from the transcription.

Return a JSON object with ALL of these REQUIRED fields:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "instructions": "..."
}

Field requirements:
- "subjective": Detailed patient history — chief complaint, HPI, past medical history, medications, allergies, social/family history, review of systems.
- "objective": Complete examination findings — vitals and all relevant systems examined with both normal and abnormal findings documented.
- "assessment": Clinical diagnoses with reasoning, differential diagnoses, and clinical impression.
- "plan": Treatment plan — medications, diagnostics, referrals, and follow-up schedule.
- "instructions": MANDATORY patient instructions — medications, activity modifications, warning signs, diet, follow-up, and when to seek emergency care.
${DETAIL_INSTRUCTION}`,

    default: `You are an expert clinical documentation assistant. Generate a thorough clinical note from the transcription.
Return a JSON object with these REQUIRED fields: subjective, objective, assessment, plan, instructions.
Each field must contain detailed, multi-sentence content. The 'instructions' field is MANDATORY — always include specific patient instructions for medications, activity, follow-up, and warning signs.
${DETAIL_INSTRUCTION}`,
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

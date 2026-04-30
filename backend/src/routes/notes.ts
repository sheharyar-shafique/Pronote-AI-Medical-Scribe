import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { createNoteSchema, updateNoteSchema } from '../types/schemas.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { auditPHIAccess } from '../middleware/auditLog.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActiveSubscription);

// HIPAA: Audit all PHI access on clinical notes
router.use(auditPHIAccess('clinical_note'));

// GET /api/notes - Get all notes for current user
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { page = '1', limit = '20', status, template, search } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = supabase
      .from('clinical_notes')
      .select('*, note_contents(*)', { count: 'exact' })
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (template) {
      query = query.eq('template', template);
    }

    if (search) {
      query = query.ilike('patient_name', `%${search}%`);
    }

    const { data: notes, error, count } = await query;

    if (error) throw error;

    const formattedNotes = notes.map(note => ({
      id: note.id,
      userId: note.user_id,
      patientName: note.patient_name,
      patientId: note.patient_id,
      dateOfService: note.date_of_service,
      template: note.template,
      status: note.status,
      audioUrl: note.audio_url,
      transcription: note.transcription,
      content: note.note_contents ? {
        subjective: note.note_contents.subjective,
        objective: note.note_contents.objective,
        assessment: note.note_contents.assessment,
        plan: note.note_contents.plan,
        chiefComplaint: note.note_contents.chief_complaint,
        historyOfPresentIllness: note.note_contents.history_of_present_illness,
        reviewOfSystems: note.note_contents.review_of_systems,
        physicalExam: note.note_contents.physical_exam,
        medicalDecisionMaking: note.note_contents.medical_decision_making,
        instructions: note.note_contents.instructions,
        followUp: note.note_contents.follow_up,
        customSections: note.note_contents.custom_sections,
      } : {},
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }));

    res.json({
      notes: formattedNotes,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notes/recent - Get recent notes
router.get('/recent', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { limit = '5' } = req.query;

    const { data: notes, error } = await supabase
      .from('clinical_notes')
      .select('id, patient_name, date_of_service, template, status, created_at')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    res.json(notes.map(note => ({
      id: note.id,
      patientName: note.patient_name,
      dateOfService: note.date_of_service,
      template: note.template,
      status: note.status,
      createdAt: note.created_at,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/notes/:id - Get a single note
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: note, error } = await supabase
      .from('clinical_notes')
      .select('*, note_contents(*)')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !note) {
      throw new AppError('Note not found', 404);
    }

    res.json({
      id: note.id,
      userId: note.user_id,
      patientName: note.patient_name,
      patientId: note.patient_id,
      dateOfService: note.date_of_service,
      template: note.template,
      status: note.status,
      audioUrl: note.audio_url,
      transcription: note.transcription,
      content: note.note_contents ? {
        subjective: note.note_contents.subjective,
        objective: note.note_contents.objective,
        assessment: note.note_contents.assessment,
        plan: note.note_contents.plan,
        chiefComplaint: note.note_contents.chief_complaint,
        historyOfPresentIllness: note.note_contents.history_of_present_illness,
        reviewOfSystems: note.note_contents.review_of_systems,
        physicalExam: note.note_contents.physical_exam,
        medicalDecisionMaking: note.note_contents.medical_decision_making,
        instructions: note.note_contents.instructions,
        followUp: note.note_contents.follow_up,
        customSections: note.note_contents.custom_sections,
      } : {},
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notes - Create a new note
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const startTime = Date.now();
    const data = createNoteSchema.parse(req.body);

    // The DB CHECK constraint on `template` was dropped in drop-template-check-constraint.sql,
    // so we save the user's actual template ID (soap, progress-notes, custom-*, etc.) verbatim.

    // Create the clinical note with processing time
    const processingTimeSeconds = data.processingTime || Math.round((Date.now() - startTime) / 1000) || 5;
    
    const { data: note, error: noteError } = await supabase
      .from('clinical_notes')
      .insert({
        user_id: req.user!.id,
        patient_name: data.patientName,
        patient_id: data.patientId,
        date_of_service: data.dateOfService || new Date().toISOString().split('T')[0],
        template: data.template,
        status: data.status || 'draft',
        transcription: data.transcription,
        processing_time_seconds: processingTimeSeconds,
      })
      .select()
      .single();

    if (noteError) throw noteError;

    // Create the note content
    if (data.content) {
      const { error: contentError } = await supabase
        .from('note_contents')
        .insert({
          note_id: note.id,
          subjective: data.content.subjective,
          objective: data.content.objective,
          assessment: data.content.assessment,
          plan: data.content.plan,
          chief_complaint: data.content.chiefComplaint,
          history_of_present_illness: data.content.historyOfPresentIllness,
          review_of_systems: data.content.reviewOfSystems,
          physical_exam: data.content.physicalExam,
          medical_decision_making: data.content.medicalDecisionMaking,
          instructions: data.content.instructions,
          follow_up: data.content.followUp,
          custom_sections: data.content.customSections || {},
        });

      if (contentError) throw contentError;
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'note_created',
      resource_type: 'clinical_note',
      resource_id: note.id,
    });

    res.status(201).json({
      id: note.id,
      userId: note.user_id,
      patientName: note.patient_name,
      patientId: note.patient_id,
      dateOfService: note.date_of_service,
      template: note.template,
      status: note.status,
      content: data.content || {},
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notes/:id - Update a note
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateNoteSchema.parse(req.body);

    // Check if note exists and belongs to user
    const { data: existingNote, error: checkError } = await supabase
      .from('clinical_notes')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (checkError || !existingNote) {
      throw new AppError('Note not found', 404);
    }

    // Update clinical note
    const noteUpdateData: Record<string, unknown> = {};
    if (data.patientName) noteUpdateData.patient_name = data.patientName;
    if (data.patientId !== undefined) noteUpdateData.patient_id = data.patientId;
    if (data.dateOfService) noteUpdateData.date_of_service = data.dateOfService;
    if (data.template) noteUpdateData.template = data.template;
    if (data.status) noteUpdateData.status = data.status;
    if (data.transcription !== undefined) noteUpdateData.transcription = data.transcription;

    if (Object.keys(noteUpdateData).length > 0) {
      await supabase
        .from('clinical_notes')
        .update(noteUpdateData)
        .eq('id', id);
    }

    // Update note content
    if (data.content) {
      const contentUpdateData: Record<string, unknown> = {};
      if (data.content.subjective !== undefined) contentUpdateData.subjective = data.content.subjective;
      if (data.content.objective !== undefined) contentUpdateData.objective = data.content.objective;
      if (data.content.assessment !== undefined) contentUpdateData.assessment = data.content.assessment;
      if (data.content.plan !== undefined) contentUpdateData.plan = data.content.plan;
      if (data.content.chiefComplaint !== undefined) contentUpdateData.chief_complaint = data.content.chiefComplaint;
      if (data.content.historyOfPresentIllness !== undefined) contentUpdateData.history_of_present_illness = data.content.historyOfPresentIllness;
      if (data.content.reviewOfSystems !== undefined) contentUpdateData.review_of_systems = data.content.reviewOfSystems;
      if (data.content.physicalExam !== undefined) contentUpdateData.physical_exam = data.content.physicalExam;
      if (data.content.medicalDecisionMaking !== undefined) contentUpdateData.medical_decision_making = data.content.medicalDecisionMaking;
      if (data.content.instructions !== undefined) contentUpdateData.instructions = data.content.instructions;
      if (data.content.followUp !== undefined) contentUpdateData.follow_up = data.content.followUp;
      if (data.content.customSections !== undefined) contentUpdateData.custom_sections = data.content.customSections;

      await supabase
        .from('note_contents')
        .upsert({
          note_id: id,
          ...contentUpdateData,
        }, { onConflict: 'note_id' });
    }

    // Fetch updated note
    const { data: updatedNote, error } = await supabase
      .from('clinical_notes')
      .select('*, note_contents(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.json({
      id: updatedNote.id,
      userId: updatedNote.user_id,
      patientName: updatedNote.patient_name,
      patientId: updatedNote.patient_id,
      dateOfService: updatedNote.date_of_service,
      template: updatedNote.template,
      status: updatedNote.status,
      audioUrl: updatedNote.audio_url,
      transcription: updatedNote.transcription,
      content: updatedNote.note_contents ? {
        subjective: updatedNote.note_contents.subjective,
        objective: updatedNote.note_contents.objective,
        assessment: updatedNote.note_contents.assessment,
        plan: updatedNote.note_contents.plan,
        chiefComplaint: updatedNote.note_contents.chief_complaint,
        historyOfPresentIllness: updatedNote.note_contents.history_of_present_illness,
        reviewOfSystems: updatedNote.note_contents.review_of_systems,
        physicalExam: updatedNote.note_contents.physical_exam,
        medicalDecisionMaking: updatedNote.note_contents.medical_decision_making,
        instructions: updatedNote.note_contents.instructions,
        followUp: updatedNote.note_contents.follow_up,
        customSections: updatedNote.note_contents.custom_sections,
      } : {},
      createdAt: updatedNote.created_at,
      updatedAt: updatedNote.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notes/:id - Delete a note
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clinical_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'note_deleted',
      resource_type: 'clinical_note',
      resource_id: id,
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/notes/:id/sign - Sign a note
router.post('/:id/sign', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: note, error } = await supabase
      .from('clinical_notes')
      .update({ status: 'signed' })
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error || !note) {
      throw new AppError('Note not found', 404);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'note_signed',
      resource_type: 'clinical_note',
      resource_id: id,
    });

    res.json({ message: 'Note signed successfully', status: 'signed' });
  } catch (error) {
    next(error);
  }
});

// GET /api/notes/:id/export — Download note as formatted text/HTML for printing
router.get('/:id/export', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { format: fmt = 'html' } = req.query;

    const { data: note, error } = await supabase
      .from('clinical_notes')
      .select('*, note_contents(*)')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !note) throw new AppError('Note not found', 404);

    const c = note.note_contents || {};
    const dateStr = new Date(note.date_of_service || note.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const sections = [
      { label: 'Chief Complaint', value: c.chief_complaint },
      { label: 'History of Present Illness', value: c.history_of_present_illness },
      { label: 'Review of Systems', value: c.review_of_systems },
      { label: 'Physical Examination', value: c.physical_exam },
      { label: 'Subjective', value: c.subjective },
      { label: 'Objective', value: c.objective },
      { label: 'Assessment', value: c.assessment },
      { label: 'Plan', value: c.plan },
      { label: 'Medical Decision Making', value: c.medical_decision_making },
      { label: 'Instructions', value: c.instructions },
      { label: 'Follow Up', value: c.follow_up },
    ].filter(s => s.value && s.value.trim());

    // Custom sections
    const customSecs: { label: string; value: string }[] = [];
    if (c.custom_sections && typeof c.custom_sections === 'object') {
      Object.entries(c.custom_sections as Record<string, string>).forEach(([k, v]) => {
        if (v) customSecs.push({ label: k, value: v as string });
      });
    }

    const allSections = [...sections, ...customSecs];

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clinical Note — ${note.patient_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; background: #fff; color: #1a1a1a; padding: 48px; max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 28px; }
    .logo { font-size: 13px; font-weight: 800; color: #10b981; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; }
    .patient-name { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 6px; }
    .meta { display: flex; gap: 24px; flex-wrap: wrap; }
    .meta-item { font-size: 12px; color: #666; }
    .meta-item strong { color: #333; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-completed { background: #d1fae5; color: #065f46; }
    .badge-draft { background: #fef3c7; color: #92400e; }
    .badge-signed { background: #ede9fe; color: #4c1d95; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #d1fae5; }
    .section-body { font-size: 14px; line-height: 1.8; color: #333; white-space: pre-wrap; }
    .transcription { background: #f8f8f8; border-left: 4px solid #e5e7eb; padding: 16px; border-radius: 0 8px 8px 0; font-size: 13px; font-style: italic; color: #555; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #999; }
    @media print {
      body { padding: 24px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;margin-bottom:24px;font-size:13px;font-family:sans-serif;display:flex;justify-content:space-between;align-items:center;">
    <span>📄 Pronote AI — EHR Export</span>
    <button onclick="window.print()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:700;">Print / Save PDF</button>
  </div>

  <div class="header">
    <div class="logo">🏥 Pronote AI Medical Scribe</div>
    <div class="patient-name">${note.patient_name || 'Unknown Patient'}</div>
    <div class="meta">
      ${note.patient_id ? `<div class="meta-item"><strong>Patient ID:</strong> ${note.patient_id}</div>` : ''}
      <div class="meta-item"><strong>Date of Service:</strong> ${dateStr}</div>
      <div class="meta-item"><strong>Template:</strong> ${(note.template || 'SOAP').toUpperCase()}</div>
      <div class="meta-item"><strong>Status:</strong> <span class="badge badge-${note.status || 'draft'}">${note.status || 'draft'}</span></div>
    </div>
  </div>

  ${allSections.map(s => `
  <div class="section">
    <div class="section-title">${s.label}</div>
    <div class="section-body">${s.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>`).join('')}

  ${note.transcription ? `
  <div class="section">
    <div class="section-title">Original Transcription</div>
    <div class="transcription">${note.transcription.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>` : ''}

  <div class="footer">
    <span>Generated by Pronote AI Medical Scribe</span>
    <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
  </div>
</body>
</html>`;

    // Log HIPAA audit
    await supabase.from('activity_logs').insert({
      user_id: req.user!.id,
      action: 'note_exported',
      resource_type: 'clinical_note',
      resource_id: id,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="note-${note.patient_name?.replace(/\s+/g, '-')}-${note.date_of_service}.html"`);
    res.send(html);
  } catch (error) {
    next(error);
  }
});

export default router;

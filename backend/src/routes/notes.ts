import { Router, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { createNoteSchema, updateNoteSchema } from '../types/schemas.js';
import { authenticate, requireActiveSubscription, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActiveSubscription);

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

export default router;

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .upsert({
        email: 'admin@pronote.com',
        password_hash: adminPasswordHash,
        name: 'Admin User',
        role: 'admin',
        specialty: 'Administration',
        subscription_status: 'active',
        subscription_plan: 'enterprise',
        trial_ends_at: null,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (adminError) throw adminError;
    console.log('✅ Admin user created:', adminUser.email);

    // Create demo clinician user
    const clinicianPasswordHash = await bcrypt.hash('demo123', 12);
    const { data: clinicianUser, error: clinicianError } = await supabase
      .from('users')
      .upsert({
        email: 'demo@pronote.com',
        password_hash: clinicianPasswordHash,
        name: 'Dr. Sarah Johnson',
        role: 'clinician',
        specialty: 'General Medicine',
        subscription_status: 'active',
        subscription_plan: 'practice',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'email' })
      .select()
      .single();

    if (clinicianError) throw clinicianError;
    console.log('✅ Demo clinician created:', clinicianUser.email);

    // Create user settings for demo user
    await supabase
      .from('user_settings')
      .upsert({
        user_id: clinicianUser.id,
        default_template: 'soap',
        auto_save: true,
        dark_mode: false,
        notifications_enabled: true,
      }, { onConflict: 'user_id' });

    console.log('✅ User settings created');

    // Create sample clinical notes
    const sampleNotes = [
      {
        user_id: clinicianUser.id,
        patient_name: 'John Smith',
        date_of_service: new Date().toISOString().split('T')[0],
        template: 'soap',
        status: 'completed',
      },
      {
        user_id: clinicianUser.id,
        patient_name: 'Sarah Johnson',
        date_of_service: new Date().toISOString().split('T')[0],
        template: 'psychiatry',
        status: 'draft',
      },
      {
        user_id: clinicianUser.id,
        patient_name: 'Michael Brown',
        date_of_service: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        template: 'soap',
        status: 'completed',
      },
    ];

    for (const note of sampleNotes) {
      const { data: createdNote, error: noteError } = await supabase
        .from('clinical_notes')
        .insert(note)
        .select()
        .single();

      if (noteError) throw noteError;

      // Add content for the note
      await supabase
        .from('note_contents')
        .insert({
          note_id: createdNote.id,
          subjective: 'Patient presents with chief complaint...',
          objective: 'Vital signs within normal limits...',
          assessment: 'Assessment based on findings...',
          plan: 'Treatment plan outlined...',
        });
    }

    console.log('✅ Sample notes created');
    console.log('\n🎉 Database seeded successfully!');
    console.log('\nDemo Accounts:');
    console.log('  Admin: admin@pronote.com / admin123');
    console.log('  Clinician: demo@pronote.com / demo123');

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();

import type { Template, FAQ, DashboardStats, ClinicalNote } from '../types';

export const templates: Template[] = [
  {
    id: 'soap',
    name: 'SOAP Note',
    description: 'Standard Subjective, Objective, Assessment, Plan format',
    sections: ['Subjective', 'Objective', 'Assessment', 'Plan'],
    specialty: 'General',
  },
  {
    id: 'psychiatry',
    name: 'Psychiatry Note',
    description: 'Comprehensive psychiatric evaluation template',
    sections: ['Chief Complaint', 'History of Present Illness', 'Mental Status Exam', 'Assessment', 'Plan'],
    specialty: 'Psychiatry',
  },
  {
    id: 'therapy',
    name: 'Therapy Note',
    description: 'Psychotherapy session documentation',
    sections: ['Session Summary', 'Interventions', 'Client Response', 'Progress', 'Plan'],
    specialty: 'Therapy',
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics Note',
    description: 'Child-focused clinical documentation',
    sections: ['Chief Complaint', 'History', 'Growth & Development', 'Physical Exam', 'Assessment', 'Plan'],
    specialty: 'Pediatrics',
  },
  {
    id: 'cardiology',
    name: 'Cardiology Note',
    description: 'Cardiovascular evaluation template',
    sections: ['Chief Complaint', 'Cardiac History', 'Physical Exam', 'ECG/Imaging', 'Assessment', 'Plan'],
    specialty: 'Cardiology',
  },
  {
    id: 'dermatology',
    name: 'Dermatology Note',
    description: 'Skin condition documentation',
    sections: ['Chief Complaint', 'Skin Exam', 'Lesion Description', 'Assessment', 'Plan'],
    specialty: 'Dermatology',
  },
  {
    id: 'orthopedics',
    name: 'Orthopedics Note',
    description: 'Musculoskeletal evaluation template',
    sections: ['Chief Complaint', 'Mechanism of Injury', 'Physical Exam', 'Imaging', 'Assessment', 'Plan'],
    specialty: 'Orthopedics',
  },
  {
    id: 'custom',
    name: 'Custom Template',
    description: 'Create your own template structure',
    sections: [],
    specialty: 'Custom',
  },
];

export const faqs: FAQ[] = [
  {
    id: '1',
    question: 'How does Pronote ensure data security and patient privacy?',
    answer: 'Pronote maintains HIPAA compliance through end-to-end encryption, secure data centers, automatic audio deletion after processing, and strict access controls. All data is encrypted both in transit and at rest using AES-256 encryption.',
  },
  {
    id: '2',
    question: 'Can Pronote integrate with existing Electronic Health Record (EHR) systems?',
    answer: 'Yes, Pronote integrates with most major EHR systems including Epic, Cerner, Allscripts, and others through our secure API. Contact our enterprise team for custom integration support.',
  },
  {
    id: '3',
    question: 'What kind of AI technology powers the note-taking features?',
    answer: 'Pronote uses advanced medical-grade speech recognition combined with large language models specifically trained on clinical documentation. Our AI understands medical terminology, context, and formatting requirements across specialties.',
  },
  {
    id: '4',
    question: 'Is there a learning curve for new users to adopt Pronote?',
    answer: 'Pronote is designed to be intuitive and easy to use. Most clinicians are productive within minutes. We also provide onboarding support, video tutorials, and dedicated customer success managers for enterprise clients.',
  },
];

export const mockStats: DashboardStats = {
  totalNotes: 1247,
  notesThisWeek: 342,
  averageTime: '45min',
  accuracy: '98.5%',
};

export const mockRecentNotes: Partial<ClinicalNote>[] = [
  {
    id: '1',
    patientName: 'John Smith',
    dateOfService: new Date('2024-12-09'),
    template: 'soap',
    status: 'completed',
  },
  {
    id: '2',
    patientName: 'Sarah Johnson',
    dateOfService: new Date('2024-12-09'),
    template: 'psychiatry',
    status: 'draft',
  },
  {
    id: '3',
    patientName: 'Michael Brown',
    dateOfService: new Date('2024-12-08'),
    template: 'soap',
    status: 'completed',
  },
];

export const specialties = [
  'General Medicine',
  'Internal Medicine',
  'Family Medicine',
  'Pediatrics',
  'Psychiatry',
  'Psychology',
  'Cardiology',
  'Dermatology',
  'Orthopedics',
  'Neurology',
  'Oncology',
  'Emergency Medicine',
  'Surgery',
  'OB/GYN',
  'Other',
];

export const pricingPlans = [
  {
    id: 'individual_annual',
    name: 'PronoteAI Individual Annual',
    price: 300,
    period: 'year',
    pricePerMonth: 25,
    originalPrice: null,
    description: 'Perfect for individual practitioners',
    features: [
      'Unlimited clinical notes',
      'All note templates',
      'Audio recording & upload',
      'AI-powered transcription',
      'Basic EHR export',
      'Email support',
      'Unlimited audio retention',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    id: 'group_monthly',
    name: 'Pronote Group Monthly',
    price: 40,
    period: 'month',
    pricePerMonth: 40,
    originalPrice: null,
    description: 'Best for small practices & teams',
    features: [
      'Everything in Individual',
      'Up to 5 team members',
      'Custom templates',
      'Priority support',
      'Advanced analytics',
      'EHR integrations',
      'Team management dashboard',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    id: 'group_annual',
    name: 'Pronote Group Annual',
    price: 460,
    period: 'year',
    pricePerMonth: 38.33,
    originalPrice: 480,
    description: 'Best value for growing organizations',
    features: [
      'Everything in Group Monthly',
      'Annual billing discount',
      'Unlimited team members',
      'Custom AI training',
      'Dedicated success manager',
      'HIPAA BAA included',
      'Custom integrations',
      'SLA guarantees',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
];

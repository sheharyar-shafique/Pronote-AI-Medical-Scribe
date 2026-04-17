import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn('⚠️ OpenAI API key not configured. AI features will use mock data.');
}

export const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

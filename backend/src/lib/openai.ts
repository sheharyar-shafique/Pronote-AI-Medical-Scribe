import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn('⚠️ OpenAI API key not configured. AI features will use mock data.');
}

// Whisper transcription of long-form recordings (30+ min) can take several
// minutes server-side; the SDK default (~10 min) is fine for most cases but
// we bump it to 18 min to give comfortable headroom for 90-minute uploads.
// maxRetries stays low so a stuck request fails fast instead of compounding.
export const openai = openaiApiKey
  ? new OpenAI({
      apiKey: openaiApiKey,
      timeout: 18 * 60 * 1000,
      maxRetries: 1,
    })
  : null;

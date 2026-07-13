// ============================================================
// AI Processing Service - Groq/OpenAI integration
// ============================================================
import OpenAI from 'openai';

const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : undefined;

const openai = apiKey
  ? new OpenAI({
      apiKey,
      baseURL,
    })
  : null;

const defaultModel = process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

async function askAI(
  system: string,
  text: string,
  max_tokens: number
): Promise<string> {

  if (!openai) {
    console.warn("AI API Key missing. AI feature disabled.");
    return text;
  }

  const res = await openai.chat.completions.create({
    model: process.env.GROQ_MODEL || process.env.OPENAI_MODEL || defaultModel,
    messages: [
      {
        role: 'system',
        content: system,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens,
  });

  return res.choices[0].message.content || text;
}


export const aiService = {

  async rewrite(
    text: string,
    style = 'professional news'
  ): Promise<string> {
    return askAI(
      `You are a professional content editor. Rewrite the text in a ${style} style. Keep it concise and engaging. Return only rewritten text.`,
      text,
      500
    );
  },


  async summarize(text: string): Promise<string> {
    return askAI(
      'Summarize the content in 2-3 sentences. Return only the summary.',
      text,
      200
    );
  },


  async translate(
    text: string,
    targetLang = 'English'
  ): Promise<string> {
    return askAI(
      `Translate the text to ${targetLang}. Return only the translation.`,
      text,
      600
    );
  },


  async generateHashtags(text: string): Promise<string[]> {

    const result = await askAI(
      'Generate 5 relevant hashtags. Return comma separated words without #.',
      text,
      100
    );

    return result
      .split(',')
      .map(h => `#${h.trim()}`)
      .filter(Boolean);
  },


  async generateTitle(text: string): Promise<string> {
    return askAI(
      'Generate a catchy title. Return only the title.',
      text,
      60
    );
  },


  async detectSpam(text: string): Promise<boolean> {

    const result = await askAI(
      'Determine if this is spam. Reply only yes or no.',
      text,
      5
    );

    return result.toLowerCase().includes('yes');
  },


  async correctGrammar(text: string): Promise<string> {
    return askAI(
      'Correct grammar and spelling. Return only corrected text.',
      text,
      500
    );
  },


  async detectCategory(text: string): Promise<string> {

    const categories = [
      'Technology',
      'Sports',
      'Crypto',
      'News',
      'Business',
      'Entertainment',
      'Health',
      'Other'
    ];

    const result = await askAI(
      `Classify this into one category: ${categories.join(', ')}. Return only category name.`,
      text,
      20
    );

    return categories.includes(result.trim())
      ? result.trim()
      : 'Other';
  },

};
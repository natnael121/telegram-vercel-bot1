// ============================================================
//  AI Processing Service - OpenAI integration
// ============================================================
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const aiService = {
  async rewrite(text: string, style = 'professional news'): Promise<string> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional content editor. Rewrite the given text in a ${style} style. Keep it concise and engaging. Return only the rewritten text.`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
    });
    return res.choices[0].message.content || text;
  },

  async summarize(text: string): Promise<string> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Summarize the following content in 2-3 sentences. Return only the summary.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
    });
    return res.choices[0].message.content || text;
  },

  async translate(text: string, targetLang = 'English'): Promise<string> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${targetLang}. Return only the translation.`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 600,
    });
    return res.choices[0].message.content || text;
  },

  async generateHashtags(text: string): Promise<string[]> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate 5 relevant hashtags for the following content. Return them as a comma-separated list without #.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 100,
    });
    const raw = res.choices[0].message.content || '';
    return raw.split(',').map(h => `#${h.trim()}`).filter(Boolean);
  },

  async generateTitle(text: string): Promise<string> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a catchy title for the following content. Return only the title.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 60,
    });
    return res.choices[0].message.content || '';
  },

  async detectSpam(text: string): Promise<boolean> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Determine if the following text is spam. Reply with only "yes" or "no".',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 5,
    });
    return res.choices[0].message.content?.toLowerCase().includes('yes') || false;
  },

  async correctGrammar(text: string): Promise<string> {
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Correct the grammar and spelling of the following text. Return only the corrected text.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
    });
    return res.choices[0].message.content || text;
  },

  async detectCategory(text: string): Promise<string> {
    const categories = ['Technology', 'Sports', 'Crypto', 'News', 'Business', 'Entertainment', 'Health', 'Other'];
    const res = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify the following text into one of these categories: ${categories.join(', ')}. Return only the category name.`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 20,
    });
    const cat = res.choices[0].message.content?.trim() || 'Other';
    return categories.includes(cat) ? cat : 'Other';
  },
};

// ============================================================
// AI Processing Service - Groq/OpenAI integration (v2)
// Improvements: task-specific prompts, retries, temperature
// tuning, JSON classification, multi-provider fallback,
// task-specific models, simple in-memory caching.
// ============================================================
import OpenAI from 'openai';

// ------------------------------------------------------------
// Provider configuration
// ------------------------------------------------------------
// Add more providers here in priority order. Each needs an
// apiKey env var and a baseURL (undefined = OpenAI default).
interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseURL?: string;
}

const PROVIDERS: ProviderConfig[] = [
  { name: 'groq', apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' },
  { name: 'openai', apiKey: process.env.OPENAI_API_KEY, baseURL: undefined },
  { name: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' },
  { name: 'together', apiKey: process.env.TOGETHER_API_KEY, baseURL: 'https://api.together.xyz/v1' },
  { name: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com/v1' },
].filter(p => !!p.apiKey);

const clients: Record<string, OpenAI> = {};
for (const p of PROVIDERS) {
  clients[p.name] = new OpenAI({ apiKey: p.apiKey!, baseURL: p.baseURL });
}

// ------------------------------------------------------------
// Model selection per task, per provider.
// Falls back to a sensible default if a provider isn't Groq.
// ------------------------------------------------------------
type Task = 'rewrite' | 'summarize' | 'translate' | 'category' | 'spam' | 'title' | 'hashtags' | 'grammar' | 'event';

const MODEL_MAP: Record<string, Partial<Record<Task, string>>> = {
  groq: {
    rewrite: 'llama-3.3-70b-versatile',
    translate: 'llama-3.3-70b-versatile',
    event: 'llama-3.3-70b-versatile',
    summarize: 'llama-3.1-8b-instant',
    category: 'llama-3.1-8b-instant',
    spam: 'llama-3.1-8b-instant',
    title: 'llama-3.1-8b-instant',
    hashtags: 'llama-3.1-8b-instant',
    grammar: 'llama-3.1-8b-instant',
  },
  openai: {
    rewrite: 'gpt-4o-mini',
    translate: 'gpt-4o-mini',
    event: 'gpt-4o-mini',
    summarize: 'gpt-4o-mini',
    category: 'gpt-4o-mini',
    spam: 'gpt-4o-mini',
    title: 'gpt-4o-mini',
    hashtags: 'gpt-4o-mini',
    grammar: 'gpt-4o-mini',
  },
};

function modelFor(provider: string, task: Task): string {
  return MODEL_MAP[provider]?.[task] || process.env[`${provider.toUpperCase()}_MODEL`] || 'gpt-4o-mini';
}

// ------------------------------------------------------------
// Temperature per task
// ------------------------------------------------------------
const TEMPERATURE: Record<Task, number> = {
  rewrite: 0.7,
  summarize: 0.4,
  translate: 0.3,
  category: 0,
  spam: 0,
  title: 0.6,
  hashtags: 0.5,
  grammar: 0.2,
  event: 0.5,
};

// ------------------------------------------------------------
// Simple in-memory cache. Swap this out for Firestore by
// replacing cacheGet/cacheSet with reads/writes against your
// "ai_results" collection keyed the same way.
// ------------------------------------------------------------
const memoryCache = new Map<string, string>();

function cacheKey(task: Task, text: string, extra = ''): string {
  return `${task}::${extra}::${text}`;
}

function cacheGet(key: string): string | undefined {
  return memoryCache.get(key);
}

function cacheSet(key: string, value: string): void {
  memoryCache.set(key, value);
}

// ------------------------------------------------------------
// Core call with retry + provider fallback
// ------------------------------------------------------------
interface AskOptions {
  task: Task;
  system: string;
  text: string;
  max_tokens: number;
  jsonMode?: boolean;
}

async function askAI(opts: AskOptions): Promise<string> {
  const { task, system, text, max_tokens, jsonMode } = opts;

  if (PROVIDERS.length === 0) {
    console.warn('No AI provider API key configured. AI feature disabled.');
    return text;
  }

  let lastError: unknown;

  for (const provider of PROVIDERS) {
    const client = clients[provider.name];
    const model = modelFor(provider.name, task);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text },
          ],
          max_tokens,
          temperature: TEMPERATURE[task],
          ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        });

        const content = res.choices[0]?.message?.content;
        if (content) return content.trim();

        throw new Error('Empty response from model');
      } catch (err) {
        lastError = err;
        const isLastAttempt = attempt === 2;
        if (isLastAttempt) break; // try next provider

        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    console.warn(`Provider "${provider.name}" failed for task "${task}", trying next provider if available.`, lastError);
  }

  console.error(`All providers failed for task "${task}".`, lastError);
  return text; // graceful degradation: return original text
}

// ------------------------------------------------------------
// Prompts
// ------------------------------------------------------------
const REWRITE_PROMPT = `
You are an experienced social media editor.

Rewrite the post while preserving ALL factual information.

Rules:
- Never invent information.
- Never remove important details.
- Make it more engaging and easier to read.
- Fix grammar and spelling.
- Improve structure.
- Use short paragraphs.
- Keep dates, prices, locations and names exactly the same.
- Do not exaggerate.
- Return only the rewritten post.
`;

const SUMMARY_PROMPT = `
Summarize this post.

Rules:
- Maximum 3 sentences.
- Mention only important information.
- Preserve names, dates and prices.
- Return only the summary.
`;

const TRANSLATE_PROMPT_TEMPLATE = (targetLang: string) => `
Translate naturally into ${targetLang}.

Rules:
- Preserve names.
- Preserve prices.
- Preserve locations.
- Preserve dates.
- Make it sound like a native ${targetLang} news article.
- Return only the translated text.
`;

const CATEGORIES = [
  'Technology',
  'Business',
  'Entertainment',
  'Sports',
  'Health',
  'Politics',
  'Crypto',
  'Education',
  'Travel',
  'Food',
  'Events',
  'Other',
];

const CATEGORY_PROMPT = `
Classify this content.

Allowed categories:

${CATEGORIES.join('\n')}

Return ONLY a JSON object of the form:
{"category": "<one of the allowed categories>"}
`;

const SPAM_PROMPT = `
Determine if this is spam.

Spam includes:

- scams
- fake giveaways
- phishing
- repeated advertisements
- malicious links

Legitimate news and events are NOT spam.

Return ONLY a JSON object of the form:
{"is_spam": true} or {"is_spam": false}
`;

const TITLE_PROMPT = `
Generate a short engaging title.

Rules:
- Maximum 12 words.
- No clickbait.
- Preserve names.
- No emojis.
- Return only the title.
`;

const HASHTAGS_PROMPT = `
Generate exactly 5 hashtags.

Rules:
- lowercase
- no spaces
- no punctuation
- no duplicates
- no explanation

Return comma separated, without the # symbol.
`;

const GRAMMAR_PROMPT = `
Correct grammar and spelling only.

Rules:
- Do not change meaning.
- Do not change facts, names, dates or prices.
- Return only the corrected text.
`;

const EVENT_REWRITE_PROMPT = `
Rewrite this event announcement.

Keep ALL facts unchanged. Improve readability. Use short paragraphs.

Keep exactly as given:
- Event name
- Date
- Venue
- Artists
- Ticket prices
- VIP information / schedule

Do not invent information.

Return only the final post.
`;

// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------
export const aiService = {
  async rewrite(text: string, style = 'professional news'): Promise<string> {
    const key = cacheKey('rewrite', text, style);
    const cached = cacheGet(key);
    if (cached) return cached;

    const system = style === 'professional news'
      ? REWRITE_PROMPT
      : `${REWRITE_PROMPT}\nStyle: ${style}.`;

    const result = await askAI({ task: 'rewrite', system, text, max_tokens: 500 });
    cacheSet(key, result);
    return result;
  },

  async summarize(text: string): Promise<string> {
    const key = cacheKey('summarize', text);
    const cached = cacheGet(key);
    if (cached) return cached;

    const result = await askAI({ task: 'summarize', system: SUMMARY_PROMPT, text, max_tokens: 200 });
    cacheSet(key, result);
    return result;
  },

  async translate(text: string, targetLang = 'English'): Promise<string> {
    const key = cacheKey('translate', text, targetLang);
    const cached = cacheGet(key);
    if (cached) return cached;

    const result = await askAI({
      task: 'translate',
      system: TRANSLATE_PROMPT_TEMPLATE(targetLang),
      text,
      max_tokens: 600,
    });
    cacheSet(key, result);
    return result;
  },

  async generateHashtags(text: string): Promise<string[]> {
    const key = cacheKey('hashtags', text);
    const cached = cacheGet(key);
    if (cached) return JSON.parse(cached);

    const result = await askAI({ task: 'hashtags', system: HASHTAGS_PROMPT, text, max_tokens: 100 });

    const hashtags = result
      .split(',')
      .map(h => h.trim().replace(/[^a-z0-9]/gi, '').toLowerCase())
      .filter(Boolean)
      .slice(0, 5)
      .map(h => `#${h}`);

    cacheSet(key, JSON.stringify(hashtags));
    return hashtags;
  },

  async generateTitle(text: string): Promise<string> {
    const key = cacheKey('title', text);
    const cached = cacheGet(key);
    if (cached) return cached;

    const result = await askAI({ task: 'title', system: TITLE_PROMPT, text, max_tokens: 60 });
    cacheSet(key, result);
    return result;
  },

  async detectSpam(text: string): Promise<boolean> {
    const key = cacheKey('spam', text);
    const cached = cacheGet(key);
    if (cached) return cached === 'true';

    const raw = await askAI({ task: 'spam', system: SPAM_PROMPT, text, max_tokens: 20, jsonMode: true });

    let isSpam = false;
    try {
      const parsed = JSON.parse(raw);
      isSpam = !!parsed.is_spam;
    } catch {
      // Fallback in case a provider ignores json mode
      isSpam = raw.toLowerCase().includes('true') || raw.toLowerCase().includes('yes');
    }

    cacheSet(key, String(isSpam));
    return isSpam;
  },

  async correctGrammar(text: string): Promise<string> {
    const key = cacheKey('grammar', text);
    const cached = cacheGet(key);
    if (cached) return cached;

    const result = await askAI({ task: 'grammar', system: GRAMMAR_PROMPT, text, max_tokens: 500 });
    cacheSet(key, result);
    return result;
  },

  async detectCategory(text: string): Promise<string> {
    const key = cacheKey('category', text);
    const cached = cacheGet(key);
    if (cached) return cached;

    const raw = await askAI({ task: 'category', system: CATEGORY_PROMPT, text, max_tokens: 30, jsonMode: true });

    let category = 'Other';
    try {
      const parsed = JSON.parse(raw);
      if (CATEGORIES.includes(parsed.category)) category = parsed.category;
    } catch {
      // Fallback: try to match a bare word response
      const match = CATEGORIES.find(c => raw.toLowerCase().includes(c.toLowerCase()));
      if (match) category = match;
    }

    cacheSet(key, category);
    return category;
  },

  async rewriteEvent(text: string): Promise<string> {
    const key = cacheKey('event', text);
    const cached = cacheGet(key);
    if (cached) return cached;

    const result = await askAI({ task: 'event', system: EVENT_REWRITE_PROMPT, text, max_tokens: 600 });
    cacheSet(key, result);
    return result;
  },
};

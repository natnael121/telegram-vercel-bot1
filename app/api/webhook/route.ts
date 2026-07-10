// app/api/webhook/route.ts
// Telegram Bot Webhook endpoint (Vercel serverless)
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Lazy-load bot only at runtime (not at build time)
  const token = process.env.BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'BOT_TOKEN not configured' }, { status: 500 });
  }

  try {
    const { webhookCallback } = await import('grammy');
    const { createBot } = await import('@/lib/bot');
    const bot = createBot();
    const handler = webhookCallback(bot, 'std/http');
    return await handler(req);
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}

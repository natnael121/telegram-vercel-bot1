// app/api/setup-webhook/route.ts
// One-time webhook setup endpoint
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const webhookUrl = `${process.env.WEBHOOK_URL}/api/webhook`;
  const botToken = process.env.BOT_TOKEN;

  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true,
      }
    );
    return NextResponse.json({ status: 'webhook set', response: res.data, webhookUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

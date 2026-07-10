// app/api/collect/route.ts
// Called by the Python collector to store new posts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { postService, channelService } = await import('@/lib/db');
    const { telegramPublisher } = await import('@/lib/publisher');
    const { aiService } = await import('@/lib/ai');
    // Validate secret
    const secret = req.headers.get('x-collector-secret');
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      sourceChannel,
      messageId,
      caption = '',
      mediaUrl,
      mediaType = 'text',
      mediaUrls,
      pollData,
      sourceLink,
    } = body;

    // Check duplicate
    const isDuplicate = await postService.checkDuplicate(sourceChannel, messageId);
    if (isDuplicate) {
      await telegramPublisher.notifyAdmin(`⚠️ <b>Duplicate Detected</b>\nChannel: ${sourceChannel}\nMessage: #${messageId}`);
      return NextResponse.json({ status: 'duplicate' });
    }

    // Auto-detect category using AI (optional)
    let category = body.category || 'General';
    if (!body.category && caption && process.env.OPENAI_API_KEY) {
      try {
        category = await aiService.detectCategory(caption);
      } catch (_) {}
    }

    // Check spam
    let isSpam = false;
    if (caption && process.env.OPENAI_API_KEY) {
      try {
        isSpam = await aiService.detectSpam(caption);
      } catch (_) {}
    }

    if (isSpam) {
      await telegramPublisher.notifyAdmin(`🚫 <b>Spam Detected & Skipped</b>\nChannel: ${sourceChannel}\nPreview: ${caption.slice(0, 100)}`);
      return NextResponse.json({ status: 'spam_rejected' });
    }

    // Save post
    const postId = await postService.create({
      sourceChannel,
      messageId,
      caption,
      originalCaption: caption,
      review: '',
      mediaUrl: mediaUrl || null,
      mediaType,
      mediaUrls,
      pollData,
      sourceLink,
      status: 'pending',
      published: false,
      category,
      isEvent: false,
    });

    // Increment channel stats
    await channelService.incrementPostCount(sourceChannel);

    // Notify admin bot
    const notifText =
      `📨 <b>NEW POST</b>\n\n` +
      `📡 Source: <b>${sourceChannel}</b>\n` +
      `🕐 Time: <b>${new Date().toLocaleString()}</b>\n` +
      `📂 Category: <b>${category}</b>\n` +
      `🎬 Media: <b>${mediaType}</b>\n\n` +
      `📝 <b>Caption:</b>\n${caption?.slice(0, 400) || '(no caption)'}\n\n` +
      `Use /pending to review.`;

    await telegramPublisher.notifyAdmin(notifText);

    return NextResponse.json({ status: 'saved', postId });
  } catch (error: any) {
    console.error('Collect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

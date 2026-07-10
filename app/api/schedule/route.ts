// app/api/schedule/route.ts
// Cron job endpoint called by Vercel Cron to publish scheduled posts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { scheduleService, postService, interactionService } = await import('@/lib/db');
  const { telegramPublisher } = await import('@/lib/publisher');

  const dueSchedules = await scheduleService.getDue();
  const results = [];

  for (const schedule of dueSchedules) {
    const post = await postService.getById(schedule.postId);
    if (!post) {
      await scheduleService.markDone(schedule.id);
      continue;
    }

    const analytics = await interactionService.getAnalytics(schedule.postId) || {
      likes: 0, favorites: 0, going: 0, notGoing: 0
    };

    const targets = schedule.targets?.length
      ? schedule.targets
      : [process.env.MAIN_CHANNEL_ID!].filter(Boolean);

    let lastMsgId = 0;
    for (const target of targets) {
      try {
        lastMsgId = await telegramPublisher.publishPost(post, target, {
          likes: analytics.likes || 0,
          favorites: analytics.favorites || 0,
          going: analytics.going || 0,
          notGoing: analytics.notGoing || 0,
        });
      } catch (e: any) {
        await telegramPublisher.notifyAdmin(`❌ <b>Scheduled post failed</b>\nPost: ${schedule.postId}\nTarget: ${target}\nError: ${e.message}`);
      }
    }

    await postService.markPublished(schedule.postId, lastMsgId);
    await scheduleService.markDone(schedule.id);
    await telegramPublisher.notifyAdmin(`✅ <b>Scheduled post published</b>\nPost: ${schedule.postId.slice(0, 8)}...`);
    results.push({ scheduleId: schedule.id, postId: schedule.postId, status: 'published' });
  }

  return NextResponse.json({ processed: results.length, results });
}

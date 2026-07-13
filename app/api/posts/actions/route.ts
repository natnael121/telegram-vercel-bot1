// app/api/posts/actions/route.ts
// Handles all post management actions from the admin dashboard
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, postId, caption, review, delay } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const { postService, scheduleService, interactionService } = await import('@/lib/db');
    const { aiService } = await import('@/lib/ai');
    const { telegramPublisher, buildPostKeyboard } = await import('@/lib/publisher');

    const post = await postService.getById(postId);
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    switch (action) {
      // ── Approve & Publish ─────────────────────────────────────
      case 'approve': {
        if (post.status === 'published') {
          return NextResponse.json({ error: 'Post already published' }, { status: 400 });
        }

        const targets = post.publishTargets?.length
          ? post.publishTargets
          : [process.env.MAIN_CHANNEL_ID!].filter(Boolean);

        if (targets.length === 0) {
          return NextResponse.json({ error: 'No publish targets configured' }, { status: 400 });
        }

        const analytics = await interactionService.getAnalytics(postId) || {
          likes: 0, favorites: 0, going: 0, notGoing: 0,
        };

        let lastMessageId = 0;
        let publishedCount = 0;
        const failedTargets: string[] = [];

        for (const target of targets) {
          try {
            const msgId = await telegramPublisher.publishPost(post, target, {
              likes: analytics.likes || 0,
              favorites: analytics.favorites || 0,
              going: analytics.going || 0,
              notGoing: analytics.notGoing || 0,
            });
            lastMessageId = msgId;
            publishedCount++;
          } catch (e: any) {
            failedTargets.push(`${target}: ${e.message}`);
          }
        }

        if (publishedCount > 0) {
          await postService.markPublished(postId, lastMessageId);
          await telegramPublisher.notifyAdmin(
            `📢 <b>Post Published via Dashboard</b>\nPost ID: ${postId.slice(0, 8)}...\nTargets: ${publishedCount}/${targets.length}`
          );
        }

        return NextResponse.json({
          status: publishedCount > 0 ? 'published' : 'failed',
          publishedCount,
          totalTargets: targets.length,
          failedTargets,
        });
      }

      // ── Reject ───────────────────────────────────────────────
      case 'reject': {
        await postService.updateStatus(postId, 'rejected');
        return NextResponse.json({ status: 'rejected' });
      }

      // ── Edit Caption ─────────────────────────────────────────
      case 'edit_caption': {
        if (!caption) {
          return NextResponse.json({ error: 'Missing caption' }, { status: 400 });
        }
        await postService.updateCaption(postId, caption);
        return NextResponse.json({ status: 'updated', caption });
      }

      // ── Add Review ───────────────────────────────────────────
      case 'add_review': {
        if (!review) {
          return NextResponse.json({ error: 'Missing review' }, { status: 400 });
        }
        await postService.updateReview(postId, review);
        return NextResponse.json({ status: 'updated', review });
      }

      // ── AI Rewrite ───────────────────────────────────────────
      case 'ai_rewrite': {
        const rewritten = await aiService.rewrite(post.caption);
        await postService.updateCaption(postId, rewritten);
        return NextResponse.json({ status: 'rewritten', caption: rewritten });
      }

      // ── AI Translate ─────────────────────────────────────────
      case 'ai_translate': {
        const translated = await aiService.translate(post.caption);
        await postService.updateCaption(postId, translated);
        return NextResponse.json({ status: 'translated', caption: translated });
      }

      // ── Schedule ─────────────────────────────────────────────
      case 'schedule': {
        const delayMin = parseInt(delay) || 30;
        const publishTime = new Date(Date.now() + delayMin * 60 * 1000);
        const targets = post.publishTargets?.length
          ? post.publishTargets
          : [process.env.MAIN_CHANNEL_ID || ''].filter(Boolean);
        await scheduleService.create(postId, publishTime, targets);
        return NextResponse.json({
          status: 'scheduled',
          publishTime: publishTime.toISOString(),
          delayMinutes: delayMin,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Post action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

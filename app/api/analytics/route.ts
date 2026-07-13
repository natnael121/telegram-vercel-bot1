// app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const { analyticsService, postService } = await import('@/lib/db');
    const stats = await analyticsService.getDashboardStats();
    const topPostsRaw = await analyticsService.getTopPosts(10);

    const topPosts = await Promise.all(
      topPostsRaw.map(async (item) => {
        try {
          const post = await postService.getById(item.postId);
          return {
            ...item,
            sourceChannel: post?.sourceChannel || 'Unknown Channel',
            createdAt: post?.createdAt || null,
            mediaUrl: post?.mediaUrl || null,
            mediaType: post?.mediaType || null,
          };
        } catch {
          return {
            ...item,
            sourceChannel: 'Unknown Channel',
            createdAt: null,
            mediaUrl: null,
            mediaType: null,
          };
        }
      })
    );

    return NextResponse.json({ stats, topPosts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

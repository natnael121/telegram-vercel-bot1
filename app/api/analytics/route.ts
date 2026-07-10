// app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const { analyticsService } = await import('@/lib/db');
    const stats = await analyticsService.getDashboardStats();
    const topPosts = await analyticsService.getTopPosts(10);
    return NextResponse.json({ stats, topPosts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

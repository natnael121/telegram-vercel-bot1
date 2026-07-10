// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;
  const mediaType = searchParams.get('mediaType') || undefined;
  const caption = searchParams.get('q') || undefined;

  try {
    const { postService } = await import('@/lib/db');
    const posts = await postService.search({ status, category, mediaType, caption });
    return NextResponse.json({ posts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const { postService } = await import('@/lib/db');
    await postService.delete(id);
    return NextResponse.json({ status: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

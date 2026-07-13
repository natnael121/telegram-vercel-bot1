// app/api/channels/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { channelService } = await import('@/lib/db');
    const channels = await channelService.getAll();
    return NextResponse.json({ channels });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, title, category } = await req.json();
    if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 });
    const { channelService } = await import('@/lib/db');
    const id = await channelService.add(username, title || username, category || 'General');
    return NextResponse.json({ status: 'added', id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, enabled } = await req.json();
    if (!id || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing id or enabled' }, { status: 400 });
    }
    const { channelService } = await import('@/lib/db');
    await channelService.toggle(id, enabled);
    return NextResponse.json({ status: 'toggled', enabled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  try {
    const { channelService } = await import('@/lib/db');
    await channelService.remove(id);
    return NextResponse.json({ status: 'removed' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

#!/usr/bin/env python3
"""
Telegram Channel Collector - Reads public channels and sends to API
Uses Telethon (MTProto) to access Telegram as a user client
"""

import asyncio
import os
import json
import hashlib
import aiohttp
from datetime import datetime, timezone
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.tl.types import (
    MessageMediaPhoto, MessageMediaDocument,
    MessageMediaPoll, MessageMediaWebPage,
    DocumentAttributeAnimated, DocumentAttributeVideo, DocumentAttributeAudio
)
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
PHONE = os.environ["TG_PHONE"]
SESSION = os.environ.get("TG_SESSION", "collector_session")
COLLECT_API_URL = os.environ["WEBHOOK_URL"] + "/api/collect"
COLLECT_SECRET = os.environ["WEBHOOK_SECRET"]
CHANNELS_API_URL = os.environ["WEBHOOK_URL"] + "/api/channels"

client = TelegramClient(
    StringSession(SESSION),
    API_ID,
    API_HASH,
    connection_retries=10,
    retry_delay=5,
    auto_reconnect=True
)

# ── Helper: detect media type ─────────────────────────────────────────────────
def get_media_type(message):
    if not message.media:
        return "text", None
    if isinstance(message.media, MessageMediaPhoto):
        return "photo", None
    if isinstance(message.media, MessageMediaDocument):
        attrs = message.media.document.attributes if message.media.document else []
        for attr in attrs:
            if isinstance(attr, DocumentAttributeAnimated):
                return "gif", None
            if isinstance(attr, DocumentAttributeVideo):
                return "video", None
            if isinstance(attr, DocumentAttributeAudio):
                return "voice", None
        return "document", None
    if isinstance(message.media, MessageMediaPoll):
        return "poll", message.media.poll
    return "text", None

# ── Helper: send post to API ──────────────────────────────────────────────────
async def send_to_api(session: aiohttp.ClientSession, payload: dict) -> dict:
    try:
        async with session.post(
            COLLECT_API_URL,
            json=payload,
            headers={"x-collector-secret": COLLECT_SECRET, "Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=15)
        ) as resp:
            return await resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to send to API: {e}")
        return {}

# ── Helper: get enabled channels from API ─────────────────────────────────────
async def get_enabled_channels(session: aiohttp.ClientSession) -> list[str]:
    try:
        async with session.get(CHANNELS_API_URL, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            data = await resp.json()
            return [ch["username"].lstrip("@") for ch in data.get("channels", []) if ch.get("enabled")]
    except Exception as e:
        print(f"[ERROR] Could not fetch channels: {e}")
        return []

# ── Helper: extract media URL (file_id or URL) ────────────────────────────────
async def get_media_url(message) -> str | None:
    if not message.media:
        return None
    try:
        # For photos and documents, we return a reference that the bot can use
        # In production, you'd upload to Firebase Storage and return the URL
        # For now, return the Telegram file_id equivalent
        if isinstance(message.media, MessageMediaPhoto):
            return f"https://t.me/{message.chat_id}/{message.id}"
        return None
    except Exception:
        return None

# ── Helper: extract poll data ─────────────────────────────────────────────────
def extract_poll_data(poll) -> dict | None:
    if not poll:
        return None
    return {
        "question": poll.question if isinstance(poll.question, str) else poll.question.text,
        "options": [a.text if isinstance(a.text, str) else a.text.text for a in poll.answers],
    }

# ── Main collector ────────────────────────────────────────────────────────────
async def collect_new_messages(session: aiohttp.ClientSession, channel_username: str):
    try:
        entity = await client.get_entity(channel_username)
        messages = await client.get_messages(entity, limit=5)
        for message in messages:
            if not message or message.out:
                continue

            media_type, raw_media = get_media_type(message)
            media_url = await get_media_url(message)
            caption = message.text or message.message or ""
            source_link = f"https://t.me/{channel_username}/{message.id}"

            payload = {
                "sourceChannel": f"@{channel_username}",
                "messageId": message.id,
                "caption": caption,
                "mediaUrl": media_url,
                "mediaType": media_type,
                "sourceLink": source_link,
                "pollData": extract_poll_data(raw_media) if media_type == "poll" else None,
            }

            result = await send_to_api(session, payload)
            status = result.get("status", "unknown")
            print(f"[{channel_username}] msg#{message.id} → {status}")

    except Exception as e:
        print(f"[ERROR] {channel_username}: {e}")

# ── Event listener for real-time new messages ─────────────────────────────────
async def setup_listeners(session: aiohttp.ClientSession, channel_usernames: list[str]):
    entities = []
    for username in channel_usernames:
        try:
            entity = await client.get_entity(username)
            entities.append(entity)
        except Exception as e:
            print(f"[WARN] Could not resolve {username}: {e}")

    if not entities:
        print("[WARN] No valid channel entities found.")
        return

    @client.on(events.NewMessage(chats=entities))
    async def handler(event):
        message = event.message
        channel_username = event.chat.username or str(event.chat_id)
        media_type, raw_media = get_media_type(message)
        media_url = await get_media_url(message)
        caption = message.text or message.message or ""
        source_link = f"https://t.me/{channel_username}/{message.id}"

        payload = {
            "sourceChannel": f"@{channel_username}",
            "messageId": message.id,
            "caption": caption,
            "mediaUrl": media_url,
            "mediaType": media_type,
            "sourceLink": source_link,
            "pollData": extract_poll_data(raw_media) if media_type == "poll" else None,
        }

        result = await send_to_api(session, payload)
        print(f"[LIVE] @{channel_username} msg#{message.id} → {result.get('status', 'unknown')}")

    print(f"✅ Listening to {len(entities)} channel(s) for new messages...")

# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    print("🚀 Telegram Channel Collector starting...")

    await client.connect()

    if not await client.is_user_authorized():
        await client.start(phone=PHONE)

    print("✅ Logged in to Telegram")

    async with aiohttp.ClientSession() as session:
        channels = await get_enabled_channels(session)
        print(f"📡 Found {len(channels)} enabled channel(s): {channels}")

        if not channels:
            print("⚠️ No channels configured. Add channels via the bot or dashboard.")
            return

        print("📥 Collecting recent messages...")
        for ch in channels:
            await collect_new_messages(session, ch)
            await asyncio.sleep(1)

        await setup_listeners(session, channels)

        print("🔄 Listening for new messages... (Press Ctrl+C to stop)")
        await client.run_until_disconnected()
if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import os
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

load_dotenv()

api_id = int(os.environ["TG_API_ID"])
api_hash = os.environ["TG_API_HASH"]
session = os.environ["TG_SESSION"]

async def main():
    print("Connecting...")

    client = TelegramClient(
        StringSession(session),
        api_id,
        api_hash,
        connection_retries=10,
        retry_delay=5,
        auto_reconnect=True
    )

    await client.connect()

    print("Connected:", await client.is_user_authorized())

    me = await client.get_me()

    print("User:", me.first_name, me.id)

    await client.disconnect()

asyncio.run(main())
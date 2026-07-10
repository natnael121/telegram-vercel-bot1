# 📡 Telegram Content Aggregator & Publisher Bot

A complete Telegram content management system with auto-collection, editorial review, AI processing, scheduling, interactive buttons, and real-time analytics — powered by Firebase and deployed on Vercel.

---

## 🏗️ Architecture

```
Public Telegram Channels
        │
        ▼
Python Collector (Telethon)  ←──── runs locally or on a VPS
        │  POST /api/collect
        ▼
Next.js API (Vercel)
        │
        ├─► Firebase Firestore (store posts)
        │
        ▼
Admin Telegram Bot (grammY webhook)
        │  /pending → review → approve/edit/schedule
        ▼
Telegram Publishing Bot
        │
        ▼
Your Telegram Channel
        │  (interactive buttons: 👍 ❤️ ✅ ❌ 📌 🔔)
        ▼
Firebase Analytics (real-time)
        │
        ▼
Admin Dashboard (Next.js, Vercel)
```

---

## 🚀 Quick Setup

### 1. Clone & Install

```bash
cd "new bot"
npm install
```

### 2. Fill in `.env`

Open `.env` and fill every variable:

| Variable | Where to get it |
|---|---|
| `BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` |
| `ADMIN_CHAT_ID` | [@userinfobot](https://t.me/userinfobot) → your user ID |
| `TG_API_ID` / `TG_API_HASH` | [my.telegram.org](https://my.telegram.org) → API Development Tools |
| `TG_PHONE` | Your phone number (e.g. `+251911234567`) |
| `FIREBASE_*` | Firebase Console → Project Settings → Service Accounts → Generate Key |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Console → Project Settings → Web App |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) (optional) |
| `WEBHOOK_URL` | Your Vercel app URL (e.g. `https://my-app.vercel.app`) |
| `WEBHOOK_SECRET` | Any random string (e.g. `openssl rand -hex 32`) |
| `CRON_SECRET` | Any random string for cron authentication |

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project
3. Enable **Firestore Database** (production mode)
4. Enable **Firebase Storage**
5. Enable **Authentication** (optional, for dashboard login)
6. Go to **Project Settings → Service Accounts → Generate new private key**
7. Copy all values to your `.env`

Create these Firestore indexes (or let them auto-create on first query):

```
Collection: posts
  - status ASC, createdAt ASC
  - status ASC, published ASC, createdAt ASC
  - sourceChannel ASC, messageId ASC

Collection: schedules
  - published ASC, publishTime ASC

Collection: analytics
  - likes DESC
```

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add all `.env` variables in Vercel Dashboard → Settings → Environment Variables.

### 5. Register Webhook

After deploying, visit once:

```
https://your-app.vercel.app/api/setup-webhook?secret=YOUR_WEBHOOK_SECRET
```

This registers your bot's webhook with Telegram.

### 6. Run the Python Collector

```bash
cd collector
pip install -r requirements.txt
python main.py
```

First run will ask for your phone number and OTP. After that it runs silently.

**💡 Run on a VPS (recommended):**
```bash
# Use screen or tmux to keep it running
screen -S collector
python collector/main.py
# Ctrl+A, D to detach
```

---

## 🤖 Bot Usage

Add channels first via the bot:
```
/addchannel @technews Technology
/addchannel @cryptoupdates Crypto
/addchannel @ethiopianews Ethiopia
```

Then the collector will automatically pick them up.

When a new post arrives:
1. You get a Telegram notification
2. Use `/pending` to enter review mode
3. Press buttons to **Approve**, **Reject**, **Edit**, **Rewrite** (AI), **Translate**, or **Schedule**
4. Approved posts publish immediately with interactive buttons

---

## 📊 Dashboard

Visit your Vercel URL to see the admin dashboard:
- **Overview** — Stats, top posts, channel status, workflow diagram
- **Channels** — Add/remove/manage source channels
- **Posts** — Search and filter all posts
- **Analytics** — Performance metrics and top post rankings

---

## 📁 Project Structure

```
new bot/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts      # Telegram bot webhook
│   │   ├── collect/route.ts      # Receives posts from collector
│   │   ├── schedule/route.ts     # Cron job for scheduled posts
│   │   ├── analytics/route.ts    # Dashboard analytics
│   │   ├── posts/route.ts        # Post CRUD
│   │   ├── channels/route.ts     # Channel CRUD
│   │   └── setup-webhook/route.ts # One-time webhook setup
│   ├── globals.css               # Design system
│   ├── layout.tsx
│   └── page.tsx                  # Admin dashboard
├── lib/
│   ├── firebase-admin.ts         # Firebase Admin SDK
│   ├── firebase-client.ts        # Firebase Web SDK
│   ├── db.ts                     # All Firestore operations
│   ├── ai.ts                     # OpenAI processing
│   ├── publisher.ts              # Telegram publishing
│   └── bot.ts                    # Admin bot (grammY)
├── collector/
│   ├── main.py                   # Python Telethon collector
│   └── requirements.txt
├── vercel.json                   # Cron job config
├── .env                          # Your secrets
└── README.md
```

---

## 🔒 Firestore Collections

| Collection | Purpose |
|---|---|
| `channels` | Source channels to monitor |
| `posts` | All collected posts + review state |
| `likes` | One record per user-post like |
| `favorites` | User saved posts |
| `attendance` | Going/NotGoing records per event post |
| `schedules` | Scheduled publish queue |
| `users` | Telegram user records |
| `analytics` | Aggregated metrics per post |

---

## 🛠️ Interactive Post Buttons

Every published post gets:
- 👍 **Like** — toggle, counted per user
- ❤️ **Favorite** — save to personal collection
- ✅ **Going** — for event posts only
- ❌ **Not Going** — for event posts only
- 📤 **Share** — forward message
- 📌 **Save** — bookmark
- 🔔 **Follow** — channel follow

Counts update in real-time on the button labels.

---

## 🤖 AI Features (requires OpenAI key)

- **Auto-rewrite** — Rewrites posts in professional style
- **Summarize** — 2-3 sentence summary
- **Translate** — Any language to English (or custom)
- **Grammar fix** — Correct spelling/grammar
- **Generate hashtags** — 5 relevant hashtags
- **Spam detection** — Auto-reject spam posts
- **Auto-categorize** — Detect category (Tech, Sports, etc.)

---

## ⏰ Scheduling

Schedule posts for:
- ⏰ 30 minutes
- ⏰ 1 hour
- ⏰ Tomorrow (24h)
- Custom — via `/schedule` command

Vercel Cron runs every minute to check and publish due posts.

---

## 📢 Multiple Channel Publishing

To publish to multiple channels, set targets in `.env`:
```env
MAIN_CHANNEL_ID=@your_main_channel
ENGLISH_CHANNEL_ID=@your_english_channel
VIP_CHANNEL_ID=@your_vip_channel
```

---

## ⚠️ Important Notes

1. **Terms of Service** — Respect Telegram's ToS when reposting. Always credit sources.
2. **Session File** — The `collector_session.session` file contains your Telegram auth. Keep it private!
3. **Rate Limits** — Telegram has API rate limits. Don't collect too many channels at once.
4. **The collector runs separately** — Vercel cannot run Python. Host the collector on a VPS or your local machine.

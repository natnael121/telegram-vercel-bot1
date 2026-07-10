/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.telegram.org' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    ],
  },
  outputFileTracingRoot: path.join(__dirname),
  typescript: {
    // Disable type checking during build since we run it separately.
    ignoreBuildErrors: true,
  },
  env: {
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
  },
};

module.exports = nextConfig;

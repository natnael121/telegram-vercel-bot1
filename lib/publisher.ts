// ============================================================
//  Telegram Publisher Service - Sends posts to channels
// ============================================================
import axios from 'axios';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

export function buildPostKeyboard(
  postId: string,
  likes: number,
  favorites: number,
  going: number,
  notGoing: number,
  isEvent = false
): InlineKeyboard {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (isEvent) {
    rows.push([
      { text: `✅ Going (${going})`, callback_data: `att_going_${postId}` },
      { text: `❌ Not Going (${notGoing})`, callback_data: `att_notgoing_${postId}` },
    ]);
  }

  rows.push([
    { text: `👍 ${likes}`, callback_data: `like_${postId}` },
    { text: `❤️ ${favorites}`, callback_data: `fav_${postId}` },
  ]);

  rows.push([
    { text: `📤 Share`, callback_data: `share_${postId}` },
    { text: `📌 Save`, callback_data: `save_${postId}` },
    { text: `🔔 Follow`, callback_data: `follow_${postId}` },
  ]);

  return { inline_keyboard: rows };
}

export const telegramPublisher = {
  async sendText(chatId: string | number, text: string, keyboard?: InlineKeyboard): Promise<number> {
    const res = await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return res.data.result.message_id;
  },

  async sendPhoto(chatId: string | number, photoUrl: string, caption: string, keyboard?: InlineKeyboard): Promise<number> {
    const res = await axios.post(`${TG_API}/sendPhoto`, {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return res.data.result.message_id;
  },

  async sendVideo(chatId: string | number, videoUrl: string, caption: string, keyboard?: InlineKeyboard): Promise<number> {
    const res = await axios.post(`${TG_API}/sendVideo`, {
      chat_id: chatId,
      video: videoUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return res.data.result.message_id;
  },

  async sendDocument(chatId: string | number, docUrl: string, caption: string, keyboard?: InlineKeyboard): Promise<number> {
    const res = await axios.post(`${TG_API}/sendDocument`, {
      chat_id: chatId,
      document: docUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return res.data.result.message_id;
  },

  async sendVoice(chatId: string | number, voiceUrl: string, caption: string, keyboard?: InlineKeyboard): Promise<number> {
    const res = await axios.post(`${TG_API}/sendVoice`, {
      chat_id: chatId,
      voice: voiceUrl,
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return res.data.result.message_id;
  },

  async sendMediaGroup(chatId: string | number, mediaUrls: string[], caption: string): Promise<number> {
    const media = mediaUrls.map((url, i) => ({
      type: 'photo',
      media: url,
      caption: i === 0 ? caption : undefined,
      parse_mode: i === 0 ? 'HTML' : undefined,
    }));
    const res = await axios.post(`${TG_API}/sendMediaGroup`, {
      chat_id: chatId,
      media,
    });
    return res.data.result[0].message_id;
  },

  async sendPoll(chatId: string | number, question: string, options: string[], isAnonymous = true): Promise<number> {
    const res = await axios.post(`${TG_API}/sendPoll`, {
      chat_id: chatId,
      question,
      options,
      is_anonymous: isAnonymous,
    });
    return res.data.result.message_id;
  },

  async editMessageReplyMarkup(chatId: string | number, messageId: number, keyboard: InlineKeyboard): Promise<void> {
    await axios.post(`${TG_API}/editMessageReplyMarkup`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: keyboard,
    });
  },

  async notifyAdmin(text: string): Promise<void> {
    const adminId = process.env.ADMIN_CHAT_ID;
    if (!adminId) return;
    await axios.post(`${TG_API}/sendMessage`, {
      chat_id: adminId,
      text,
      parse_mode: 'HTML',
    });
  },

  async publishPost(post: {
    id: string;
    caption: string;
    review?: string;
    mediaUrl?: string | null;
    mediaType: string;
    mediaUrls?: string[];
    isEvent?: boolean;
    pollData?: { question: string; options: string[] };
  }, targetChannel: string, analytics: {
    likes: number;
    favorites: number;
    going: number;
    notGoing: number;
  }): Promise<number> {
    const keyboard = buildPostKeyboard(
      post.id,
      analytics.likes,
      analytics.favorites,
      analytics.going,
      analytics.notGoing,
      post.isEvent
    );

    let fullText = post.caption;
    if (post.review) {
      fullText += `\n\n━━━━━━━━━━━━━━\n💬 <b>My Review</b>\n${post.review}`;
    }

    switch (post.mediaType) {
      case 'photo':
        return await this.sendPhoto(targetChannel, post.mediaUrl!, fullText, keyboard);
      case 'video':
        return await this.sendVideo(targetChannel, post.mediaUrl!, fullText, keyboard);
      case 'document':
        return await this.sendDocument(targetChannel, post.mediaUrl!, fullText, keyboard);
      case 'voice':
        return await this.sendVoice(targetChannel, post.mediaUrl!, fullText, keyboard);
      case 'album':
        return await this.sendMediaGroup(targetChannel, post.mediaUrls || [], fullText);
      case 'poll':
        if (post.pollData) {
          return await this.sendPoll(targetChannel, post.pollData.question, post.pollData.options);
        }
        return await this.sendText(targetChannel, fullText, keyboard);
      default:
        return await this.sendText(targetChannel, fullText, keyboard);
    }
  },
};

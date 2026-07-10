// ============================================================
//  Main Admin Bot - grammY handler (Vercel webhook)
// ============================================================
import { Bot, Context, InlineKeyboard, session } from 'grammy';
import { channelService, postService, analyticsService, scheduleService, interactionService } from '../lib/db';
import { aiService } from '../lib/ai';
import { telegramPublisher, buildPostKeyboard } from '../lib/publisher';

export function createBot() {
  const bot = new Bot(process.env.BOT_TOKEN!);

  // ── Admin guard ──────────────────────────────────────────────────────────────
  const adminId = Number(process.env.ADMIN_CHAT_ID);
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== adminId) {
      await ctx.reply('⛔ Unauthorized.');
      return;
    }
    await next();
  });

  // ── /start ───────────────────────────────────────────────────────────────────
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `🤖 <b>Telegram Content Aggregator</b>\n\n` +
      `Welcome, ${ctx.from?.first_name}!\n\n` +
      `<b>Commands:</b>\n` +
      `/channels - Manage source channels\n` +
      `/pending - Review pending posts\n` +
      `/scheduled - View scheduled posts\n` +
      `/analytics - Dashboard stats\n` +
      `/search - Search posts\n` +
      `/publish - Manual publish\n` +
      `/settings - Bot settings\n` +
      `/help - Help`,
      { parse_mode: 'HTML' }
    );
  });

  // ── /help ────────────────────────────────────────────────────────────────────
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 <b>Help Guide</b>\n\n` +
      `<b>Channel Management:</b>\n` +
      `• /channels - List all channels\n` +
      `• /addchannel @username Category - Add channel\n` +
      `• /removechannel @username - Remove channel\n\n` +
      `<b>Post Management:</b>\n` +
      `• /pending - Review pending posts\n` +
      `• /scheduled - View scheduled queue\n` +
      `• /search keyword - Search posts\n\n` +
      `<b>Analytics:</b>\n` +
      `• /analytics - View dashboard stats\n\n` +
      `<b>Publishing:</b>\n` +
      `• /publish postId - Publish a specific post`,
      { parse_mode: 'HTML' }
    );
  });

  // ── /channels ────────────────────────────────────────────────────────────────
  bot.command('channels', async (ctx) => {
    const channels = await channelService.getAll();
    if (channels.length === 0) {
      await ctx.reply('📭 No channels added yet.\nUse /addchannel @username Category to add one.');
      return;
    }
    let text = `📡 <b>Source Channels (${channels.length})</b>\n\n`;
    const kb = new InlineKeyboard();
    for (const ch of channels.slice(0, 20)) {
      const status = ch.enabled ? '🟢' : '🔴';
      text += `${status} <b>${ch.title || ch.username}</b> — ${ch.category}\n`;
      text += `   ${ch.username} | Posts: ${ch.postCount || 0}\n\n`;
      kb.text(ch.enabled ? `🔴 Disable ${ch.username}` : `🟢 Enable ${ch.username}`, `ch_toggle_${ch.id}_${ch.enabled ? 0 : 1}`).row();
    }
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  // ── /addchannel ──────────────────────────────────────────────────────────────
  bot.command('addchannel', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    if (args.length < 1) {
      await ctx.reply('Usage: /addchannel @username [Category]\nExample: /addchannel @technews Technology');
      return;
    }
    const username = args[0];
    const category = args.slice(1).join(' ') || 'General';
    const existing = await channelService.findByUsername(username);
    if (existing) {
      await ctx.reply(`⚠️ Channel ${username} already exists.`);
      return;
    }
    await channelService.add(username, username, category);
    await ctx.reply(`✅ Added channel <b>${username}</b> in category <i>${category}</i>`, { parse_mode: 'HTML' });
  });

  // ── /removechannel ───────────────────────────────────────────────────────────
  bot.command('removechannel', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    if (!args[0]) {
      await ctx.reply('Usage: /removechannel @username');
      return;
    }
    const channel = await channelService.findByUsername(args[0]);
    if (!channel) {
      await ctx.reply(`❌ Channel ${args[0]} not found.`);
      return;
    }
    await channelService.remove(channel.id);
    await ctx.reply(`🗑️ Removed channel <b>${args[0]}</b>`, { parse_mode: 'HTML' });
  });

  // ── /pending ─────────────────────────────────────────────────────────────────
  bot.command('pending', async (ctx) => {
    const posts = await postService.getPending();
    if (posts.length === 0) {
      await ctx.reply('✅ No pending posts. All clear!');
      return;
    }
    await ctx.reply(`📬 <b>${posts.length} pending post(s)</b>\n\nSending first post for review...`, { parse_mode: 'HTML' });
    await sendPostForReview(ctx, posts[0]);
  });

  // ── /scheduled ───────────────────────────────────────────────────────────────
  bot.command('scheduled', async (ctx) => {
    const posts = await postService.getScheduled();
    if (posts.length === 0) {
      await ctx.reply('📅 No scheduled posts.');
      return;
    }
    let text = `⏰ <b>Scheduled Posts (${posts.length})</b>\n\n`;
    for (const p of posts.slice(0, 10)) {
      text += `• <b>${p.caption?.slice(0, 50)}...</b>\n`;
      text += `  Category: ${p.category} | Source: ${p.sourceChannel}\n\n`;
    }
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // ── /analytics ───────────────────────────────────────────────────────────────
  bot.command('analytics', async (ctx) => {
    const stats = await analyticsService.getDashboardStats();
    const topPosts = await analyticsService.getTopPosts(5);
    const text =
      `📊 <b>Analytics Dashboard</b>\n\n` +
      `📝 Total Posts: <b>${stats.totalPosts}</b>\n` +
      `⏳ Pending: <b>${stats.pendingPosts}</b>\n` +
      `✅ Published: <b>${stats.publishedPosts}</b>\n` +
      `📡 Active Channels: <b>${stats.totalChannels}</b>\n` +
      `👍 Total Likes: <b>${stats.totalLikes}</b>\n` +
      `👁️ Total Views: <b>${stats.totalViews}</b>\n\n` +
      `🏆 <b>Top Posts by Likes:</b>\n` +
      topPosts.map((p, i) => `${i + 1}. Post ${p.postId?.slice(0, 8)}... — 👍${p.likes} 👁️${p.views}`).join('\n');
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // ── /search ──────────────────────────────────────────────────────────────────
  bot.command('search', async (ctx) => {
    const q = ctx.message?.text?.split(' ').slice(1).join(' ');
    if (!q) {
      await ctx.reply('Usage: /search keyword\nExample: /search OpenAI');
      return;
    }
    const results = await postService.search({ caption: q });
    if (results.length === 0) {
      await ctx.reply(`🔍 No results for "${q}"`);
      return;
    }
    let text = `🔍 <b>Search: "${q}"</b> — ${results.length} result(s)\n\n`;
    for (const p of results.slice(0, 5)) {
      text += `• <b>${p.caption?.slice(0, 60)}...</b>\n`;
      text += `  [${p.status}] ${p.sourceChannel} | ${p.category}\n\n`;
    }
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  // ── /publish ─────────────────────────────────────────────────────────────────
  bot.command('publish', async (ctx) => {
    const postId = ctx.message?.text?.split(' ')[1];
    if (!postId) {
      await ctx.reply('Usage: /publish postId');
      return;
    }
    await publishPostNow(ctx, postId);
  });

  // ── /settings ────────────────────────────────────────────────────────────────
  bot.command('settings', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('🌐 Dashboard', 'settings_dashboard')
      .row()
      .text('📋 Categories', 'settings_categories')
      .text('🤖 AI Settings', 'settings_ai')
      .row()
      .text('📢 Publish Targets', 'settings_targets');
    await ctx.reply('⚙️ <b>Settings</b>\n\nWhat would you like to configure?', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  });

  // ── Callback Query Handler ───────────────────────────────────────────────────
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    await ctx.answerCallbackQuery();

    // Channel toggle
    if (data.startsWith('ch_toggle_')) {
      const [, , id, val] = data.split('_');
      await channelService.toggle(id, val === '1');
      await ctx.editMessageText(`✅ Channel ${val === '1' ? 'enabled' : 'disabled'}.`);
      return;
    }

    // Post approve
    if (data.startsWith('approve_')) {
      const postId = data.replace('approve_', '');
      await ctx.editMessageText(`✅ Approving post...`);
      await publishPostNow(ctx, postId);
      return;
    }

    // Post reject
    if (data.startsWith('reject_')) {
      const postId = data.replace('reject_', '');
      await postService.updateStatus(postId, 'rejected');
      await ctx.editMessageText(`❌ Post rejected.`);
      return;
    }

    // Edit caption
    if (data.startsWith('edit_caption_')) {
      const postId = data.replace('edit_caption_', '');
      await ctx.reply(`✏️ Send the new caption for post ${postId}:\n(Reply to this message)`);
      // Store in session for next message handler
      return;
    }

    // Add review
    if (data.startsWith('add_review_')) {
      const postId = data.replace('add_review_', '');
      await ctx.reply(`💬 Send your personal review for post ${postId}:\n(Reply to this message)`);
      return;
    }

    // AI Rewrite
    if (data.startsWith('ai_rewrite_')) {
      const postId = data.replace('ai_rewrite_', '');
      const post = await postService.getById(postId);
      if (!post) { await ctx.reply('Post not found.'); return; }
      await ctx.reply('🤖 Rewriting...');
      const rewritten = await aiService.rewrite(post.caption);
      await postService.updateCaption(postId, rewritten);
      await ctx.reply(`✅ Caption rewritten:\n\n${rewritten}\n\n/pending to continue reviewing.`);
      return;
    }

    // AI Translate
    if (data.startsWith('ai_translate_')) {
      const postId = data.replace('ai_translate_', '');
      const post = await postService.getById(postId);
      if (!post) { await ctx.reply('Post not found.'); return; }
      await ctx.reply('🌐 Translating to English...');
      const translated = await aiService.translate(post.caption);
      await postService.updateCaption(postId, translated);
      await ctx.reply(`✅ Translated:\n\n${translated}\n\n/pending to continue reviewing.`);
      return;
    }

    // Schedule options
    if (data.startsWith('schedule_')) {
      const [, delay, postId] = data.split('_');
      const delayMin = parseInt(delay);
      const publishTime = new Date(Date.now() + delayMin * 60 * 1000);
      const targets = [process.env.MAIN_CHANNEL_ID || ''];
      await scheduleService.create(postId, publishTime, targets.filter(Boolean));
      await ctx.editMessageText(`⏰ Post scheduled in ${delayMin} minutes.`);
      return;
    }

    // Delete post
    if (data.startsWith('delete_')) {
      const postId = data.replace('delete_', '');
      await postService.delete(postId);
      await ctx.editMessageText(`🗑️ Post deleted.`);
      return;
    }

    // Next post in queue
    if (data === 'next_post') {
      const posts = await postService.getPending();
      if (posts.length === 0) {
        await ctx.editMessageText('✅ No more pending posts!');
        return;
      }
      await sendPostForReview(ctx, posts[0]);
      return;
    }

    // Interactive buttons from published posts (likes, favorites, attendance)
    if (data.startsWith('like_')) {
      const postId = data.replace('like_', '');
      const result = await interactionService.toggleLike(postId, ctx.from!.id);
      await ctx.answerCallbackQuery(result.liked ? `👍 Liked! (${result.count})` : `Like removed.`);
      await updatePublishedPostKeyboard(postId);
      return;
    }

    if (data.startsWith('fav_')) {
      const postId = data.replace('fav_', '');
      const result = await interactionService.toggleFavorite(postId, ctx.from!.id);
      await ctx.answerCallbackQuery(result.saved ? '❤️ Saved to favorites!' : 'Removed from favorites.');
      return;
    }

    if (data.startsWith('att_')) {
      const parts = data.split('_');
      const status = parts[1] === 'going' ? 'going' : 'not_going';
      const postId = parts[2];
      const result = await interactionService.setAttendance(postId, ctx.from!.id, ctx.from?.username, ctx.from?.first_name, status as 'going' | 'not_going');
      await ctx.answerCallbackQuery(status === 'going' ? `✅ You're going! (${result.going})` : `❌ Not going. (${result.notGoing})`);
      await updatePublishedPostKeyboard(postId);
      return;
    }
  });

  // ── Helper: Send post for review ─────────────────────────────────────────────
  async function sendPostForReview(ctx: Context, post: Awaited<ReturnType<typeof postService.getPending>>[0]) {
    const text =
      `📨 <b>NEW POST FOR REVIEW</b>\n\n` +
      `📡 <b>Source:</b> ${post.sourceChannel}\n` +
      `🕐 <b>Time:</b> ${post.createdAt?.toDate?.()?.toLocaleString() || 'N/A'}\n` +
      `📂 <b>Category:</b> ${post.category}\n` +
      `🎬 <b>Media:</b> ${post.mediaType}\n\n` +
      `📝 <b>Caption:</b>\n${post.caption?.slice(0, 800) || '(no caption)'}`;

    const kb = new InlineKeyboard()
      .text('✅ Approve', `approve_${post.id}`)
      .text('❌ Reject', `reject_${post.id}`)
      .row()
      .text('✏️ Edit Caption', `edit_caption_${post.id}`)
      .text('💬 Add Review', `add_review_${post.id}`)
      .row()
      .text('🤖 Rewrite', `ai_rewrite_${post.id}`)
      .text('🌐 Translate', `ai_translate_${post.id}`)
      .row()
      .text('⏰ 30min', `schedule_30_${post.id}`)
      .text('⏰ 1hr', `schedule_60_${post.id}`)
      .text('⏰ Tomorrow', `schedule_1440_${post.id}`)
      .row()
      .text('🗑️ Delete', `delete_${post.id}`)
      .text('⏭️ Next', 'next_post');

    if (post.mediaUrl && post.mediaType === 'photo') {
      await ctx.replyWithPhoto(post.mediaUrl, { caption: text, parse_mode: 'HTML', reply_markup: kb });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  // ── Helper: Publish post immediately ────────────────────────────────────────
  async function publishPostNow(ctx: Context, postId: string) {
    const post = await postService.getById(postId);
    if (!post) {
      await ctx.reply('❌ Post not found.');
      return;
    }

    const targets = post.publishTargets?.length
      ? post.publishTargets
      : [process.env.MAIN_CHANNEL_ID!].filter(Boolean);

    const analytics = await interactionService.getAnalytics(postId) || {
      likes: 0, favorites: 0, going: 0, notGoing: 0
    };

    let msgId = 0;
    for (const target of targets) {
      try {
        msgId = await telegramPublisher.publishPost(post, target, {
          likes: analytics.likes || 0,
          favorites: analytics.favorites || 0,
          going: analytics.going || 0,
          notGoing: analytics.notGoing || 0,
        });
      } catch (e: any) {
        await ctx.reply(`❌ Failed to publish to ${target}: ${e.message}`);
      }
    }

    await postService.markPublished(postId, msgId);
    await ctx.reply(`✅ Published to ${targets.length} channel(s)!`);
  }

  // ── Helper: Update published post keyboard ────────────────────────────────
  async function updatePublishedPostKeyboard(postId: string) {
    const post = await postService.getById(postId);
    const analytics = await interactionService.getAnalytics(postId);
    if (!post || !post.telegramMessageId || !analytics) return;

    const kb = buildPostKeyboard(postId, analytics.likes, analytics.favorites, analytics.going, analytics.notGoing, post.isEvent);
    const target = (post.publishTargets?.[0] || process.env.MAIN_CHANNEL_ID)!;
    try {
      await telegramPublisher.editMessageReplyMarkup(target, post.telegramMessageId, kb);
    } catch (_) {}
  }

  return bot;
}

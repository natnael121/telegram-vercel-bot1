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

    // Channel toggle - quick operation
    if (data.startsWith('ch_toggle_')) {
      const [, , id, val] = data.split('_');
      await ctx.answerCallbackQuery({
        text: val === '1' ? '✅ Channel enabled' : '🔴 Channel disabled',
        show_alert: false
      });
      await channelService.toggle(id, val === '1');
      await ctx.editMessageText(`✅ Channel ${val === '1' ? 'enabled' : 'disabled'}.`);
      return;
    }

    // Post approve - long operation
    if (data.startsWith('approve_')) {
      const postId = data.replace('approve_', '');

      // ✅ Respond immediately to prevent timeout
      await ctx.answerCallbackQuery({
        text: '⏳ Publishing post...',
        show_alert: false
      });

      await ctx.editMessageText(`⏳ Publishing post ${postId}... Please wait.`);

      try {
        await publishPostNow(ctx, postId);
      } catch (error: any) {
        console.error(`Publish error: ${error.message}`);
        await ctx.reply(`❌ Failed to publish: ${error.message}`);
      }
      return;
    }

    // Post reject - quick operation
    if (data.startsWith('reject_')) {
      const postId = data.replace('reject_', '');
      await ctx.answerCallbackQuery({
        text: '❌ Post rejected',
        show_alert: false
      });
      await postService.updateStatus(postId, 'rejected');
      await ctx.editMessageText(`❌ Post rejected.`);
      return;
    }

    // Edit caption - quick operation
    if (data.startsWith('edit_caption_')) {
      const postId = data.replace('edit_caption_', '');
      await ctx.answerCallbackQuery({
        text: '✏️ Send new caption',
        show_alert: false
      });
      await ctx.reply(`✏️ Send the new caption for post ${postId}:\n(Reply to this message)`);
      return;
    }

    // Add review - quick operation
    if (data.startsWith('add_review_')) {
      const postId = data.replace('add_review_', '');
      await ctx.answerCallbackQuery({
        text: '💬 Send your review',
        show_alert: false
      });
      await ctx.reply(`💬 Send your personal review for post ${postId}:\n(Reply to this message)`);
      return;
    }

    // AI Rewrite - long operation
    if (data.startsWith('ai_rewrite_')) {
      const postId = data.replace('ai_rewrite_', '');

      await ctx.answerCallbackQuery({
        text: '🤖 AI is rewriting...',
        show_alert: false
      });

      await ctx.editMessageText(`🤖 Rewriting post ${postId}... Please wait.`);

      const post = await postService.getById(postId);
      if (!post) {
        await ctx.reply('Post not found.');
        return;
      }

      try {
        const rewritten = await aiService.rewrite(post.caption);
        await postService.updateCaption(postId, rewritten);
        await ctx.editMessageText(`✅ Caption rewritten:\n\n${rewritten}\n\nUse /pending to continue reviewing.`);
      } catch (error: any) {
        await ctx.reply(`❌ AI rewrite failed: ${error.message}`);
      }
      return;
    }

    // AI Translate - long operation
    if (data.startsWith('ai_translate_')) {
      const postId = data.replace('ai_translate_', '');

      await ctx.answerCallbackQuery({
        text: '🌐 Translating...',
        show_alert: false
      });

      await ctx.editMessageText(`🌐 Translating post ${postId}... Please wait.`);

      const post = await postService.getById(postId);
      if (!post) {
        await ctx.reply('Post not found.');
        return;
      }

      try {
        const translated = await aiService.translate(post.caption);
        await postService.updateCaption(postId, translated);
        await ctx.editMessageText(`✅ Translated:\n\n${translated}\n\nUse /pending to continue reviewing.`);
      } catch (error: any) {
        await ctx.reply(`❌ Translation failed: ${error.message}`);
      }
      return;
    }

    // Schedule - quick operation
    if (data.startsWith('schedule_')) {
      const [, delay, postId] = data.split('_');
      const delayMin = parseInt(delay);

      await ctx.answerCallbackQuery({
        text: `⏰ Scheduled in ${delayMin} minutes`,
        show_alert: false
      });

      const publishTime = new Date(Date.now() + delayMin * 60 * 1000);
      const targets = [process.env.MAIN_CHANNEL_ID || ''];
      await scheduleService.create(postId, publishTime, targets.filter(Boolean));
      await ctx.editMessageText(`⏰ Post scheduled in ${delayMin} minutes.`);
      return;
    }

    // Delete - quick operation
    if (data.startsWith('delete_')) {
      const postId = data.replace('delete_', '');

      await ctx.answerCallbackQuery({
        text: '🗑️ Post deleted',
        show_alert: false
      });

      await postService.delete(postId);
      await ctx.editMessageText(`🗑️ Post deleted.`);
      return;
    }

    // Next post - quick operation
    if (data === 'next_post') {
      await ctx.answerCallbackQuery({
        text: '⏭️ Loading next post...',
        show_alert: false
      });

      const posts = await postService.getPending();
      if (posts.length === 0) {
        await ctx.editMessageText('✅ No more pending posts!');
        return;
      }
      await sendPostForReview(ctx, posts[0]);
      return;
    }

    // Interactive buttons - quick operations
    if (data.startsWith('like_')) {
      const postId = data.replace('like_', '');
      const result = await interactionService.toggleLike(postId, ctx.from!.id);

      await ctx.answerCallbackQuery({
        text: result.liked ? `👍 Liked! (${result.count})` : 'Like removed.',
        show_alert: false
      });

      await updatePublishedPostKeyboard(postId);
      return;
    }

    if (data.startsWith('fav_')) {
      const postId = data.replace('fav_', '');
      const result = await interactionService.toggleFavorite(postId, ctx.from!.id);

      await ctx.answerCallbackQuery({
        text: result.saved ? '❤️ Saved to favorites!' : 'Removed from favorites.',
        show_alert: false
      });

      await updatePublishedPostKeyboard(postId);
      return;
    }

    if (data.startsWith('att_')) {
      const parts = data.split('_');
      const status = parts[1] === 'going' ? 'going' : 'not_going';
      const postId = parts[2];

      const result = await interactionService.setAttendance(
        postId,
        ctx.from!.id,
        ctx.from?.username,
        ctx.from?.first_name,
        status as 'going' | 'not_going'
      );

      await ctx.answerCallbackQuery({
        text: status === 'going' ? `✅ You're going! (${result.going})` : `❌ Not going. (${result.notGoing})`,
        show_alert: false
      });

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
      try {
        await ctx.replyWithPhoto(post.mediaUrl, { caption: text, parse_mode: 'HTML', reply_markup: kb });
      } catch (photoError: any) {
        console.error(`Failed to send photo for review: ${photoError.message}`);
        const fallbackText = `${text}\n\n⚠️ <i>Failed to load photo: ${post.mediaUrl}</i>`;
        await ctx.reply(fallbackText, { parse_mode: 'HTML', reply_markup: kb });
      }
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  // ── Helper: Publish post immediately ────────────────────────────────────────
  async function publishPostNow(ctx: Context, postId: string) {
    try {
      // Fetch post with retry logic
      let post = await postService.getById(postId);
      if (!post) {
        await ctx.reply('❌ Post not found.');
        return;
      }

      // Check if already published
      if (post.status === 'published') {
        await ctx.reply(`⚠️ Post ${postId} is already published.`);
        return;
      }

      // Get publish targets
      const targets = post.publishTargets?.length
        ? post.publishTargets
        : [process.env.MAIN_CHANNEL_ID!].filter(Boolean);

      if (targets.length === 0) {
        await ctx.reply('❌ No publish targets configured.');
        return;
      }

      // Get analytics
      const analytics = await interactionService.getAnalytics(postId) || {
        likes: 0,
        favorites: 0,
        going: 0,
        notGoing: 0
      };

      // Publish to each target
      let publishedCount = 0;
      let failedTargets: string[] = [];
      let lastMessageId = 0;

      // Send initial progress message
      const progressMsg = await ctx.reply(
        `📤 Publishing post to ${targets.length} channel(s)...\n` +
        `Progress: 0/${targets.length}`
      );

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        try {
          // Add timeout to prevent hanging
          const publishPromise = telegramPublisher.publishPost(post, target, {
            likes: analytics.likes || 0,
            favorites: analytics.favorites || 0,
            going: analytics.going || 0,
            notGoing: analytics.notGoing || 0,
          });

          const timeoutPromise = new Promise<number>((_, reject) => {
            setTimeout(() => reject(new Error('Publish timeout after 30 seconds')), 30000);
          });

          const msgId = await Promise.race([publishPromise, timeoutPromise]);
          lastMessageId = msgId;
          publishedCount++;

          // Update progress
          await ctx.api.editMessageText(
            ctx.chat!.id,
            progressMsg.message_id,
            `📤 Publishing post to ${targets.length} channel(s)...\n` +
            `Progress: ${publishedCount}/${targets.length}\n` +
            `✅ Published to: ${target}`
          );

        } catch (e: any) {
          failedTargets.push(target);
          console.error(`Failed to publish to ${target}:`, e.message);

          // Update progress with error
          await ctx.api.editMessageText(
            ctx.chat!.id,
            progressMsg.message_id,
            `📤 Publishing post to ${targets.length} channel(s)...\n` +
            `Progress: ${publishedCount}/${targets.length}\n` +
            `❌ Failed: ${target} - ${e.message}`
          );
        }

        // Small delay between publishes to avoid rate limiting
        if (i < targets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Final result
      if (publishedCount > 0) {
        // Mark as published with the last successful message ID
        await postService.markPublished(postId, lastMessageId);

        // Send final success message
        let resultText = `✅ Published to ${publishedCount}/${targets.length} channel(s)!`;
        if (failedTargets.length > 0) {
          resultText += `\n\n⚠️ Failed targets:\n${failedTargets.map(t => `• ${t}`).join('\n')}`;
        }
        await ctx.reply(resultText);

        // Notify admin about successful publish
        await telegramPublisher.notifyAdmin(
          `📢 <b>Post Published</b>\n` +
          `Post ID: ${postId}\n` +
          `Targets: ${publishedCount}/${targets.length}\n` +
          `Source: ${post.sourceChannel}`
        );

      } else {
        // All targets failed
        await ctx.reply(
          `❌ Failed to publish to all ${targets.length} channel(s).\n\n` +
          `Errors:\n${failedTargets.map(t => `• ${t}`).join('\n')}`
        );
      }

    } catch (error: any) {
      console.error('PublishPostNow error:', error);
      await ctx.reply(`❌ Unexpected error during publish: ${error.message}`);
    }
  }

  // ── Helper: Update published post keyboard ────────────────────────────────
  async function updatePublishedPostKeyboard(postId: string) {
    try {
      // Fetch post and analytics in parallel for better performance
      const [post, analytics] = await Promise.all([
        postService.getById(postId),
        interactionService.getAnalytics(postId)
      ]);

      // Validate required data
      if (!post || !post.telegramMessageId || !analytics) {
        console.warn(`Cannot update keyboard for post ${postId}: missing required data`);
        return;
      }

      // Build keyboard with current stats
      const kb = buildPostKeyboard(
        postId,
        analytics.likes || 0,
        analytics.favorites || 0,
        analytics.going || 0,
        analytics.notGoing || 0,
        post.isEvent || false
      );

      // Get the target channel
      const target = (post.publishTargets?.[0] || process.env.MAIN_CHANNEL_ID)!;
      if (!target) {
        console.warn(`Cannot update keyboard for post ${postId}: no target channel`);
        return;
      }

      // Update the message with retry logic
      let retries = 3;
      let lastError: any = null;

      while (retries > 0) {
        try {
          await telegramPublisher.editMessageReplyMarkup(target, post.telegramMessageId, kb);
          return; // Success - exit function
        } catch (error: any) {
          lastError = error;
          retries--;

          // If it's a "message not found" error, don't retry
          if (error.response?.data?.description?.includes('message to edit not found')) {
            console.warn(`Message ${post.telegramMessageId} not found in channel ${target}`);
            return;
          }

          // Wait before retry with exponential backoff
          if (retries > 0) {
            const delay = Math.pow(2, 3 - retries) * 1000;
            console.log(`Retrying keyboard update for post ${postId} (${retries} retries left)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // If we get here, all retries failed
      console.error(`Failed to update keyboard for post ${postId} after 3 attempts:`, lastError);

    } catch (error: any) {
      console.error(`updatePublishedPostKeyboard error for post ${postId}:`, error);
    }
  }

  return bot;
}
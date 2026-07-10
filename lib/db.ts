// ============================================================
//  Firestore Database Service - All CRUD operations
// ============================================================
import { db } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  username: string;
  title: string;
  enabled: boolean;
  category: string;
  createdAt: Timestamp;
  postCount?: number;
  lastPostAt?: Timestamp;
}

export interface Post {
  id: string;
  sourceChannel: string;
  messageId: number;
  caption: string;
  originalCaption: string;
  review: string;
  mediaUrl: string | null;
  mediaType: 'photo' | 'video' | 'gif' | 'document' | 'voice' | 'album' | 'poll' | 'text';
  mediaUrls?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'published';
  published: boolean;
  telegramMessageId?: number;
  category: string;
  publishTargets?: string[];
  isEvent?: boolean;
  pollData?: PollData;
  sourceLink?: string;
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface PollData {
  question: string;
  options: string[];
}

export interface Like {
  id?: string;
  postId: string;
  userId: number;
  createdAt: Timestamp;
}

export interface Favorite {
  id?: string;
  postId: string;
  userId: number;
  createdAt: Timestamp;
}

export interface Attendance {
  id?: string;
  postId: string;
  userId: number;
  username?: string;
  firstName?: string;
  status: 'going' | 'not_going' | 'maybe';
  createdAt: Timestamp;
}

export interface Schedule {
  id?: string;
  postId: string;
  publishTime: Timestamp;
  published: boolean;
  targets: string[];
}

export interface TgUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  joinedAt: Timestamp;
}

export interface Analytics {
  postId: string;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  going: number;
  notGoing: number;
  maybe: number;
  favorites: number;
  updatedAt: Timestamp;
}

// ─── Channel Operations ───────────────────────────────────────────────────────

export const channelService = {
  async getAll(): Promise<Channel[]> {
    const snap = await db.collection('channels').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Channel));
  },

  async getEnabled(): Promise<Channel[]> {
    const snap = await db.collection('channels').where('enabled', '==', true).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Channel));
  },

  async add(username: string, title: string, category: string): Promise<string> {
    const ref = await db.collection('channels').add({
      username: username.startsWith('@') ? username : `@${username}`,
      title,
      enabled: true,
      category,
      createdAt: FieldValue.serverTimestamp(),
      postCount: 0,
    });
    return ref.id;
  },

  async remove(id: string): Promise<void> {
    await db.collection('channels').doc(id).delete();
  },

  async toggle(id: string, enabled: boolean): Promise<void> {
    await db.collection('channels').doc(id).update({ enabled });
  },

  async findByUsername(username: string): Promise<Channel | null> {
    const q = username.startsWith('@') ? username : `@${username}`;
    const snap = await db.collection('channels').where('username', '==', q).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Channel;
  },

  async incrementPostCount(username: string): Promise<void> {
    const channel = await this.findByUsername(username);
    if (channel) {
      await db.collection('channels').doc(channel.id).update({
        postCount: FieldValue.increment(1),
        lastPostAt: FieldValue.serverTimestamp(),
      });
    }
  },
};

// ─── Post Operations ──────────────────────────────────────────────────────────

export const postService = {
  async getAll(limit = 50): Promise<Post[]> {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  },

  async getPending(): Promise<Post[]> {
    const snap = await db.collection('posts')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  },

  async getScheduled(): Promise<Post[]> {
    const snap = await db.collection('posts')
      .where('status', '==', 'scheduled')
      .where('published', '==', false)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  },

  async getById(id: string): Promise<Post | null> {
    const doc = await db.collection('posts').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Post;
  },

  async create(data: Omit<Post, 'id' | 'createdAt'>): Promise<string> {
    const ref = await db.collection('posts').add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
    // Init analytics
    await db.collection('analytics').doc(ref.id).set({
      postId: ref.id,
      likes: 0, shares: 0, comments: 0, views: 0,
      going: 0, notGoing: 0, maybe: 0, favorites: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  async updateStatus(id: string, status: Post['status']): Promise<void> {
    await db.collection('posts').doc(id).update({ status });
  },

  async updateCaption(id: string, caption: string): Promise<void> {
    await db.collection('posts').doc(id).update({ caption });
  },

  async updateReview(id: string, review: string): Promise<void> {
    await db.collection('posts').doc(id).update({ review });
  },

  async markPublished(id: string, telegramMessageId: number): Promise<void> {
    await db.collection('posts').doc(id).update({
      status: 'published',
      published: true,
      telegramMessageId,
      publishedAt: FieldValue.serverTimestamp(),
    });
  },

  async checkDuplicate(sourceChannel: string, messageId: number): Promise<boolean> {
    const snap = await db.collection('posts')
      .where('sourceChannel', '==', sourceChannel)
      .where('messageId', '==', messageId)
      .limit(1)
      .get();
    return !snap.empty;
  },

  async search(filters: {
    caption?: string;
    category?: string;
    status?: string;
    mediaType?: string;
    sourceChannel?: string;
  }): Promise<Post[]> {
    let q: FirebaseFirestore.Query = db.collection('posts');
    if (filters.status) q = q.where('status', '==', filters.status);
    if (filters.category) q = q.where('category', '==', filters.category);
    if (filters.mediaType) q = q.where('mediaType', '==', filters.mediaType);
    if (filters.sourceChannel) q = q.where('sourceChannel', '==', filters.sourceChannel);
    const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
    let posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
    if (filters.caption) {
      const kw = filters.caption.toLowerCase();
      posts = posts.filter(p => p.caption?.toLowerCase().includes(kw));
    }
    return posts;
  },

  async delete(id: string): Promise<void> {
    await db.collection('posts').doc(id).delete();
    await db.collection('analytics').doc(id).delete();
  },
};

// ─── Interaction Operations ───────────────────────────────────────────────────

export const interactionService = {
  // Likes
  async toggleLike(postId: string, userId: number): Promise<{ liked: boolean; count: number }> {
    const likeId = `${postId}_${userId}`;
    const likeRef = db.collection('likes').doc(likeId);
    const doc = await likeRef.get();

    if (doc.exists) {
      await likeRef.delete();
      const analyticsRef = db.collection('analytics').doc(postId);
      await analyticsRef.update({ likes: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      const anal = await analyticsRef.get();
      return { liked: false, count: anal.data()?.likes || 0 };
    } else {
      await likeRef.set({ postId, userId, createdAt: FieldValue.serverTimestamp() });
      const analyticsRef = db.collection('analytics').doc(postId);
      await analyticsRef.update({ likes: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      const anal = await analyticsRef.get();
      return { liked: true, count: anal.data()?.likes || 0 };
    }
  },

  async hasLiked(postId: string, userId: number): Promise<boolean> {
    const doc = await db.collection('likes').doc(`${postId}_${userId}`).get();
    return doc.exists;
  },

  // Favorites
  async toggleFavorite(postId: string, userId: number): Promise<{ saved: boolean }> {
    const favId = `${postId}_${userId}`;
    const favRef = db.collection('favorites').doc(favId);
    const doc = await favRef.get();
    if (doc.exists) {
      await favRef.delete();
      await db.collection('analytics').doc(postId).update({ favorites: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      return { saved: false };
    } else {
      await favRef.set({ postId, userId, createdAt: FieldValue.serverTimestamp() });
      await db.collection('analytics').doc(postId).update({ favorites: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      return { saved: true };
    }
  },

  // Attendance
  async setAttendance(postId: string, userId: number, username: string | undefined, firstName: string | undefined, status: 'going' | 'not_going' | 'maybe'): Promise<{ going: number; notGoing: number; maybe: number }> {
    const attId = `${postId}_${userId}`;
    const attRef = db.collection('attendance').doc(attId);
    const existing = await attRef.get();
    const analyticsRef = db.collection('analytics').doc(postId);

    if (existing.exists) {
      const prev = existing.data()?.status;
      if (prev === status) {
        // Remove (toggle off)
        await attRef.delete();
        const field = status === 'going' ? 'going' : status === 'not_going' ? 'notGoing' : 'maybe';
        await analyticsRef.update({ [field]: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() });
      } else {
        // Change
        const prevField = prev === 'going' ? 'going' : prev === 'not_going' ? 'notGoing' : 'maybe';
        const newField = status === 'going' ? 'going' : status === 'not_going' ? 'notGoing' : 'maybe';
        await attRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
        await analyticsRef.update({
          [prevField]: FieldValue.increment(-1),
          [newField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      await attRef.set({ postId, userId, username, firstName, status, createdAt: FieldValue.serverTimestamp() });
      const field = status === 'going' ? 'going' : status === 'not_going' ? 'notGoing' : 'maybe';
      await analyticsRef.update({ [field]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    }

    const anal = await analyticsRef.get();
    const d = anal.data();
    return { going: d?.going || 0, notGoing: d?.notGoing || 0, maybe: d?.maybe || 0 };
  },

  async getAnalytics(postId: string): Promise<Analytics | null> {
    const doc = await db.collection('analytics').doc(postId).get();
    if (!doc.exists) return null;
    return doc.data() as Analytics;
  },
};

// ─── Schedule Operations ──────────────────────────────────────────────────────

export const scheduleService = {
  async create(postId: string, publishTime: Date, targets: string[]): Promise<string> {
    const ref = await db.collection('schedules').add({
      postId,
      publishTime: Timestamp.fromDate(publishTime),
      published: false,
      targets,
      createdAt: FieldValue.serverTimestamp(),
    });
    await postService.updateStatus(postId, 'scheduled');
    return ref.id;
  },

  async getDue(): Promise<(Schedule & { id: string })[]> {
    const now = Timestamp.now();
    const snap = await db.collection('schedules')
      .where('published', '==', false)
      .where('publishTime', '<=', now)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule & { id: string }));
  },

  async markDone(id: string): Promise<void> {
    await db.collection('schedules').doc(id).update({ published: true });
  },
};

// ─── User Operations ──────────────────────────────────────────────────────────

export const userService = {
  async upsert(user: Omit<TgUser, 'joinedAt'>): Promise<void> {
    const ref = db.collection('users').doc(String(user.telegramId));
    await ref.set({ ...user, joinedAt: FieldValue.serverTimestamp() }, { merge: true });
  },
};

// ─── Analytics Operations ─────────────────────────────────────────────────────

export const analyticsService = {
  async getTopPosts(limit = 10): Promise<Analytics[]> {
    const snap = await db.collection('analytics').orderBy('likes', 'desc').limit(limit).get();
    return snap.docs.map(d => d.data() as Analytics);
  },

  async getDashboardStats(): Promise<{
    totalPosts: number;
    pendingPosts: number;
    publishedPosts: number;
    totalChannels: number;
    totalLikes: number;
    totalViews: number;
  }> {
    const [posts, pending, published, channels, analytics] = await Promise.all([
      db.collection('posts').count().get(),
      db.collection('posts').where('status', '==', 'pending').count().get(),
      db.collection('posts').where('status', '==', 'published').count().get(),
      db.collection('channels').where('enabled', '==', true).count().get(),
      db.collection('analytics').get(),
    ]);

    let totalLikes = 0, totalViews = 0;
    analytics.docs.forEach(d => {
      const data = d.data();
      totalLikes += data.likes || 0;
      totalViews += data.views || 0;
    });

    return {
      totalPosts: posts.data().count,
      pendingPosts: pending.data().count,
      publishedPosts: published.data().count,
      totalChannels: channels.data().count,
      totalLikes,
      totalViews,
    };
  },
};

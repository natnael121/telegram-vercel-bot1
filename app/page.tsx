'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────
interface Stats {
  totalPosts: number;
  pendingPosts: number;
  publishedPosts: number;
  totalChannels: number;
  totalLikes: number;
  totalViews: number;
}

interface TopPost {
  postId: string;
  likes: number;
  views: number;
  going: number;
  notGoing: number;
  favorites: number;
  sourceChannel?: string;
  createdAt?: { _seconds: number } | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}


interface Channel {
  id: string;
  username: string;
  title: string;
  enabled: boolean;
  category: string;
  postCount?: number;
}

interface Post {
  id: string;
  sourceChannel: string;
  caption: string;
  originalCaption?: string;
  review?: string;
  mediaUrl?: string;
  mediaType: string;
  mediaUrls?: string[];
  status: string;
  category: string;
  publishTargets?: string[];
  isEvent?: boolean;
  createdAt?: { _seconds: number };
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  leaving?: boolean;
}

// ─── Toast System ──────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 4000);
  }, []);
  return { toasts, addToast };
}

// ─── Main Dashboard ────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'posts' | 'scheduled' | 'analytics'>('overview');
  const [loading, setLoading] = useState(true);
  const [addChannelForm, setAddChannelForm] = useState({ username: '', category: 'General' });
  const [addingChannel, setAddingChannel] = useState(false);
  const { toasts, addToast } = useToasts();

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [analyticsRes, channelsRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/channels'),
      ]);
      const analyticsData = await analyticsRes.json();
      const channelsData = await channelsRes.json();
      setStats(analyticsData.stats);
      setTopPosts(analyticsData.topPosts || []);
      setChannels(channelsData.channels || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function addChannel() {
    if (!addChannelForm.username) return;
    setAddingChannel(true);
    try {
      await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addChannelForm),
      });
      setAddChannelForm({ username: '', category: 'General' });
      addToast('✅ Channel added successfully', 'success');
      await fetchData();
    } catch {
      addToast('❌ Failed to add channel', 'error');
    } finally {
      setAddingChannel(false);
    }
  }

  async function removeChannel(id: string) {
    if (!confirm('Remove this channel?')) return;
    await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
    addToast('🗑️ Channel removed', 'success');
    await fetchData();
  }

  async function toggleChannel(id: string, enabled: boolean) {
    try {
      await fetch('/api/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, enabled } : ch));
      addToast(enabled ? '🟢 Channel enabled' : '🔴 Channel disabled', 'success');
    } catch {
      addToast('❌ Failed to toggle channel', 'error');
    }
  }

  const categories = ['General', 'Technology', 'Sports', 'Crypto', 'News', 'Business', 'Entertainment', 'Health', 'Ethiopia'];

  return (
    <div className="layout">
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} ${t.leaving ? 'leaving' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="nav-logo">
          <div className="nav-logo-icon">📡</div>
          <div className="nav-logo-text">
            <h2>TG Aggregator</h2>
            <p>Admin Dashboard</p>
          </div>
        </div>

        <nav style={{ padding: '16px 12px', flex: 1 }}>
          <div className="nav-section">
            <span className="nav-section-label">Main</span>
          </div>
          {[
            { key: 'overview', icon: '📊', label: 'Overview' },
            { key: 'channels', icon: '📡', label: 'Channels', badge: channels.length },
            { key: 'posts', icon: '📝', label: 'Posts', badge: stats?.pendingPosts || 0, badgeClass: 'orange' },
            { key: 'scheduled', icon: '⏰', label: 'Scheduled' },
            { key: 'analytics', icon: '📈', label: 'Analytics' },
          ].map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key as typeof activeTab)}
              style={{ width: '100%', border: 'none', background: 'transparent' }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`nav-badge ${item.badgeClass || ''}`}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            🟢 Bot Active &nbsp;|&nbsp; Vercel Hosted
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
              {activeTab === 'overview' && '📊 Overview'}
              {activeTab === 'channels' && '📡 Source Channels'}
              {activeTab === 'posts' && '📝 Post Management'}
              {activeTab === 'scheduled' && '⏰ Scheduled Posts'}
              {activeTab === 'analytics' && '📈 Analytics'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Telegram Content Aggregator & Publisher
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchData}>🔄 Refresh</button>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--gradient-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              👤
            </div>
          </div>
        </div>

        <div className="page-content">
          {/* ── Overview Tab ─────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="animate-in">
              {/* Stats Grid */}
              <div className="stats-grid">
                {[
                  { label: 'Total Posts', value: stats?.totalPosts ?? '—', icon: '📝', variant: '', delta: '' },
                  { label: 'Pending Review', value: stats?.pendingPosts ?? '—', icon: '⏳', variant: 'amber', delta: 'Needs attention' },
                  { label: 'Published', value: stats?.publishedPosts ?? '—', icon: '✅', variant: 'green', delta: '' },
                  { label: 'Active Channels', value: stats?.totalChannels ?? '—', icon: '📡', variant: 'violet', delta: '' },
                  { label: 'Total Likes', value: stats?.totalLikes ?? '—', icon: '👍', variant: '', delta: '' },
                  { label: 'Total Views', value: stats?.totalViews ?? '—', icon: '👁️', variant: 'green', delta: '' },
                ].map((stat, i) => (
                  <div key={i} className={`stat-card ${stat.variant}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div className="num-label">{stat.label}</div>
                        <div className="num-big" style={{ marginTop: '8px' }}>
                          {loading ? <span className="skeleton" style={{ width: 60, height: 32, display: 'block', borderRadius: 6 }} /> : stat.value.toLocaleString()}
                        </div>
                        {stat.delta && <div className="num-delta up" style={{ marginTop: '8px' }}>{stat.delta}</div>}
                      </div>
                      <div style={{ fontSize: '28px', opacity: 0.7 }}>{stat.icon}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Two-col */}
              <div className="grid-2">
                {/* Top Posts */}
                <div className="card">
                  <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '16px' }}>🏆 Top Posts by Likes</h3>
                  {topPosts.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>No data yet</h3>
                      <p>Posts will appear here after publishing</p>
                    </div>
                  ) : topPosts.map((p, i) => (
                    <div key={p.postId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < topPosts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)', width: '20px', textAlign: 'center' }}>#{i + 1}</span>
                      
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                        {p.mediaUrl && p.mediaType === 'photo' ? (
                          <img src={p.mediaUrl} alt="post thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '18px' }}>{{ photo: '🖼️', video: '🎬', gif: '🎞️', document: '📄', voice: '🎙️', album: '🖼️', poll: '📊', text: '📝' }[p.mediaType || ''] || '📝'}</span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.sourceChannel || 'Unknown Channel'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {p.createdAt?._seconds ? new Date(p.createdAt._seconds * 1000).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        👍 {p.likes} &nbsp; 👁️ {p.views}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Channel Overview */}
                <div className="card">
                  <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '16px' }}>📡 Channel Status</h3>
                  {channels.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📡</div>
                      <h3>No channels</h3>
                      <p>Go to Channels tab to add one</p>
                    </div>
                  ) : channels.slice(0, 6).map((ch) => (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '10px' }}>{ch.enabled ? '🟢' : '🔴'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{ch.username}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ch.category} · {ch.postCount || 0} posts</div>
                      </div>
                      <span className={`badge badge-${ch.enabled ? 'approved' : 'rejected'}`}>
                        {ch.enabled ? 'Active' : 'Off'}
                      </span>
                    </div>
                  ))}
                  {channels.length > 6 && (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px', width: '100%' }} onClick={() => setActiveTab('channels')}>
                      View all {channels.length} channels →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Channels Tab ─────────────────────────────────── */}
          {activeTab === 'channels' && (
            <div className="animate-in">
              {/* Add Channel Form */}
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '16px' }}>➕ Add Source Channel</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    placeholder="@channelname"
                    value={addChannelForm.username}
                    onChange={e => setAddChannelForm(f => ({ ...f, username: e.target.value }))}
                    style={{ maxWidth: '240px' }}
                  />
                  <select
                    className="input"
                    value={addChannelForm.category}
                    onChange={e => setAddChannelForm(f => ({ ...f, category: e.target.value }))}
                    style={{ maxWidth: '200px' }}
                  >
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={addChannel} disabled={addingChannel}>
                    {addingChannel ? '⏳ Adding...' : '➕ Add Channel'}
                  </button>
                </div>
              </div>

              {/* Channels Table */}
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Channel</th>
                      <th>Category</th>
                      <th>Posts</th>
                      <th>Status</th>
                      <th>Toggle</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map(ch => (
                      <tr key={ch.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{ch.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ch.title}</div>
                        </td>
                        <td><span className="tag">{ch.category}</span></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ch.postCount || 0}</td>
                        <td>
                          <span className={`badge badge-${ch.enabled ? 'approved' : 'rejected'}`}>
                            {ch.enabled ? '🟢 Active' : '🔴 Disabled'}
                          </span>
                        </td>
                        <td>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={ch.enabled}
                              onChange={() => toggleChannel(ch.id, !ch.enabled)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeChannel(ch.id)}>
                              🗑️ Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {channels.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-state">
                            <div className="empty-state-icon">📡</div>
                            <h3>No channels added</h3>
                            <p>Add your first source channel above</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Posts Tab ─────────────────────────────────────── */}
          {activeTab === 'posts' && (
            <PostsTab addToast={addToast} onDataChange={fetchData} />
          )}

          {/* ── Scheduled Tab ────────────────────────────────── */}
          {activeTab === 'scheduled' && (
            <ScheduledTab addToast={addToast} />
          )}

          {/* ── Analytics Tab ─────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <AnalyticsTab stats={stats} topPosts={topPosts} />
          )}
        </div>
      </main>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   Posts Tab — Full Admin Bot Functionality
   ══════════════════════════════════════════════════════════════ */
function PostsTab({ addToast, onDataChange }: { addToast: (msg: string, type: Toast['type']) => void; onDataChange: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: 'edit_caption' | 'add_review'; postId: string; value: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);
    if (filters.q) params.set('q', filters.q);
    try {
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      setPosts(data.posts || []);
    } finally {
      setLoading(false);
    }
  }

  // ── Generic Post Action ──────────────────────────────────
  async function postAction(postId: string, action: string, extra: Record<string, any> = {}) {
    setActionLoading(prev => ({ ...prev, [postId]: action }));
    try {
      const res = await fetch('/api/posts/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      // Update local state
      switch (action) {
        case 'approve':
          if (data.status === 'published') {
            addToast(`✅ Published to ${data.publishedCount}/${data.totalTargets} channel(s)!`, 'success');
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'published' } : p));
          } else {
            addToast(`❌ Failed to publish: ${data.failedTargets?.join(', ')}`, 'error');
          }
          break;
        case 'reject':
          addToast('❌ Post rejected', 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'rejected' } : p));
          break;
        case 'edit_caption':
          addToast('✏️ Caption updated', 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: data.caption } : p));
          break;
        case 'add_review':
          addToast('💬 Review added', 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, review: data.review } : p));
          break;
        case 'ai_rewrite':
          addToast('🤖 Caption rewritten by AI', 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: data.caption } : p));
          break;
        case 'ai_translate':
          addToast('🌐 Caption translated', 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, caption: data.caption } : p));
          break;
        case 'schedule':
          addToast(`⏰ Scheduled in ${extra.delay} minutes`, 'success');
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'scheduled' } : p));
          break;
      }
      onDataChange();
    } catch (err: any) {
      addToast(`❌ ${err.message}`, 'error');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post permanently?')) return;
    setActionLoading(prev => ({ ...prev, [id]: 'delete' }));
    try {
      await fetch(`/api/posts?id=${id}`, { method: 'DELETE' });
      addToast('🗑️ Post deleted', 'success');
      setPosts(prev => prev.filter(p => p.id !== id));
      onDataChange();
    } catch {
      addToast('❌ Failed to delete', 'error');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function handleModalSave() {
    if (!modal) return;
    postAction(modal.postId, modal.type, modal.type === 'edit_caption' ? { caption: modal.value } : { review: modal.value });
    setModal(null);
  }

  const isLoading = (postId: string, action?: string) => {
    if (!action) return !!actionLoading[postId];
    return actionLoading[postId] === action;
  };

  const statusColors: Record<string, string> = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    published: 'badge-published',
    scheduled: 'badge-scheduled',
  };

  const mediaIcons: Record<string, string> = {
    photo: '🖼️', video: '🎬', gif: '🎞️', document: '📄', voice: '🎙️', album: '🖼️🖼️', poll: '📊', text: '📝',
  };

  const pendingPosts = posts.filter(p => p.status === 'pending');
  const otherPosts = posts.filter(p => p.status !== 'pending');

  // ── Action Buttons (reused in cards and expanded rows) ──
  function ActionButtons({ post }: { post: Post }) {
    const pid = post.id;
    return (
      <div className="review-card-actions">
        {/* Primary Actions */}
        {post.status !== 'published' && (
          <button className="btn btn-approve" disabled={isLoading(pid)} onClick={() => postAction(pid, 'approve')}>
            {isLoading(pid, 'approve') ? <><span className="spinner" /> Publishing...</> : '✅ Approve & Publish'}
          </button>
        )}
        {post.status !== 'rejected' && post.status !== 'published' && (
          <button className="btn btn-reject" disabled={isLoading(pid)} onClick={() => postAction(pid, 'reject')}>
            {isLoading(pid, 'reject') ? <><span className="spinner" /></> : '❌ Reject'}
          </button>
        )}

        {/* Edit Actions */}
        <button className="btn btn-edit" disabled={isLoading(pid)} onClick={() => setModal({ type: 'edit_caption', postId: pid, value: post.caption || '' })}>
          ✏️ Edit Caption
        </button>
        <button className="btn btn-edit" disabled={isLoading(pid)} onClick={() => setModal({ type: 'add_review', postId: pid, value: post.review || '' })}>
          💬 Add Review
        </button>

        {/* AI Actions */}
        <button className="btn btn-ai" disabled={isLoading(pid)} onClick={() => postAction(pid, 'ai_rewrite')}>
          {isLoading(pid, 'ai_rewrite') ? <><span className="spinner" /> Rewriting...</> : '🤖 AI Rewrite'}
        </button>
        <button className="btn btn-ai" disabled={isLoading(pid)} onClick={() => postAction(pid, 'ai_translate')}>
          {isLoading(pid, 'ai_translate') ? <><span className="spinner" /> Translating...</> : '🌐 AI Translate'}
        </button>

        {/* Schedule */}
        {post.status !== 'published' && post.status !== 'scheduled' && (
          <div className="schedule-group">
            <button className="btn btn-schedule" disabled={isLoading(pid)} onClick={() => postAction(pid, 'schedule', { delay: '30' })}>⏰ 30m</button>
            <button className="btn btn-schedule" disabled={isLoading(pid)} onClick={() => postAction(pid, 'schedule', { delay: '60' })}>⏰ 1hr</button>
            <button className="btn btn-schedule" disabled={isLoading(pid)} onClick={() => postAction(pid, 'schedule', { delay: '1440' })}>⏰ Tomorrow</button>
          </div>
        )}

        {/* Delete */}
        <button className="btn btn-danger btn-sm" disabled={isLoading(pid)} onClick={() => deletePost(pid)}>
          {isLoading(pid, 'delete') ? <><span className="spinner" /></> : '🗑️ Delete'}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.type === 'edit_caption' ? '✏️ Edit Caption' : '💬 Add Review'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <textarea
                value={modal.value}
                onChange={e => setModal(prev => prev ? { ...prev, value: e.target.value } : null)}
                placeholder={modal.type === 'edit_caption' ? 'Enter new caption...' : 'Enter your review...'}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleModalSave}>
                {modal.type === 'edit_caption' ? '✏️ Save Caption' : '💬 Save Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>🔍 Search Caption</label>
            <input className="input" placeholder="Search..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
          </div>
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Status</label>
            <select className="input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              {['pending', 'approved', 'scheduled', 'published', 'rejected'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '150px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Category</label>
            <select className="input" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
              <option value="">All</option>
              {['Technology', 'Sports', 'Crypto', 'News', 'Business', 'Entertainment', 'Health', 'Ethiopia'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={fetchPosts} disabled={loading}>
            {loading ? '⏳' : '🔍 Search'}
          </button>
          <div style={{ display: 'flex', gap: '4px', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0, border: 'none' }}
              onClick={() => setViewMode('cards')}
            >📋 Cards</button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 0, border: 'none' }}
              onClick={() => setViewMode('table')}
            >📊 Table</button>
          </div>
        </div>
      </div>

      {/* ── Card View ────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <div>
          {/* Pending Posts Section */}
          {pendingPosts.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '16px' }}>📬 Pending Review</h3>
                <span className="review-counter">⏳ {pendingPosts.length} post(s)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {pendingPosts.map((post, i) => (
                  <div key={post.id} className="review-card" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="review-card-header">
                      <span style={{ fontSize: '20px' }}>{mediaIcons[post.mediaType] || '📝'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Post from {post.sourceChannel}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {post.createdAt?._seconds ? new Date(post.createdAt._seconds * 1000).toLocaleString() : '—'}
                        </div>
                      </div>
                      <span className="badge badge-pending">Pending</span>
                    </div>

                    <div className="review-card-meta">
                      <div className="review-card-meta-item">📡 <strong>{post.sourceChannel}</strong></div>
                      <div className="review-card-meta-item">📂 <strong>{post.category}</strong></div>
                      <div className="review-card-meta-item">🎬 <strong>{post.mediaType}</strong></div>
                      <div className="review-card-meta-item">🔖 ID: <strong>{post.id.slice(0, 10)}...</strong></div>
                    </div>

                    <div className="review-card-body">
                      {post.mediaUrl && post.mediaType === 'photo' && (
                        <img src={post.mediaUrl} alt="Post media" className="review-card-media" loading="lazy" />
                      )}
                      <div className="review-card-caption">
                        {post.caption || '(no caption)'}
                      </div>
                      {post.review && (
                        <div className="review-card-review">
                          💬 <strong>Review:</strong> {post.review}
                        </div>
                      )}
                    </div>

                    <ActionButtons post={post} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other Posts */}
          {otherPosts.length > 0 && (
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '16px' }}>
                📋 All Posts {filters.status && `— ${filters.status}`}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {otherPosts.map(post => (
                  <div key={post.id} className="review-card">
                    <div
                      className="review-card-header"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                    >
                      <span style={{ fontSize: '18px' }}>{mediaIcons[post.mediaType] || '📝'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                          {post.caption?.slice(0, 100) || '(no caption)'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {post.sourceChannel} · {post.category} · {post.createdAt?._seconds ? new Date(post.createdAt._seconds * 1000).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      <span className={`badge ${statusColors[post.status] || ''}`}>{post.status}</span>
                      <span style={{ fontSize: '16px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expandedPost === post.id ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                    </div>

                    {expandedPost === post.id && (
                      <>
                        <div className="review-card-body">
                          {post.mediaUrl && post.mediaType === 'photo' && (
                            <img src={post.mediaUrl} alt="Post media" className="review-card-media" loading="lazy" />
                          )}
                          <div className="review-card-caption">
                            {post.caption || '(no caption)'}
                          </div>
                          {post.review && (
                            <div className="review-card-review">
                              💬 <strong>Review:</strong> {post.review}
                            </div>
                          )}
                        </div>
                        <ActionButtons post={post} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {posts.length === 0 && !loading && (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>No posts found</h3>
              <p>Try adjusting your filters or wait for the collector to bring new posts</p>
            </div>
          )}
        </div>
      )}

      {/* ── Table View ───────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Post</th>
                <th>Source</th>
                <th>Category</th>
                <th>Media</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(p => (
                <>
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedPost(expandedPost === p.id ? null : p.id)}>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.caption?.slice(0, 80) || '(no caption)'}
                      </div>
                      {p.review && <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '2px' }}>💬 Has review</div>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{p.sourceChannel}</td>
                    <td><span className="tag">{p.category}</span></td>
                    <td style={{ fontSize: '20px' }}>{mediaIcons[p.mediaType] || '📝'}</td>
                    <td><span className={`badge ${statusColors[p.status] || ''}`}>{p.status}</span></td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {p.createdAt?._seconds ? new Date(p.createdAt._seconds * 1000).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{expandedPost === p.id ? '▲' : '▼'}</span>
                    </td>
                  </tr>
                  {expandedPost === p.id && (
                    <tr key={`${p.id}-detail`} className="post-detail-row">
                      <td colSpan={7}>
                        <div className="post-detail-content">
                          {p.mediaUrl && p.mediaType === 'photo' && (
                            <img src={p.mediaUrl} alt="Post media" className="review-card-media" style={{ maxWidth: '400px' }} loading="lazy" />
                          )}
                          <div className="review-card-caption" style={{ marginBottom: '12px' }}>
                            {p.caption || '(no caption)'}
                          </div>
                          {p.review && (
                            <div className="review-card-review" style={{ marginBottom: '12px' }}>
                              💬 <strong>Review:</strong> {p.review}
                            </div>
                          )}
                          <ActionButtons post={p} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {posts.length === 0 && !loading && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>No posts found</h3>
                      <p>Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   Scheduled Tab — View Scheduled Posts
   ══════════════════════════════════════════════════════════════ */
function ScheduledTab({ addToast }: { addToast: (msg: string, type: Toast['type']) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchScheduled(); }, []);

  async function fetchScheduled() {
    setLoading(true);
    try {
      const res = await fetch('/api/posts?status=scheduled');
      const data = await res.json();
      setPosts(data.posts || []);
    } finally {
      setLoading(false);
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this scheduled post?')) return;
    try {
      await fetch(`/api/posts?id=${id}`, { method: 'DELETE' });
      addToast('🗑️ Scheduled post deleted', 'success');
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch {
      addToast('❌ Failed to delete', 'error');
    }
  }

  const mediaIcons: Record<string, string> = {
    photo: '🖼️', video: '🎬', gif: '🎞️', document: '📄', voice: '🎙️', album: '🖼️🖼️', poll: '📊', text: '📝',
  };

  if (loading) {
    return (
      <div className="animate-in">
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Loading scheduled posts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '16px' }}>⏰ Scheduled Posts</h3>
        <span className="review-counter" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)', color: 'var(--accent-violet)' }}>
          📅 {posts.length} post(s)
        </span>
        <button className="btn btn-ghost btn-sm" onClick={fetchScheduled} style={{ marginLeft: 'auto' }}>🔄 Refresh</button>
      </div>

      {posts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <h3>No scheduled posts</h3>
            <p>Schedule posts from the Posts tab using the ⏰ buttons</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.map(post => (
            <div key={post.id} className="review-card">
              <div className="review-card-header">
                <span style={{ fontSize: '20px' }}>{mediaIcons[post.mediaType] || '📝'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {post.caption?.slice(0, 100) || '(no caption)'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {post.sourceChannel} · {post.category}
                  </div>
                </div>
                <span className="badge badge-scheduled">Scheduled</span>
              </div>
              <div className="review-card-actions">
                <button className="btn btn-danger btn-sm" onClick={() => deletePost(post.id)}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   Analytics Tab
   ══════════════════════════════════════════════════════════════ */
function AnalyticsTab({ stats, topPosts }: { stats: Stats | null; topPosts: TopPost[] }) {
  const items = [
    { label: 'Total Posts', value: stats?.totalPosts ?? 0, icon: '📝', max: stats?.totalPosts ?? 1, variant: '' },
    { label: 'Published', value: stats?.publishedPosts ?? 0, icon: '✅', max: stats?.totalPosts ?? 1, variant: 'green' },
    { label: 'Pending', value: stats?.pendingPosts ?? 0, icon: '⏳', max: stats?.totalPosts ?? 1, variant: 'amber' },
    { label: 'Total Likes', value: stats?.totalLikes ?? 0, icon: '👍', max: stats?.totalLikes ?? 1, variant: '' },
    { label: 'Total Views', value: stats?.totalViews ?? 0, icon: '👁️', max: stats?.totalViews ?? 1, variant: 'green' },
    { label: 'Active Channels', value: stats?.totalChannels ?? 0, icon: '📡', max: 50, variant: 'violet' },
  ];

  return (
    <div className="animate-in">
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>📊 Performance Metrics</h3>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.icon} {item.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{item.value.toLocaleString()}</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${item.variant}`}
                  style={{ width: `${Math.min(100, (item.value / (item.max || 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🏆 Top Performing Posts</h3>
          {topPosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>No data yet</h3>
              <p>Publish posts and collect interactions</p>
            </div>
          ) : topPosts.map((p, i) => (
            <div key={p.postId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < topPosts.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)', width: '20px', textAlign: 'center' }}>#{i + 1}</span>
              
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                {p.mediaUrl && p.mediaType === 'photo' ? (
                  <img src={p.mediaUrl} alt="post thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '18px' }}>{{ photo: '🖼️', video: '🎬', gif: '🎞️', document: '📄', voice: '🎙️', album: '🖼️', poll: '📊', text: '📝' }[p.mediaType || ''] || '📝'}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.sourceChannel || 'Unknown Channel'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {p.createdAt?._seconds ? new Date(p.createdAt._seconds * 1000).toLocaleDateString() : '—'}
                </div>
              </div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                👍 {p.likes} &nbsp; 👁️ {p.views}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

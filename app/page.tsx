'use client';
import { useState, useEffect } from 'react';

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
}

interface Channel {
  id: string;
  username: string;
  title: string;
  enabled: boolean;
  category: string;
  postCount?: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'posts' | 'analytics'>('overview');
  const [loading, setLoading] = useState(true);
  const [addChannelForm, setAddChannelForm] = useState({ username: '', category: 'General' });
  const [addingChannel, setAddingChannel] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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
      await fetchData();
    } finally {
      setAddingChannel(false);
    }
  }

  async function removeChannel(id: string) {
    if (!confirm('Remove this channel?')) return;
    await fetch(`/api/channels?id=${id}`, { method: 'DELETE' });
    await fetchData();
  }

  const categories = ['General', 'Technology', 'Sports', 'Crypto', 'News', 'Business', 'Entertainment', 'Health', 'Ethiopia'];

  return (
    <div className="layout">
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

          <div className="nav-section" style={{ marginTop: 16 }}>
            <span className="nav-section-label">Quick Links</span>
          </div>
          {[
            { icon: '🤖', label: 'Setup Webhook', href: '#' },
            { icon: '📖', label: 'Collector Docs', href: '#collector' },
            { icon: '🔧', label: 'Settings', href: '#settings' },
          ].map(item => (
            <a key={item.label} href={item.href} className="nav-item">
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
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
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-muted)', width: '24px' }}>#{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{p.postId.slice(0, 12)}...</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          👍 {p.likes} &nbsp; 👁️ {p.views} &nbsp; ❤️ {p.favorites}
                        </div>
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

              {/* Workflow Guide */}
              <div className="card" style={{ marginTop: '24px' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🚀 System Workflow</h3>
                <div style={{ display: 'flex', gap: '0', overflowX: 'auto', padding: '4px 0' }}>
                  {[
                    { icon: '📡', label: 'Collector', desc: 'Python script reads public channels', color: 'var(--accent-blue)' },
                    { icon: '→', label: '', desc: '', color: 'transparent' },
                    { icon: '🗄️', label: 'Firestore', desc: 'Posts stored with status: pending', color: 'var(--accent-violet)' },
                    { icon: '→', label: '', desc: '', color: 'transparent' },
                    { icon: '🤖', label: 'Admin Bot', desc: 'Review, edit, approve via Telegram', color: 'var(--accent-cyan)' },
                    { icon: '→', label: '', desc: '', color: 'transparent' },
                    { icon: '📢', label: 'Publish', desc: 'Goes to your Telegram channels', color: 'var(--accent-green)' },
                    { icon: '→', label: '', desc: '', color: 'transparent' },
                    { icon: '📊', label: 'Analytics', desc: 'Real-time likes, views, attendance', color: 'var(--accent-amber)' },
                  ].map((step, i) => (
                    step.label === '' ? (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--text-muted)', fontSize: '20px' }}>→</div>
                    ) : (
                      <div key={i} style={{ flex: '0 0 auto', textAlign: 'center', padding: '16px 20px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', minWidth: '130px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>{step.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: step.color }}>{step.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>{step.desc}</div>
                      </div>
                    )
                  ))}
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
                        <td colSpan={5}>
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
            <PostsTab />
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

/* ── Posts Tab Component ────────────────────────────────────── */
function PostsTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', category: '', q: '' });
  const [loading, setLoading] = useState(false);

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

  async function deletePost(id: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/posts?id=${id}`, { method: 'DELETE' });
    await fetchPosts();
  }

  const statusColors: Record<string, string> = {
    pending: 'badge-pending',
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    published: 'badge-published',
    scheduled: 'badge-scheduled',
  };

  return (
    <div className="animate-in">
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
        </div>
      </div>

      {/* Table */}
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
              <tr key={p.id}>
                <td style={{ maxWidth: '280px' }}>
                  <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.caption?.slice(0, 80) || '(no caption)'}
                  </div>
                  {p.review && <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '2px' }}>💬 Has review</div>}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{p.sourceChannel}</td>
                <td><span className="tag">{p.category}</span></td>
                <td style={{ fontSize: '20px' }}>
                  {{ photo: '🖼️', video: '🎬', gif: '🎞️', document: '📄', voice: '🎙️', album: '🖼️🖼️', poll: '📊', text: '📝' }[p.mediaType as string] || '📝'}
                </td>
                <td><span className={`badge ${statusColors[p.status] || ''}`}>{p.status}</span></td>
                <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {p.createdAt?._seconds ? new Date(p.createdAt._seconds * 1000).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => deletePost(p.id)}>🗑️</button>
                </td>
              </tr>
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
    </div>
  );
}

/* ── Analytics Tab Component ──────────────────────────────────── */
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
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: i === 0 ? 'var(--gradient-amber)' : 'var(--gradient-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '14px',
              }}>
                #{i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Post {p.postId.slice(0, 10)}...</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  👍 {p.likes} &nbsp; 👁️ {p.views} &nbsp; ❤️ {p.favorites} &nbsp; ✅ {p.going}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bot Commands Reference */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: '20px', fontSize: '16px' }}>🤖 Admin Bot Commands</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {[
            { cmd: '/start', desc: 'Initialize bot' },
            { cmd: '/channels', desc: 'List source channels' },
            { cmd: '/addchannel @ch Cat', desc: 'Add a channel' },
            { cmd: '/removechannel @ch', desc: 'Remove channel' },
            { cmd: '/pending', desc: 'Review pending posts' },
            { cmd: '/scheduled', desc: 'View scheduled posts' },
            { cmd: '/analytics', desc: 'View stats in bot' },
            { cmd: '/search keyword', desc: 'Search posts' },
            { cmd: '/publish postId', desc: 'Publish specific post' },
            { cmd: '/settings', desc: 'Bot settings' },
            { cmd: '/help', desc: 'Help guide' },
          ].map(item => (
            <div key={item.cmd} style={{ background: 'var(--bg-surface)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{item.cmd}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

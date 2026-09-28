import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  MessageSquare,
  Activity,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Star,
  Smartphone,
  Monitor,
  Laptop,
  CheckCircle2,
  X,
  Clock,
  LogOut,
  Mail,
  Filter,
} from 'lucide-react';
import { AdminSession, AdminUserRecord, AdminFeedbackRecord, AdminStats } from '../types';
import { safeFetchJson } from '../utils/api';
import { formatBytes } from '../utils/format';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AdminSession;
  onLogout: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  session,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'feedback' | 'export'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      };

      const [statsRes, usersRes, feedbackRes] = await Promise.all([
        safeFetchJson<AdminStats>('/api/admin/stats', { headers }),
        safeFetchJson<{ totalUsers: number; onlineCount: number; users: AdminUserRecord[] }>('/api/admin/users', { headers }),
        safeFetchJson<{ totalSubmissions: number; feedback: AdminFeedbackRecord[] }>('/api/admin/feedback', { headers }),
      ]);

      if (statsRes.ok && statsRes.data) setStats(statsRes.data);
      if (usersRes.ok && usersRes.data) setUsers(usersRes.data.users);
      if (feedbackRes.ok && feedbackRes.data) setFeedback(feedbackRes.data.feedback);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback entry?')) return;
    try {
      const res = await safeFetchJson(`/api/admin/feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) {
        setFeedback((prev) => prev.filter((f) => f.id !== id));
        setActionMessage('Feedback entry deleted successfully.');
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch {
      alert('Failed to delete feedback entry.');
    }
  };

  const handleExportUsers = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(users, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `beamdrop_users_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleExportFeedback = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(feedback, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `beamdrop_feedback_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.deviceName?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  });

  const filteredFeedback = feedback.filter((f) => {
    if (ratingFilter !== 'all' && f.rating !== ratingFilter) return false;
    if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        f.feedbackText?.toLowerCase().includes(q) ||
        f.userEmail?.toLowerCase().includes(q) ||
        f.userName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-3xl border border-neutral-200/90 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-8 border-b border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  BeamDrop Administrator Console
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/20">
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Administrator: <strong className="text-neutral-800 dark:text-neutral-200 font-mono">{session.email}</strong> (Kaif Khan)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdminData}
              disabled={isLoading}
              title="Refresh all data"
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Log out from administrator session?')) {
                  onLogout();
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout Admin</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-neutral-950 text-neutral-950 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>System Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-neutral-950 text-neutral-950 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Every Tracked User ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'border-neutral-950 text-neutral-950 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>User Feedback & Ratings ({feedback.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-neutral-950 text-neutral-950 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Export & Diagnostics</span>
          </button>
        </div>

        {actionMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
            {actionMessage}
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-neutral-200 p-5 bg-gradient-to-br from-neutral-50 to-white dark:border-neutral-800 dark:from-neutral-800/40 dark:to-neutral-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Total Tracked Users</span>
                    <Users className="h-5 w-5 text-indigo-500" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-neutral-900 dark:text-white font-mono">
                    {stats?.totalTrackedUsers ?? users.length}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {users.filter((u) => u.status === 'online').length} currently active online
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5 bg-gradient-to-br from-neutral-50 to-white dark:border-neutral-800 dark:from-neutral-800/40 dark:to-neutral-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Feedback Submissions</span>
                    <MessageSquare className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-neutral-900 dark:text-white font-mono">
                    {stats?.totalFeedback ?? feedback.length}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500 font-medium">
                    Includes mandatory 2nd-usage reviews
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5 bg-gradient-to-br from-neutral-50 to-white dark:border-neutral-800 dark:from-neutral-800/40 dark:to-neutral-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Average Rating</span>
                    <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-neutral-900 dark:text-white font-mono">
                    {stats?.averageRating ?? '5.0'} / 5.0
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    Peer user satisfaction score
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5 bg-gradient-to-br from-neutral-50 to-white dark:border-neutral-800 dark:from-neutral-800/40 dark:to-neutral-900">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Active Rooms</span>
                    <Activity className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-neutral-900 dark:text-white font-mono">
                    {stats?.activeRooms ?? 0}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500 font-medium">
                    Real-time WebSocket & WebRTC meshes
                  </p>
                </div>
              </div>

              {/* Quick Recent Activity preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Users preview */}
                <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      <span>Recently Active Users</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      View All ({users.length})
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-60 overflow-y-auto">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} className="py-2.5 flex items-center justify-between">
                        <div className="truncate pr-3">
                          <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">
                            {u.name} {u.email ? `(${u.email})` : ''}
                          </p>
                          <p className="text-[11px] text-neutral-500 font-mono">
                            {u.deviceName} · {u.transferCount} transfers
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'online'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                        }`}>
                          {u.status}
                        </span>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <p className="py-6 text-center text-xs text-neutral-400">No user records tracked yet.</p>
                    )}
                  </div>
                </div>

                {/* Recent Feedback preview */}
                <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-amber-500" />
                      <span>Latest Feedback & Evaluations</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('feedback')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      View All ({feedback.length})
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-60 overflow-y-auto">
                    {feedback.slice(0, 5).map((f) => (
                      <div key={f.id} className="py-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < f.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-neutral-200 dark:text-neutral-700'
                                }`}
                              />
                            ))}
                            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 ml-1">
                              {f.category}
                            </span>
                          </div>
                          <span className="text-[10px] text-neutral-400">
                            {new Date(f.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 line-clamp-2">
                          "{f.feedbackText}"
                        </p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          From: {f.userName} ({f.userEmail})
                        </p>
                      </div>
                    ))}
                    {feedback.length === 0 && (
                      <p className="py-6 text-center text-xs text-neutral-400">No feedback submissions yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVERY TRACKED USER */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or device..."
                    className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 pl-9 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    Showing {filteredUsers.length} of {users.length} users
                  </span>
                  <button
                    onClick={handleExportUsers}
                    className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-bold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400">
                    <tr>
                      <th className="py-3 px-4">User / Peer</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Device</th>
                      <th className="py-3 px-4">Room</th>
                      <th className="py-3 px-4">Transfers</th>
                      <th className="py-3 px-4">Last Seen</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                        <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                            <span>{u.name || 'Anonymous User'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-300">
                          {u.email || <span className="text-neutral-400 italic">Not signed in</span>}
                        </td>
                        <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                          <div className="flex items-center gap-1.5">
                            {u.deviceType === 'mobile' ? (
                              <Smartphone className="h-3.5 w-3.5 text-neutral-400" />
                            ) : (
                              <Monitor className="h-3.5 w-3.5 text-neutral-400" />
                            )}
                            <span>{u.deviceName || 'Web Client'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-neutral-500">
                          {u.roomId || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                          {u.transferCount}
                        </td>
                        <td className="py-3 px-4 text-neutral-500">
                          {new Date(u.lastActive).toLocaleDateString()} {new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'online'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
                            <span className="capitalize">{u.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-neutral-400">
                          No users found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: USER FEEDBACK & EVALUATIONS */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-64">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search feedback content or email..."
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2 pl-9 text-xs text-neutral-900 focus:border-neutral-900 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  </div>

                  {/* Rating filter */}
                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="rounded-xl border border-neutral-300 bg-neutral-50 py-2 px-3 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="all">All Ratings (1-5)</option>
                    <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
                    <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
                    <option value="3">⭐⭐⭐ (3 Stars)</option>
                    <option value="2">⭐⭐ (2 Stars)</option>
                    <option value="1">⭐ (1 Star)</option>
                  </select>

                  {/* Category filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-xl border border-neutral-300 bg-neutral-50 py-2 px-3 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="suggestion">Suggestions</option>
                    <option value="evaluation">Evaluations</option>
                    <option value="bug">Bug Reports</option>
                    <option value="feature">Feature Requests</option>
                  </select>
                </div>

                <button
                  onClick={handleExportFeedback}
                  className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Feedback JSON</span>
                </button>
              </div>

              {/* Feedback List Cards */}
              <div className="space-y-3">
                {filteredFeedback.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-2xl border border-neutral-200 p-5 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < f.rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-neutral-200 dark:text-neutral-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 uppercase">
                            {f.category}
                          </span>
                          {f.isMandatorySecondUsage && (
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              ⚡ Mandatory 2nd Usage Feedback
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                          Submitted by: <strong className="text-neutral-900 dark:text-white">{f.userName}</strong> (
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{f.userEmail}</span>)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(f.submittedAt).toLocaleString()}</span>
                        </span>
                        <button
                          onClick={() => handleDeleteFeedback(f.id)}
                          title="Delete this feedback entry"
                          className="rounded-lg p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-neutral-800 dark:text-neutral-200 font-normal whitespace-pre-wrap">
                      {f.feedbackText}
                    </p>

                    {f.deviceInfo && (
                      <p className="mt-2 text-[10px] font-mono text-neutral-400 truncate">
                        Device / Client: {f.deviceInfo}
                      </p>
                    )}
                  </div>
                ))}

                {filteredFeedback.length === 0 && (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                    <MessageSquare className="h-8 w-8 mx-auto text-neutral-400 mb-2" />
                    <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">No feedback submissions found</p>
                    <p className="text-[11px] text-neutral-400 mt-1">Users will submit feedback directly or via the 2nd usage prompt.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EXPORT & DIAGNOSTICS */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800 space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-indigo-500" />
                  <span>Data Export & Archiving</span>
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xl">
                  Download full administrative records for offline auditing, reporting, and archival.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExportUsers}
                    className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition shadow-sm"
                  >
                    <Users className="h-4 w-4" />
                    <span>Download All Users (JSON)</span>
                  </button>

                  <button
                    onClick={handleExportFeedback}
                    className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 transition shadow-sm"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Download All Feedback (JSON)</span>
                  </button>
                </div>
              </div>

              {/* System Diagnostics */}
              <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800 space-y-3">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  <span>Server & Runtime Diagnostics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
                    <p className="text-[11px] text-neutral-500">Node Server Uptime</p>
                    <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">
                      {Math.floor((stats?.uptimeSeconds || 0) / 60)} minutes
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
                    <p className="text-[11px] text-neutral-500">Live WebRTC / WS Connections</p>
                    <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white mt-1">
                      {stats?.activeConnections || 0} active sockets
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
                    <p className="text-[11px] text-neutral-500">Target Delivery Recipient</p>
                    <p className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                      khankaifcom551@gmail.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

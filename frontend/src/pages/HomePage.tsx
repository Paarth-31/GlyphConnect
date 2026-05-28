import { useState, useEffect } from 'react';
import type { Page } from '../App';
import { sessionsApi, favouritesApi, type Session, type Favourite } from '../services/api';
import { useAuth } from '../auth/AuthProvider';
import {
  Monitor, Copy, RefreshCw, ArrowRight, Star, Clock,
  Book, Film, Settings, User, Wifi, ChevronRight,
  Shield, Zap, Globe, MousePointer2, Check, Loader2, AlertCircle, LogIn
} from 'lucide-react';

interface Props {
  onStartSession: (myId: string, remoteId: string, isHost: boolean) => void;
  onNavigate: (page: Page) => void;
}

function generateId() {
  return Math.floor(10000000000 + Math.random() * 90000000000).toString();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Device-local recent sessions (stored in localStorage) ─────────────────
// Used when the user is not logged in. Stores the last 10 remote IDs connected.

const LOCAL_SESSIONS_KEY = 'rda_local_recent';

interface LocalSession {
  remoteId: string;
  connectedAt: string;
}

function getLocalSessions(): LocalSession[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function recordLocalSession(remoteId: string) {
  const existing = getLocalSessions().filter(s => s.remoteId !== remoteId);
  const updated: LocalSession[] = [
    { remoteId, connectedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, 10);
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(updated));
}

// ── Component ─────────────────────────────────────────────────────────────

export function HomePage({ onStartSession, onNavigate }: Props) {
  const { isAuthenticated, user, logout } = useAuth();
  //const skippedAuth = sessionStorage.getItem('rda_skip_auth') === '1';

  const [myId, setMyId]         = useState(generateId);
  const [remoteId, setRemoteId] = useState('');
  const [copied, setCopied]     = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'favourites'>('recent');

  // Server-side data (authenticated users)
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [favourites, setFavourites]         = useState<Favourite[]>([]);
  const [loadingRecent, setLoadingRecent]   = useState(false);
  const [loadingFavs, setLoadingFavs]       = useState(false);
  const [errorRecent, setErrorRecent]       = useState<string | null>(null);
  const [errorFavs, setErrorFavs]           = useState<string | null>(null);

  // Device-local data (guests)
  const [localSessions, setLocalSessions]   = useState<LocalSession[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLocalSessions(getLocalSessions());
      return;
    }
    setLoadingRecent(true);
    setErrorRecent(null);
    sessionsApi.list(10)
      .then(setRecentSessions)
      .catch(e => setErrorRecent(e.message))
      .finally(() => setLoadingRecent(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeTab !== 'favourites' || !isAuthenticated) return;
    setLoadingFavs(true);
    setErrorFavs(null);
    favouritesApi.list()
      .then(setFavourites)
      .catch(e => setErrorFavs(e.message))
      .finally(() => setLoadingFavs(false));
  }, [activeTab, isAuthenticated]);

  const copyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = () => {
    if (!remoteId.trim()) return;
    // Record locally regardless of auth
    recordLocalSession(remoteId.trim());
    onStartSession(myId, remoteId.trim(), false);
  };

  const handleHostSession = () => onStartSession(myId, '', true);

  const handleQuickConnect = (id: string) => {
    recordLocalSession(id);
    if (isAuthenticated) favouritesApi.upsert(id).catch(() => {});
    onStartSession(myId, id, false);
  };

  const isLoading = activeTab === 'recent' ? loadingRecent : loadingFavs;
  const error     = activeTab === 'recent' ? errorRecent   : errorFavs;

  // What to show in the grid
  const hasData = isAuthenticated
    ? (activeTab === 'recent' ? recentSessions.length > 0 : favourites.length > 0)
    : localSessions.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl select-none">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight">GlyphConnect</span>
          <span className="text-[10px] font-mono text-white/20 ml-1">v1.0</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>

          <button onClick={() => onNavigate('settings')} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all" title="Settings">
            <Settings className="w-4 h-4" />
          </button>

          {isAuthenticated ? (
            <button onClick={() => onNavigate('profile')} className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-black shadow-md" title="Profile">
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </button>
          ) : (
            <button
              onClick={() => { sessionStorage.removeItem('rda_skip_auth'); window.location.reload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold border border-indigo-500/20 transition-all"
              title="Sign in"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-52 border-r border-white/[0.05] bg-black/20 flex flex-col py-4 gap-1 px-2 shrink-0">
          {[
            { icon: Monitor, label: 'Remote Access', tab: null                          as 'recent'|'favourites'|null, page: null             as Page|null },
            { icon: Star,    label: 'Favourites',    tab: 'favourites'                  as 'recent'|'favourites'|null, page: null             as Page|null },
            { icon: Clock,   label: 'Recent',        tab: 'recent'                      as 'recent'|'favourites'|null, page: null             as Page|null },
            { icon: Film,    label: 'Recordings',    tab: null, page: 'recordings'      as Page },
            { icon: Book,    label: 'Address Book',  tab: null, page: 'addressbook'     as Page },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => {
                if (item.tab)  { setActiveTab(item.tab); return; }
                if (item.page) onNavigate(item.page);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                item.label === 'Remote Access'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}

          {/* Auth status in sidebar */}
          <div className="mt-auto px-3 py-2 flex flex-col gap-2">
            {isAuthenticated ? (
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-1">
                <p className="text-[11px] font-semibold text-indigo-300 truncate">{user?.name}</p>
                <p className="text-[10px] text-white/25 truncate">{user?.email}</p>
                <button onClick={logout} className="mt-1 text-[10px] text-white/20 hover:text-red-400 transition-colors text-left">
                  Sign out
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] text-white/25 leading-relaxed mb-2">
                  Sign in to sync favourites and sessions across devices.
                </p>
                <button
                  onClick={() => { sessionStorage.removeItem('rda_skip_auth'); window.location.reload(); }}
                  className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Sign in →
                </button>
              </div>
            )}

            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/15">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-semibold text-indigo-300">Secure</span>
              </div>
              <p className="text-[10px] text-white/30 leading-relaxed">AES-256 E2E encrypted.</p>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto px-8 py-7">

          {/* ID + Connect cards */}
          <div className="grid grid-cols-2 gap-5 mb-8">

            {/* Your ID */}
            <div className="bg-[#111113] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Your connection ID</p>
                  <p className="text-[11px] text-white/20">Share this with whoever wants to connect</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-black/50 border border-white/10 rounded-xl px-4 py-3 mb-4">
                <span className="font-mono text-2xl font-bold tracking-[0.15em] text-white flex-1 select-all">
                  {myId.slice(0,3)}&nbsp;{myId.slice(3,6)}&nbsp;{myId.slice(6,9)}&nbsp;{myId.slice(9)}
                </span>
                <button onClick={copyId} className="p-1.5 rounded-lg hover:bg-white/10 transition-all text-white/40 hover:text-white">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setMyId(generateId())} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs font-medium transition-all border border-white/5">
                  <RefreshCw className="w-3.5 h-3.5" /> New ID
                </button>
                <button onClick={handleHostSession} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold transition-all border border-indigo-500/20">
                  <Wifi className="w-3.5 h-3.5" /> Allow Remote Control
                </button>
              </div>
            </div>

            {/* Connect */}
            <div className="bg-[#111113] border border-white/[0.07] rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Connect to remote</p>
                  <p className="text-[11px] text-white/20">Enter the ID of the computer to control</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <MousePointer2 className="w-4 h-4 text-violet-400" />
                </div>
              </div>
              <input
                type="text"
                placeholder="Enter remote ID..."
                value={remoteId}
                onChange={e => setRemoteId(e.target.value.replace(/\s/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                maxLength={11}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 font-mono text-xl font-bold tracking-[0.12em] text-white placeholder:text-white/15 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 mb-4 transition-all"
              />
              <button
                onClick={handleConnect}
                disabled={!remoteId.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                Connect <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feature pills */}
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {[Shield, Zap, Globe, Film].map((Icon, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-[11px] font-medium text-white/40">
                <Icon className="w-3 h-3" />
                {['E2E Encrypted','Low Latency','Global Relay','Recording'][i]}
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg border border-white/[0.06]">
              {(['recent', 'favourites'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={() => onNavigate('addressbook')} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Guest notice for favourites tab */}
          {!isAuthenticated && activeTab === 'favourites' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 text-indigo-300 text-sm mb-4">
              <Star className="w-4 h-4 shrink-0" />
              <span className="text-[12px]">
                <button onClick={() => { sessionStorage.removeItem('rda_skip_auth'); window.location.reload(); }} className="font-semibold hover:underline">
                  Sign in
                </button>
                {' '}to save favourites across devices.
              </span>
            </div>
          )}

          {/* Loading */}
          {isAuthenticated && isLoading && (
            <div className="flex items-center justify-center py-12 gap-2 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading...</span>
            </div>
          )}

          {/* Error */}
          {isAuthenticated && !isLoading && error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && !hasData && (
            <div className="flex flex-col items-center py-12 gap-2 text-white/20">
              {activeTab === 'recent'
                ? <><Clock className="w-8 h-8 opacity-30" /><p className="text-sm">No recent sessions yet</p><p className="text-[11px]">Sessions will appear here after you connect</p></>
                : <><Star className="w-8 h-8 opacity-30" /><p className="text-sm">No favourites yet</p></>
              }
            </div>
          )}

          {/* Grid */}
          {!isLoading && !error && (
            <div className="grid grid-cols-2 gap-3">

              {/* Authenticated recent sessions */}
              {isAuthenticated && activeTab === 'recent' && recentSessions.map(s => (
                <button key={s.id} onClick={() => handleQuickConnect(s.host_display_id)}
                  className="group flex items-center gap-4 p-4 bg-[#111113] hover:bg-[#18181c] border border-white/[0.06] hover:border-indigo-500/30 rounded-xl transition-all text-left">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-white/30 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    {s.status === 'active' && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#111113]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 group-hover:text-white font-mono">
                      {s.host_display_id.slice(0,3)} {s.host_display_id.slice(3,6)} {s.host_display_id.slice(6,9)} {s.host_display_id.slice(9)}
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">{timeAgo(s.start_time)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-indigo-400 transition-all shrink-0" />
                </button>
              ))}

              {/* Guest recent sessions — device-local from localStorage */}
              {!isAuthenticated && activeTab === 'recent' && localSessions.map(s => (
                <button key={s.remoteId} onClick={() => handleQuickConnect(s.remoteId)}
                  className="group flex items-center gap-4 p-4 bg-[#111113] hover:bg-[#18181c] border border-white/[0.06] hover:border-indigo-500/30 rounded-xl transition-all text-left">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white/30 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 group-hover:text-white font-mono">
                      {s.remoteId.slice(0,3)} {s.remoteId.slice(3,6)} {s.remoteId.slice(6,9)} {s.remoteId.slice(9)}
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">
                      {timeAgo(s.connectedAt)} · this device only
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-indigo-400 transition-all shrink-0" />
                </button>
              ))}

              {/* Authenticated favourites */}
              {isAuthenticated && activeTab === 'favourites' && favourites.map(f => (
                <button key={f.id} onClick={() => handleQuickConnect(f.remote_id)}
                  className="group flex items-center gap-4 p-4 bg-[#111113] hover:bg-[#18181c] border border-white/[0.06] hover:border-indigo-500/30 rounded-xl transition-all text-left">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white/30 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80 group-hover:text-white truncate">
                      {f.label ?? `${f.remote_id.slice(0,3)} ${f.remote_id.slice(3,6)} ${f.remote_id.slice(6,9)} ${f.remote_id.slice(9)}`}
                    </p>
                    <p className="text-[11px] font-mono text-white/25 mt-0.5">
                      {f.remote_id.slice(0,3)} {f.remote_id.slice(3,6)} {f.remote_id.slice(6,9)} {f.remote_id.slice(9)}
                    </p>
                    {f.last_used_at && <p className="text-[10px] text-white/20 mt-0.5">{timeAgo(f.last_used_at)}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-indigo-400 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Bottom shortcuts */}
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { icon: Film, label: 'Saved Recordings', sub: 'View recorded sessions', page: 'recordings'  as Page, color: 'from-rose-500/10 to-pink-500/10 border-rose-500/15' },
              { icon: Book, label: 'Address Book',     sub: 'Contacts & favourites', page: 'addressbook' as Page, color: 'from-blue-500/10 to-cyan-500/10 border-blue-500/15' },
              { icon: User, label: 'My Profile',       sub: 'Account & preferences', page: 'profile'     as Page, color: 'from-violet-500/10 to-purple-500/10 border-violet-500/15' },
            ].map(item => (
              <button key={item.label} onClick={() => onNavigate(item.page)}
                className={`group flex items-center gap-3 p-4 bg-gradient-to-br ${item.color} border rounded-xl hover:scale-[1.02] transition-all text-left`}>
                <item.icon className="w-5 h-5 text-white/50 group-hover:text-white/80 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white/70 group-hover:text-white">{item.label}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{item.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
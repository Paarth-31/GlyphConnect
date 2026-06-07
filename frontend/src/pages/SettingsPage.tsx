import { useState, useEffect } from 'react';
import {
  ChevronLeft, Settings, Shield, Wifi, Video, Bell, Monitor,
  Globe, Lock, ChevronRight, Check, User, Mail, Key, LogOut,
  Camera, Edit3, Loader2, AlertCircle, Clock, BarChart2
} from 'lucide-react';
import { profileApi, authApi, type UserProfile, type UserStats, clearTokens } from '../services/api';

// ── Shared primitives ──────────────────────────────────────────────────────

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.05]">
      <div>
        <p className="text-sm font-medium text-white/80">{label}</p>
        {sub && <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-all relative ${value ? 'bg-indigo-500' : 'bg-white/10'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

// ── Settings Page ──────────────────────────────────────────────────────────

type SettingSection = 'general' | 'security' | 'network' | 'display' | 'notifications';

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<SettingSection>('general');

  const sections = [
    { id: 'general'       as SettingSection, icon: Settings, label: 'General'        },
    { id: 'security'      as SettingSection, icon: Shield,   label: 'Security'       },
    { id: 'network'       as SettingSection, icon: Wifi,     label: 'Network'        },
    { id: 'display'       as SettingSection, icon: Video,    label: 'Display & Audio'},
    { id: 'notifications' as SettingSection, icon: Bell,     label: 'Notifications'  },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06] bg-black/40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="w-px h-5 bg-white/10" />
        <Settings className="w-4 h-4 text-white/50" />
        <span className="font-bold text-sm">Settings</span>
      </header>

      <div className="flex flex-1 max-w-4xl mx-auto w-full px-8 py-6 gap-6">
        <aside className="w-44 shrink-0 flex flex-col gap-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${section === s.id ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
              <s.icon className="w-4 h-4 shrink-0" />{s.label}
            </button>
          ))}
        </aside>
        <div className="flex-1">
          {section === 'general'       && <GeneralSettings />}
          {section === 'security'      && <SecuritySettings />}
          {section === 'network'       && <NetworkSettings />}
          {section === 'display'       && <DisplaySettings />}
          {section === 'notifications' && <NotificationSettings />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const [autoStart, setAutoStart]       = useState(false);
  const [startMinimized, setStartMin]   = useState(false);
  const [theme, setTheme]               = useState<'dark'|'system'>('dark');
  return (
    <div>
      <h2 className="text-base font-bold mb-5 text-white/90">General</h2>
      <SettingRow label="Launch on startup" sub="Start GlyphConnect when your computer boots"><Toggle value={autoStart} onChange={setAutoStart} /></SettingRow>
      <SettingRow label="Start minimized" sub="Hide the window on startup"><Toggle value={startMinimized} onChange={setStartMin} /></SettingRow>
      <SettingRow label="Theme">
        <div className="flex gap-2">
          {(['dark','system'] as const).map(t => (
            <button key={t} onClick={() => setTheme(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${theme === t ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70'}`}>
              {t}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Language">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Globe className="w-4 h-4" /> English <ChevronRight className="w-3 h-3" />
        </div>
      </SettingRow>
    </div>
  );
}

function SecuritySettings() {
  const [twoFa, setTwoFa]           = useState(false);
  const [lockOnIdle, setLockOnIdle] = useState(true);
  return (
    <div>
      <h2 className="text-base font-bold mb-5 text-white/90">Security</h2>
      <SettingRow label="End-to-end encryption" sub="All sessions encrypted with AES-256 — always on">
        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> Always on</span>
      </SettingRow>
      <SettingRow label="Two-factor authentication" sub="Extra layer of account security"><Toggle value={twoFa} onChange={setTwoFa} /></SettingRow>
      <SettingRow label="Lock on idle" sub="Require auth after 10 mins inactivity"><Toggle value={lockOnIdle} onChange={setLockOnIdle} /></SettingRow>
      <SettingRow label="Session password" sub="Require a password to accept connections">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 text-xs border border-white/10 transition-all">
          <Lock className="w-3 h-3" /> Configure
        </button>
      </SettingRow>
    </div>
  );
}

function NetworkSettings() {
  const [turnEnabled, setTurn] = useState(true);
  const [bandwidth, setBw]     = useState('auto');
  return (
    <div>
      <h2 className="text-base font-bold mb-5 text-white/90">Network</h2>
      <SettingRow label="TURN relay" sub="Use relay when direct P2P connection fails"><Toggle value={turnEnabled} onChange={setTurn} /></SettingRow>
      <SettingRow label="Bandwidth limit">
        <div className="flex gap-2">
          {['auto','low','high'].map(b => (
            <button key={b} onClick={() => setBw(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${bandwidth === b ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70'}`}>
              {b}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="TURN server" sub="rda-turnserver.duckdns.org:5349">
        <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Connected</span>
      </SettingRow>
      <SettingRow label="Signaling server" sub="rda-signaling.duckdns.org">
        <span className="text-[11px] text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Connected</span>
      </SettingRow>
    </div>
  );
}

function DisplaySettings() {
  const [quality, setQ] = useState('720p');
  const [fps, setF]     = useState('30');
  const [sysAudio, setSA] = useState(true);
  return (
    <div>
      <h2 className="text-base font-bold mb-5 text-white/90">Display & Audio</h2>
      <SettingRow label="Stream quality">
        <div className="flex gap-2">
          {['480p','720p','1080p'].map(q => (
            <button key={q} onClick={() => setQ(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${quality === q ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70'}`}>
              {q}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Frame rate">
        <div className="flex gap-2">
          {['15','30','60'].map(f => (
            <button key={f} onClick={() => setF(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${fps === f ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70'}`}>
              {f} fps
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Capture system audio" sub="Include computer sounds in the stream"><Toggle value={sysAudio} onChange={setSA} /></SettingRow>
    </div>
  );
}

function NotificationSettings() {
  const [incoming, setIncoming] = useState(true);
  const [connected, setConn]    = useState(true);
  const [chat, setChat]         = useState(true);
  const [sound, setSound]       = useState(true);
  return (
    <div>
      <h2 className="text-base font-bold mb-5 text-white/90">Notifications</h2>
      <SettingRow label="Incoming connection requests"><Toggle value={incoming} onChange={setIncoming} /></SettingRow>
      <SettingRow label="Peer connected / disconnected"><Toggle value={connected} onChange={setConn} /></SettingRow>
      <SettingRow label="New chat messages"><Toggle value={chat} onChange={setChat} /></SettingRow>
      <SettingRow label="Notification sounds"><Toggle value={sound} onChange={setSound} /></SettingRow>
    </div>
  );
}

// ── Profile Page ───────────────────────────────────────────────────────────

export function ProfilePage({ onBack }: { onBack: () => void }) {
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [stats, setStats]       = useState<UserStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Password change state
  const [showPwForm, setShowPwForm]   = useState(false);
  const [currentPw, setCurrentPw]     = useState('');
  const [newPw, setNewPw]             = useState('');
  const [pwError, setPwError]         = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]     = useState(false);
  const [savingPw, setSavingPw]       = useState(false);

  useEffect(() => {
    Promise.all([profileApi.get(), profileApi.stats()])
      .then(([p, s]) => { setProfile(p); setStats(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const saveDisplayName = async () => {
    if (!tempName.trim() || !profile) return;
    setSavingName(true);
    try {
      const updated = await profileApi.update({ display_name: tempName.trim() });
      setProfile(updated);
      setEditingName(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setSavingPw(true);
    setPwError(null);
    try {
      await authApi.changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(''); setNewPw('');
      setTimeout(() => { setPwSuccess(false); setShowPwForm(false); }, 2000);
    } catch (e: any) {
      setPwError(e.message);
    } finally {
      setSavingPw(false);
    }
  };

  const handleSignOut = () => {
    const rt = localStorage.getItem('rda_refresh_token');
    if (rt) authApi.logout(rt).catch(() => {});
    clearTokens();
    window.location.reload();
  };

  const formatDuration = (secs: number): string => {
    const hrs = Math.floor(secs / 3600);
    if (hrs < 1) return `${Math.floor(secs / 60)}m`;
    return `${hrs}h ${Math.floor((secs % 3600) / 60)}m`;
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white/30" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06] bg-black/40">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="w-px h-5 bg-white/10" />
        <User className="w-4 h-4 text-white/50" />
        <span className="font-bold text-sm">My Profile</span>
      </header>

      <main className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full">

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group mb-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl font-black shadow-xl shadow-indigo-500/20">
              {(profile?.display_name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <button className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>

          {editingName ? (
            <div className="flex items-center gap-2">
              <input value={tempName} onChange={e => setTempName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                className="bg-black/50 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-base font-bold text-white text-center focus:outline-none"
                autoFocus />
              <button onClick={saveDisplayName} disabled={savingName}
                className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all disabled:opacity-40">
                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditingName(false)} className="p-1.5 text-white/30 hover:bg-white/10 rounded-lg transition-all">
                <Monitor className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setTempName(profile?.display_name ?? ''); setEditingName(true); }}
              className="flex items-center gap-2 group/n">
              <span className="text-lg font-bold text-white/90 group-hover/n:text-white">{profile?.display_name ?? '—'}</span>
              <Edit3 className="w-3.5 h-3.5 text-white/20 group-hover/n:text-white/60 transition-colors" />
            </button>
          )}
          <p className="text-[12px] text-white/30 mt-1">{profile?.email}</p>
          {profile?.role && profile.role !== 'user' && (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              {profile.role}
            </span>
          )}
        </div>

        {/* Stats — live from DB */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#111113] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
            <Monitor className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white">{stats?.total_sessions ?? 0}</p>
              <p className="text-[11px] text-white/30">Total Sessions</p>
            </div>
          </div>
          <div className="bg-[#111113] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-violet-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white">{formatDuration(stats?.total_duration_seconds ?? 0)}</p>
              <p className="text-[11px] text-white/30">Time Connected</p>
            </div>
          </div>
          <div className="bg-[#111113] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white">{stats?.sessions_today ?? 0}</p>
              <p className="text-[11px] text-white/30">Sessions Today</p>
            </div>
          </div>
          <div className="bg-[#111113] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white">{formatDuration(stats?.avg_duration_seconds ?? 0)}</p>
              <p className="text-[11px] text-white/30">Avg Duration</p>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="bg-[#111113] border border-white/[0.07] rounded-xl overflow-hidden mb-4">
          {/* Email row */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-white/30" />
              <div>
                <p className="text-sm font-medium text-white/70">Email address</p>
                <p className="text-[11px] text-white/25 font-mono">{profile?.email ?? '—'}</p>
              </div>
            </div>
            <button onClick={() => alert('Email change requires email verification and is not yet supported. Please contact support.')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors px-2 py-1 rounded-md hover:bg-indigo-500/10">
              Change
            </button>
          </div>

          {/* Password row */}
          <div>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-white/30" />
                <div>
                  <p className="text-sm font-medium text-white/70">Password</p>
                  <p className="text-[11px] text-white/25 font-mono">••••••••</p>
                </div>
              </div>
              <button onClick={() => setShowPwForm(v => !v)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors px-2 py-1 rounded-md hover:bg-indigo-500/10">
                {showPwForm ? 'Cancel' : 'Update'}
              </button>
            </div>
            {showPwForm && (
              <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.05]">
                {pwError && <p className="text-xs text-red-400 mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{pwError}</p>}
                {pwSuccess && <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1"><Check className="w-3 h-3" /> Password updated!</p>}
                <div className="flex flex-col gap-2">
                  <input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40" />
                  <input type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40" />
                  <button onClick={savePassword} disabled={savingPw || !currentPw || !newPw}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all">
                    {savingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save password
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2FA row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-white/30" />
              <div>
                <p className="text-sm font-medium text-white/70">Two-factor auth</p>
                <p className="text-[11px] text-white/25">{profile?.two_fa_enabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <button onClick={() => alert('Two-factor authentication is coming soon. This feature is under development.')} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors px-2 py-1 rounded-md hover:bg-indigo-500/10">
              {profile?.two_fa_enabled ? 'Manage' : 'Enable'}
            </button>
          </div>
        </div>

        <button onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 text-red-400 text-sm font-semibold border border-red-500/15 transition-all">
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </main>
    </div>
  );
}
// frontend/src/pages/SignInPage.tsx
// Custom sign-in/sign-up page — no Keycloak, uses own DB + Google OAuth2

import React, { useState, useRef, useEffect } from 'react';
import {
  Monitor, Mail, Lock, User, Eye, EyeOff,
  ArrowRight, Loader2, AlertCircle, CheckCircle, Shield
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { authApi } from '../services/api';

type Mode = 'signin' | 'signup';

export function SignInPage() {
  const { login, register, loginWithGoogle, error, clearError, needs2FA, verify2FALogin, cancel2FA } = useAuth();

  const [mode, setMode]           = useState<Mode>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [displayName, setName]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [localError, setLocalErr] = useState<string | null>(null);

  // Forgot password state
  const [showForgotPw, setShowForgotPw]     = useState(false);
  const [resetEmail, setResetEmail]         = useState('');
  const [resetSending, setResetSending]     = useState(false);
  const [resetSent, setResetSent]           = useState(false);

  // 2FA login state
  const [totpCode, setTotpCode]   = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const totpRef = useRef<HTMLInputElement>(null);

  // Auto-focus TOTP input when 2FA is required
  useEffect(() => {
    if (needs2FA && totpRef.current) totpRef.current.focus();
  }, [needs2FA]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setLocalErr(null);
    clearError();
    setEmail(''); setPassword(''); setConfirmPw(''); setName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    clearError();

    if (mode === 'signup') {
      if (!displayName.trim())    { setLocalErr('Display name is required'); return; }
      if (password.length < 8)    { setLocalErr('Password must be at least 8 characters'); return; }
      if (password !== confirmPw) { setLocalErr('Passwords do not match'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signin') await login(email, password);
      else await register(email, password, displayName.trim());
    } catch {
      // error already set inside AuthProvider
    } finally {
      setLoading(false);
    }
  };

  const displayError = localError ?? error;

  return (
    <div
      className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-3">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">GlyphConnect</h1>
          <p className="text-[12px] text-white/30 mt-1">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">

          {/* Mode tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06] mb-6">
            {(['signin', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                  mode === m
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error */}
          {displayError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {displayError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'signup' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right -mt-1">
                <button type="button" onClick={() => { setShowForgotPw(v => !v); setResetSent(false); setResetEmail(email); }} className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </button>
                {showForgotPw && (
                  <div className="mt-2 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left">
                    {resetSent ? (
                      <div className="flex items-start gap-2 text-emerald-400 text-[11px] leading-relaxed">
                        <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>If an account exists with that email, a reset link has been sent. Check your inbox (and spam folder).</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-white/40 mb-2">Enter your email to receive a password reset link.</p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            placeholder="Email address"
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                            className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40"
                          />
                          <button
                            type="button"
                            disabled={resetSending || !resetEmail.includes('@')}
                            onClick={async () => {
                              setResetSending(true);
                              try {
                                await authApi.forgotPassword(resetEmail.trim());
                                setResetSent(true);
                              } catch { /* still show success for security */ setResetSent(true); }
                              finally { setResetSending(false); }
                            }}
                            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-all whitespace-nowrap"
                          >
                            {resetSending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Send Link'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] mt-1"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>{mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-white/20 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Google OAuth2 button */}
          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-white/60 hover:text-white text-sm font-medium transition-all"
          >
            {/* Google icon SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* 2FA verification overlay */}
        {needs2FA && (
          <div className="bg-[#111113] border border-white/[0.08] rounded-2xl p-6 shadow-2xl mt-4">
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-white/90">Two-Factor Authentication</h3>
              <p className="text-[11px] text-white/35 text-center leading-relaxed">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>

            {displayError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {displayError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && totpCode.length === 6) {
                    setTotpLoading(true);
                    try { await verify2FALogin(totpCode); } catch {} finally { setTotpLoading(false); }
                  }
                }}
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-white tracking-[0.5em] placeholder:text-white/15 placeholder:tracking-[0.3em] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <button
                type="button"
                disabled={totpLoading || totpCode.length !== 6}
                onClick={async () => {
                  setTotpLoading(true);
                  try { await verify2FALogin(totpCode); } catch {} finally { setTotpLoading(false); }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
              >
                {totpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify <ArrowRight className="w-4 h-4" /></>}
              </button>
              <button
                type="button"
                onClick={() => { cancel2FA(); setTotpCode(''); }}
                className="text-[11px] text-white/25 hover:text-white/50 transition-colors py-1"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* Continue without account */}
        {!needs2FA && (
          <button
            onClick={() => {
              sessionStorage.setItem('rda_skip_auth', '1');
              window.location.reload();
            }}
            className="mt-4 w-full text-center text-[11px] text-white/20 hover:text-white/40 transition-colors py-2"
          >
            Continue without account →
          </button>
        )}

        <p className="text-center text-[10px] text-white/15 mt-3">
          v1.0 · End-to-end encrypted · Private by design
        </p>
      </div>
    </div>
  );
}
import { useState, useCallback, useRef } from 'react';
import { HomePage }        from './pages/HomePage';
import { SignInPage }      from './pages/SignInPage';
import { SessionPage }     from './pages/SessionPage';
import { RecordingsPage }  from './pages/RecordingsPage';
import { AddressBookPage } from './pages/AddressBookPage';
import { SettingsPage, ProfilePage } from './pages/SettingsPage';
import { useAuth }         from './auth/AuthProvider';
import { recordLocalSession } from './pages/HomePage';

export type Page =
  | 'home' | 'session' | 'recordings'
  | 'addressbook' | 'settings' | 'profile';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [sessionData, setSessionData] = useState<{
    myId: string;
    remoteId: string;
    isHost: boolean;
  } | null>(null);

  // ALL hooks must be called before any conditional return
  const { isLoading, isAuthenticated } = useAuth();

  // Keep a ref to isAuthenticated so callbacks don't go stale
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  const navigate = useCallback((p: Page) => setPage(p), []);

  // [FIX] Session DB records are now created exclusively in SessionPage
  // when the ICE connection is actually established. This prevents duplicates.
  const startSession = useCallback((
    myId: string,
    remoteId: string,
    isHost: boolean,
  ) => {
    if (remoteId) recordLocalSession(remoteId);
    setSessionData({ myId, remoteId, isHost });
    setPage('session');
  }, []);

  const endSession = useCallback(() => {
    // SessionPage handles ending the DB session record before calling this
    setSessionData(null);
    setPage('home');
  }, []);

  // ── Conditional renders AFTER all hooks ──────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#080809] flex flex-col items-center justify-center gap-3"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    );
  }

  const skippedAuth = sessionStorage.getItem('rda_skip_auth') === '1';
  if (!isAuthenticated && !skippedAuth) {
    return <SignInPage />;
  }

  if (page === 'session' && sessionData) {
    return (
      <SessionPage
        myId={sessionData.myId}
        remoteId={sessionData.remoteId}
        isHostInitial={sessionData.isHost}
        onEnd={endSession}
      />
    );
  }

  if (page === 'recordings')
    return <RecordingsPage onBack={() => navigate('home')} />;

  if (page === 'addressbook')
    return (
      <AddressBookPage
        onBack={() => navigate('home')}
        onConnect={id => startSession('', id, false)}
      />
    );

  if (page === 'settings')
    return <SettingsPage onBack={() => navigate('home')} />;

  if (page === 'profile')
    return <ProfilePage onBack={() => navigate('home')} />;

  return <HomePage onStartSession={startSession} onNavigate={navigate} />;
}

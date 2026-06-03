import { useState, useCallback, useRef } from 'react';
import { HomePage }        from './pages/HomePage';
import { SignInPage }      from './pages/SignInPage';
import { SessionPage }     from './pages/SessionPage';
import { RecordingsPage }  from './pages/RecordingsPage';
import { AddressBookPage } from './pages/AddressBookPage';
import { SettingsPage, ProfilePage } from './pages/SettingsPage';
import { useAuth }         from './auth/AuthProvider';
import { sessionsApi, favouritesApi } from './services/api';
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
    dbSessionId?: string;
  } | null>(null);

  // ALL hooks must be called before any conditional return
  const { isLoading, isAuthenticated } = useAuth();

  // Keep a ref to isAuthenticated so callbacks don't go stale
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;

  const sessionDataRef = useRef(sessionData);
  sessionDataRef.current = sessionData;

  const navigate = useCallback((p: Page) => setPage(p), []);

  const startSession = useCallback(async (
    myId: string,
    remoteId: string,
    isHost: boolean,
  ) => {
    if (remoteId) recordLocalSession(remoteId);

    let dbSessionId: string | undefined;

    if (isAuthRef.current) {
      if (remoteId) {
        favouritesApi.bump(remoteId).catch(() => {});
      }
      if (isHost && myId) {
        try {
          const session = await sessionsApi.create({
            hostDisplayId:  myId,
            screenAudio:    false,
            videoCall:      false,
            controlEnabled: false,
          });
          dbSessionId = session.id;
        } catch (err) {
          console.warn('[App] Could not create DB session:', err);
        }
      }
    }

    setSessionData({ myId, remoteId, isHost, dbSessionId });
    setPage('session');
  }, []); // no deps — uses refs internally

  const endSession = useCallback(async () => {
    const sd = sessionDataRef.current;
    if (sd?.dbSessionId && isAuthRef.current) {
      try {
        await sessionsApi.end(sd.dbSessionId);
      } catch (err) {
        console.warn('[App] Could not end DB session:', err);
      }
    }
    setSessionData(null);
    setPage('home');
  }, []); // no deps — uses refs internally

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

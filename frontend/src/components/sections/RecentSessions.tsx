// frontend/src/components/sections/RecentSessions.tsx
//
// [FIX 4] This component no longer uses hardcoded SESSIONS array.
//   It reads from localStorage (guest) or the sessions API (authenticated)
//   via props passed down from HomePage. The data is real and reflects actual
//   connections made by this user.

import { Monitor } from 'lucide-react';

interface Session {
  remoteId: string;
  label?: string;
  connectedAt?: string;
}

interface Props {
  sessions: Session[];
  onConnect: (id: string) => void;
}

export const RecentSessions = ({ sessions, onConnect }: Props) => {
  if (!sessions.length) return null;

  return (
    <div className="w-full max-w-5xl mt-12 animate-in slide-in-from-bottom-10 duration-500">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Recent Sessions
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {sessions.slice(0, 5).map((session) => (
          <div
            key={session.remoteId}
            onClick={() => onConnect(session.remoteId)}
            className="bg-card/30 border border-white/5 hover:border-primary/30 p-4 rounded-lg cursor-pointer transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <Monitor className="w-8 h-8 text-white/20 group-hover:text-primary transition-colors" />
            </div>
            <div className="text-xs font-bold text-white group-hover:text-primary truncate">
              {session.label || `${session.remoteId.slice(0,3)} ${session.remoteId.slice(3,6)} ${session.remoteId.slice(6,9)}`}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {session.remoteId.slice(0,3)}-{session.remoteId.slice(3,6)}-{session.remoteId.slice(6,9)}-{session.remoteId.slice(9)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// // // frontend/src/components/ChatPanel.tsx
// // import { useState, useRef, useEffect } from 'react';
// // import { ChatMessage } from '../hooks/usePeerConnection';

// // interface Props {
// //   messages: ChatMessage[];
// //   onSend: (text: string) => void;
// //   cryptoReady: boolean; // pass true once the session is established
// // }

// // export function ChatPanel({ messages, onSend, cryptoReady }: Props) {
// //   const [input, setInput] = useState('');
// //   const bottomRef = useRef<HTMLDivElement>(null);

// //   useEffect(() => {
// //     bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
// //   }, [messages]);

// //   const handleSend = () => {
// //     const trimmed = input.trim();
// //     if (!trimmed || !cryptoReady) return;
// //     onSend(trimmed);
// //     setInput('');
// //   };

// //   return (
// //     <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
// //       {/* Header */}
// //       <div className="px-4 py-2 border-b flex items-center gap-2 text-sm font-medium">
// //         <span
// //           className={`w-2 h-2 rounded-full ${
// //             cryptoReady ? 'bg-green-500' : 'bg-yellow-400'
// //           }`}
// //         />
// //         {cryptoReady ? 'E2E Encrypted Chat' : 'Establishing secure channel…'}
// //       </div>

// //       {/* Messages */}
// //       <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
// //         {messages.map((msg, i) => (
// //           <div
// //             key={i}
// //             className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
// //           >
// //             <div
// //               className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
// //                 msg.from === 'me'
// //                   ? 'bg-blue-600 text-white rounded-br-sm'
// //                   : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
// //               }`}
// //             >
// //               {msg.text}
// //             </div>
// //           </div>
// //         ))}
// //         <div ref={bottomRef} />
// //       </div>

// //       {/* Input */}
// //       <div className="border-t px-3 py-2 flex gap-2">
// //         <input
// //           className="flex-1 text-sm bg-transparent outline-none placeholder:text-zinc-400"
// //           placeholder={cryptoReady ? 'Type a message…' : 'Waiting for peer…'}
// //           value={input}
// //           disabled={!cryptoReady}
// //           onChange={e => setInput(e.target.value)}
// //           onKeyDown={e => e.key === 'Enter' && handleSend()}
// //         />
// //         <button
// //           onClick={handleSend}
// //           disabled={!cryptoReady || !input.trim()}
// //           className="text-blue-600 disabled:opacity-30 font-medium text-sm"
// //         >
// //           Send
// //         </button>
// //       </div>
// //     </div>
// //   );
// // }


// // frontend/src/components/ChatPanel.tsx
// //
// // FIX [C]: Removed hardcoded `bg-white dark:bg-zinc-900` from the container.
// // When rendered inside the dark SessionPage the Tailwind `dark:` variant was
// // not applying (no `dark` class on <html>) so the panel was white with white
// // text — invisible. Replaced with explicit dark palette colours that always
// // render correctly regardless of the system colour scheme.

// import { useState, useRef, useEffect } from 'react';
// import { Send, Lock, Clock } from 'lucide-react';
// import { ChatMessage } from '../hooks/usePeerConnection';

// interface Props {
//   messages: ChatMessage[];
//   onSend: (text: string) => void;
//   cryptoReady: boolean;
// }

// export function ChatPanel({ messages, onSend, cryptoReady }: Props) {
//   const [input, setInput] = useState('');
//   const bottomRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const handleSend = () => {
//     const trimmed = input.trim();
//     if (!trimmed || !cryptoReady) return;
//     onSend(trimmed);
//     setInput('');
//   };

//   const formatTime = (ts: number) => {
//     return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };

//   return (
//     <div className="flex flex-col h-full bg-[#0d0d0f]">

//       {/* Header */}
//       <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
//         <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cryptoReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
//         <span className="text-xs font-medium text-white/50">
//           {cryptoReady ? 'E2E Encrypted' : 'Establishing secure channel…'}
//         </span>
//         {cryptoReady && <Lock className="w-3 h-3 text-emerald-400/60 ml-auto" />}
//       </div>

//       {/* Messages */}
//       <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
//         {messages.length === 0 && (
//           <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
//             <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
//               <Lock className="w-4 h-4 text-white/20" />
//             </div>
//             <p className="text-white/20 text-xs">
//               {cryptoReady
//                 ? 'No messages yet. Say hello!'
//                 : 'Waiting for peer to connect…'}
//             </p>
//           </div>
//         )}

//         {messages.map((msg, i) => (
//           <div key={i} className={`flex flex-col gap-0.5 ${msg.from === 'me' ? 'items-end' : 'items-start'}`}>
//             <div
//               className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm break-words leading-relaxed ${
//                 msg.from === 'me'
//                   ? 'bg-indigo-600 text-white rounded-br-sm'
//                   : 'bg-white/[0.08] text-white/85 rounded-bl-sm'
//               }`}
//             >
//               {msg.text}
//             </div>
//             <div className="flex items-center gap-1 px-1">
//               <Clock className="w-2.5 h-2.5 text-white/20" />
//               <span className="text-[10px] text-white/20">{formatTime(msg.timestamp)}</span>
//             </div>
//           </div>
//         ))}
//         <div ref={bottomRef} />
//       </div>

//       {/* Input */}
//       <div className="border-t border-white/[0.06] px-3 py-2.5 flex gap-2 items-center">
//         <input
//           className="flex-1 text-sm bg-white/[0.06] text-white placeholder:text-white/25 outline-none rounded-xl px-3 py-2 border border-white/[0.08] focus:border-indigo-500/40 focus:bg-white/[0.08] transition-all"
//           placeholder={cryptoReady ? 'Type a message…' : 'Waiting for peer…'}
//           value={input}
//           disabled={!cryptoReady}
//           onChange={e => setInput(e.target.value)}
//           onKeyDown={e => e.key === 'Enter' && handleSend()}
//         />
//         <button
//           onClick={handleSend}
//           disabled={!cryptoReady || !input.trim()}
//           className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
//         >
//           <Send className="w-3.5 h-3.5 text-white" />
//         </button>
//       </div>
//     </div>
//   );
// }



// frontend/src/components/ChatPanel.tsx
//
// FIX: Removed `bg-white dark:bg-zinc-900`. The dark: variant requires a
// 'dark' class on <html> which this app never sets, so the panel always
// rendered as white-on-white. Replaced with explicit dark palette colors
// that always render correctly in the dark session UI.

import { useState, useRef, useEffect } from 'react';
import { Send, Lock, Clock, ShieldCheck } from 'lucide-react';
import { ChatMessage } from '../hooks/usePeerConnection';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  cryptoReady: boolean;
}

export function ChatPanel({ messages, onSend, cryptoReady }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const t = input.trim();
    if (!t || !cryptoReady) return;
    onSend(t);
    setInput('');
  };

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f]">

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cryptoReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
        <span className="text-xs font-medium text-white/50 flex-1">
          {cryptoReady ? 'End-to-end encrypted' : 'Establishing secure channel…'}
        </span>
        {cryptoReady && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Lock className="w-5 h-5 text-white/15" />
            <p className="text-white/20 text-xs text-center">
              {cryptoReady ? 'No messages yet. Say hello!' : 'Waiting for peer connection…'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-0.5 ${msg.from === 'me' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm break-words leading-relaxed ${
              msg.from === 'me'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-white/[0.08] text-white/85 rounded-bl-sm'
            }`}>
              {msg.text}
            </div>
            <div className="flex items-center gap-1 px-1">
              <Clock className="w-2.5 h-2.5 text-white/20" />
              <span className="text-[10px] text-white/20">{fmtTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-3 py-2.5 flex gap-2 items-center">
        <input
          data-local-input
          className="flex-1 text-sm bg-white/[0.06] text-white placeholder:text-white/25 outline-none rounded-xl px-3 py-2 border border-white/[0.08] focus:border-indigo-500/40 focus:bg-white/[0.08] transition-all"
          placeholder={cryptoReady ? 'Type a message…' : 'Waiting for peer…'}
          value={input}
          disabled={!cryptoReady}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!cryptoReady || !input.trim()}
          className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}
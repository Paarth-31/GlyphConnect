// import { useEffect, useState, useCallback, useRef } from 'react';
// import { io, Socket } from 'socket.io-client';
// import peer from '../services/peer';
// import {
//   generateECDHKeyPair,
//   importPublicKey,
//   buildCryptoSession,
//   encryptMessage,
//   decryptMessage,
// } from '../services/messageCrypto';

// const SERVER_URL = 'https://rda-signaling.duckdns.org';

// // ── Public types ─────────────────────────────────────────────────────────────

// export interface ChatMessage {
//   from: 'me' | 'them';
//   text: string;
//   timestamp: number;
// }

// // Remote control action sent over the control DataChannel
// export interface ControlAction {
//   type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
//   normX?: number;   // normalised 0-1 relative to the video element
//   normY?: number;
//   button?: 'left' | 'right' | 'middle';
//   key?: string;
//   scrollX?: number;
//   scrollY?: number;
// }

// export interface MediaToggles {
//   micEnabled: boolean;
//   camEnabled: boolean;
//   screenAudioEnabled: boolean;
// }

// // ── Hook ─────────────────────────────────────────────────────────────────────

// export const usePeerConnection = (myId: string, _remoteId: string, onFileChunk?: (data: ArrayBuffer | string) => void) => {
//   // ── Connection state ──────────────────────────────────────────────────────
//   const [, setSocket] = useState<Socket | null>(null);
//   const [status, setStatus] = useState('Disconnected');

//   // ── Stream state ──────────────────────────────────────────────────────────
//   const [myStream, setMyStream] = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

//   // ── AV call state ─────────────────────────────────────────────────────────
//   // Separate stream for webcam/mic — does not affect screen share stream
//   const [callStream, setCallStream] = useState<MediaStream | null>(null);
//   const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
//   const [inCall, setInCall] = useState(false);
//   const [micEnabled, setMicEnabled] = useState(true);
//   const [camEnabled, setCamEnabled] = useState(true);
//   const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);

//   // ── Chat state ────────────────────────────────────────────────────────────
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [cryptoReady, setCryptoReady] = useState(false);

//   // ── Refs ──────────────────────────────────────────────────────────────────
//   const connectedUserRef = useRef<string | null>(null);
//   const socketRef = useRef<Socket | null>(null);
//   // Two separate data channels: "chat" (E2EE text) and "control" (mouse/kb)
//   const chatChannelRef = useRef<RTCDataChannel | null>(null);
//   const controlChannelRef = useRef<RTCDataChannel | null>(null);
//   const fileChannelRef = useRef<RTCDataChannel | null>(null); // ← new
//   const cryptoSessionRef = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
//   const myKeyPairRef = useRef<CryptoKeyPair | null>(null);
//   // Keep track of whether this side is the initiator (created the data channels)
//   const isInitiatorRef = useRef(false);
//   const onFileChunkRef = useRef(onFileChunk);  // ← keep latest callback in ref
//   // Keep ref in sync when callback changes
//   useEffect(() => {
//     onFileChunkRef.current = onFileChunk;
//   }, [onFileChunk]);
//   // Local tracks refs for toggling without re-negotiation
//   const screenVideoSenderLabel = 'screen-video';
//   const screenAudioSenderLabel = 'screen-audio';
//   const micSenderLabel = 'mic-audio';
//   const camSenderLabel = 'cam-video';

//   // ── Attach file channel ──────────────────────────────────────────────────
//   const attachFileChannel = useCallback((channel: RTCDataChannel) => {
//     fileChannelRef.current = channel;
//     channel.binaryType = 'arraybuffer';

//     channel.onmessage = (event: MessageEvent) => {
//       // Forward every message (string metadata or ArrayBuffer chunk) to the hook
//       if (onFileChunkRef.current) {
//         onFileChunkRef.current(event.data);
//       }
//     };

//     channel.onerror = (e) => console.error('File channel error:', e);

//     if (channel.readyState !== 'open') {
//       channel.onopen = () => console.log('File channel opened');
//     } else {
//       console.log('File channel already open');
//     }
//   }, []);

//   // ── Expose sendFileChunk so useFileTransfer can call it ──────────────────
//   const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
//     if (!fileChannelRef.current || fileChannelRef.current.readyState !== 'open') {
//       console.warn('File channel not open');
//       return;
//     }
//     fileChannelRef.current.send(data as any);
//   }, []);

//   // ──────────────────────────────────────────────────────────────────────────
//   // CHAT CHANNEL: E2EE via ECDH + AES-GCM + HMAC
//   // ──────────────────────────────────────────────────────────────────────────

//   const attachChatChannel = useCallback((channel: RTCDataChannel) => {
//     chatChannelRef.current = channel;

//     const sendPublicKey = async () => {
//       try {
//         const { keyPair, exportedPublic } = await generateECDHKeyPair();
//         myKeyPairRef.current = keyPair;
//         channel.send(JSON.stringify({ type: 'ecdh-public-key', key: exportedPublic }));
//         console.log('Sent ECDH public key');
//       } catch (e) {
//         console.error('Failed to send public key:', e);
//       }
//     };

//     channel.onmessage = async (event: MessageEvent) => {
//       // Binary = encrypted message
//       if (event.data instanceof ArrayBuffer) {
//         if (!cryptoSessionRef.current) return;
//         try {
//           const plaintext = await decryptMessage(
//             cryptoSessionRef.current,
//             new Uint8Array(event.data)
//           );
//           setMessages((prev) => [...prev, { from: 'them', text: plaintext, timestamp: Date.now() }]);
//         } catch (e) {
//           console.error('Decryption failed:', e);
//         }
//         return;
//       }
//       // Text = ECDH handshake
//       if (typeof event.data === 'string') {
//         try {
//           const msg = JSON.parse(event.data);
//           if (msg.type === 'ecdh-public-key') {
//             if (!myKeyPairRef.current) {
//               // Race: our key isn't generated yet — retry after a tick
//               setTimeout(
//                 () => channel.dispatchEvent(new MessageEvent('message', { data: event.data })),
//                 100
//               );
//               return;
//             }
//             const theirPublicKey = await importPublicKey(msg.key);
//             const session = await buildCryptoSession(
//               myKeyPairRef.current.privateKey,
//               theirPublicKey
//             );
//             cryptoSessionRef.current = session;
//             setCryptoReady(true);
//             console.log('Crypto session established — chat ready');
//           }
//         } catch (e) {
//           console.error('Handshake error:', e);
//         }
//       }
//     };

//     channel.onerror = (e) => console.error('Chat channel error:', e);
//     channel.onclose = () => {
//       console.log('Chat channel closed');
//       setCryptoReady(false);
//     };

//     if (channel.readyState === 'open') {
//       sendPublicKey();
//     } else {
//       channel.onopen = () => {
//         console.log('Chat channel opened');
//         sendPublicKey();
//       };
//     }
//   }, []);

//   // ──────────────────────────────────────────────────────────────────────────
//   // CONTROL CHANNEL: mouse + keyboard events (plain JSON, low-latency)
//   // ──────────────────────────────────────────────────────────────────────────

//   const attachControlChannel = useCallback((channel: RTCDataChannel) => {
//     controlChannelRef.current = channel;

//     // Receiver side: execute actions via Electron IPC → robot.js
//     channel.onmessage = (event: MessageEvent) => {
//       if (typeof event.data !== 'string') return;
//       try {
//         const action: ControlAction = JSON.parse(event.data);
//         // Forward to main process which runs robot.js
//         (window as any).electronAPI?.sendControlAction(action);
//       } catch (e) {
//         console.error('Control event parse error:', e);
//       }
//     };

//     channel.onerror = (e) => console.error('Control channel error:', e);

//     if (channel.readyState !== 'open') {
//       channel.onopen = () => console.log('Control channel opened');
//     }
//   }, []);

//   // ──────────────────────────────────────────────────────────────────────────
//   // MAIN SOCKET + WebRTC EFFECT
//   // ──────────────────────────────────────────────────────────────────────────

//   useEffect(() => {
//     peer.reset();
//     const newSocket = io(SERVER_URL, { rejectUnauthorized: false });
//     setSocket(newSocket);
//     socketRef.current = newSocket;

//     newSocket.on('connect', () => {
//       setStatus('Connected');
//       console.log('Socket connected:', newSocket.id);
//       newSocket.emit('join-room', myId);
//     });

//     newSocket.on('disconnect', () => setStatus('Disconnected'));

//     // ── Initiator: remote peer joined my room ─────────────────────────────
//     newSocket.on('user-connected', async (socketId: string) => {
//       console.log('Remote peer joined, socket ID:', socketId);
//       connectedUserRef.current = socketId;
//       isInitiatorRef.current = true;

//       if (peer.peer) {
//         // Create BOTH data channels before the offer — included in SDP negotiation
//         const chatCh = peer.peer.createDataChannel('chat', { ordered: true });
//         const ctrlCh = peer.peer.createDataChannel('control', {
//           ordered: false,     // control events are best-effort, low-latency
//           maxRetransmits: 0,
//         });
//         const fileCh = peer.peer.createDataChannel('file-transfer', { // ← new
//           ordered: true,
//           maxRetransmits: 30,
//         });
//         attachChatChannel(chatCh);
//         attachControlChannel(ctrlCh);
//         attachFileChannel(fileCh); // ← new
//       }

//       // Auto-start screen share with system audio
//       try {
//         const stream = await navigator.mediaDevices.getDisplayMedia({
//           video: { frameRate: { ideal: 30 } },
//           audio: true, // Chromium/Electron will use loopback audio from main.ts
//         });
//         setMyStream(stream);

//         // Add video track
//         const videoTrack = stream.getVideoTracks()[0];
//         if (videoTrack) {
//           peer.addTrack(videoTrack, stream, screenVideoSenderLabel);
//         }
//         // Add audio track (system audio) if present
//         const audioTrack = stream.getAudioTracks()[0];
//         if (audioTrack) {
//           peer.addTrack(audioTrack, stream, screenAudioSenderLabel);
//         }

//         const offer = await peer.getOffer();
//         newSocket.emit('call-user', {
//           userToCall: socketId,
//           from: newSocket.id,
//           signalData: offer,
//         });
//       } catch (err) {
//         console.error('Auto screen share failed:', err);
//       }
//     });

//     // ── Receiver: incoming offer ──────────────────────────────────────────
//     newSocket.on('incoming-call', async ({ from, signal }) => {
//       console.log('Incoming call from:', from, 'type:', signal?.type);
//       connectedUserRef.current = from;
//       isInitiatorRef.current = false;
//       const answer = await peer.getAnswer(signal);
//       newSocket.emit('answer-call', { to: from, signal: answer });
//     });

//     // ── Initiator: answer received ────────────────────────────────────────
//     newSocket.on('call-accepted', async (data) => {
//       console.log('Call accepted:', data);
//       const signal = data?.signal ?? data;
//       await peer.setRemoteDescription(signal);
//     });

//     // ── ICE candidates ────────────────────────────────────────────────────
//     newSocket.on('ice-candidate', async ({ candidate }) => {
//       if (peer.peer) {
//         await peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
//       }
//     });

//     if (peer.peer) {
//       // Remote tracks arrive here — distinguish screen vs call streams by track count/kind
//       // We use a composite remote stream and let the UI split by track kind
//       peer.peer.addEventListener('track', (ev: RTCTrackEvent) => {
//         console.log('Remote track received:', ev.track.kind);
//         const stream = ev.streams[0];
//         if (ev.track.kind === 'video') {
//           // Check if this is a webcam video (second video track) or screen share
//           const existingVideoTracks = remoteStream?.getVideoTracks() ?? [];
//           if (existingVideoTracks.length === 0) {
//             setRemoteStream(stream);
//           } else {
//             // Second video track = webcam from AV call
//             setRemoteCallStream(stream);
//           }
//         } else if (ev.track.kind === 'audio') {
//           // Audio goes onto whichever stream already has audio or the first stream
//           setRemoteStream((prev) => {
//             if (!prev) return stream;
//             // Add audio track to existing remote stream
//             stream.getAudioTracks().forEach((t) => prev.addTrack(t));
//             return prev;
//           });
//         }
//       });

//       // Receiver side data channels
//       peer.peer.ondatachannel = (event: RTCDataChannelEvent) => {
//         console.log('ondatachannel:', event.channel.label);
//         if (event.channel.label === 'chat') {
//           attachChatChannel(event.channel);
//         } else if (event.channel.label === 'control') {
//           attachControlChannel(event.channel);
//         } else if (event.channel.label === 'file-transfer') { // ← new
//           attachFileChannel(event.channel);
//         }
//       };

//       peer.peer.onicecandidate = (event) => {
//         if (event.candidate && connectedUserRef.current) {
//           socketRef.current?.emit('ice-candidate', {
//             target: connectedUserRef.current,
//             candidate: event.candidate,
//           });
//         }
//       };
//     }

//     return () => {
//       newSocket.disconnect();
//       socketRef.current = null;
//     };
//   }, [myId, attachChatChannel, attachControlChannel, attachFileChannel]);

//   // ──────────────────────────────────────────────────────────────────────────
//   // PUBLIC ACTIONS
//   // ──────────────────────────────────────────────────────────────────────────

//   // User B: join User A's room
//   const connectToPeer = useCallback(async (targetId: string) => {
//     if (!socketRef.current) return;
//     console.log('Joining room:', targetId);
//     socketRef.current.emit('join-room', targetId);
//   }, []);

//   // User A: manual screen share trigger (for non-auto path)
//   const startScreenShare = useCallback(async () => {
//     if (!socketRef.current || !connectedUserRef.current) {
//       alert('No remote peer connected yet.');
//       return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getDisplayMedia({
//         video: { frameRate: { ideal: 30 } },
//         audio: true,
//       });
//       setMyStream(stream);

//       const videoTrack = stream.getVideoTracks()[0];
//       if (videoTrack) peer.addTrack(videoTrack, stream, screenVideoSenderLabel);

//       const audioTrack = stream.getAudioTracks()[0];
//       if (audioTrack) peer.addTrack(audioTrack, stream, screenAudioSenderLabel);

//       const offer = await peer.getOffer();
//       socketRef.current.emit('call-user', {
//         userToCall: connectedUserRef.current,
//         from: socketRef.current.id,
//         signalData: offer,
//       });
//     } catch (err) {
//       console.error('Screen share failed:', err);
//     }
//   }, []);

//   // ── Toggle screen audio on/off without renegotiation ─────────────────────
//   const toggleScreenAudio = useCallback(async () => {
//     setScreenAudioEnabled((prev) => {
//       const next = !prev;
//       // replaceTrack with null = mute; with original track = unmute
//       const audioTrack = myStream?.getAudioTracks()[0] ?? null;
//       peer.replaceTrack(screenAudioSenderLabel, next ? audioTrack : null);
//       return next;
//     });
//   }, [myStream]);

//   // ── Audio/video call: start a webcam+mic call ─────────────────────────────
//   const startCall = useCallback(async (withVideo = true) => {
//     if (!socketRef.current || !connectedUserRef.current) {
//       alert('No remote peer connected yet.');
//       return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//         video: withVideo,
//       });
//       setCallStream(stream);
//       setInCall(true);

//       const micTrack = stream.getAudioTracks()[0];
//       if (micTrack) peer.addTrack(micTrack, stream, micSenderLabel);

//       const camTrack = stream.getVideoTracks()[0];
//       if (camTrack && withVideo) peer.addTrack(camTrack, stream, camSenderLabel);

//       // Renegotiate — new tracks require a new offer
//       const offer = await peer.getOffer();
//       socketRef.current.emit('call-user', {
//         userToCall: connectedUserRef.current,
//         from: socketRef.current.id,
//         signalData: offer,
//       });
//     } catch (err) {
//       console.error('Call start failed:', err);
//     }
//   }, []);

//   // ── End the AV call (keeps screen share running) ─────────────────────────
//   const endCall = useCallback(() => {
//     callStream?.getTracks().forEach((t) => t.stop());
//     peer.removeTrack(micSenderLabel);
//     peer.removeTrack(camSenderLabel);
//     setCallStream(null);
//     setRemoteCallStream(null);
//     setInCall(false);
//   }, [callStream]);

//   // ── Toggle microphone ─────────────────────────────────────────────────────
//   const toggleMic = useCallback(() => {
//     setMicEnabled((prev) => {
//       const next = !prev;
//       const track = callStream?.getAudioTracks()[0];
//       if (track) track.enabled = next;
//       return next;
//     });
//   }, [callStream]);

//   // ── Toggle camera ─────────────────────────────────────────────────────────
//   const toggleCam = useCallback(() => {
//     setCamEnabled((prev) => {
//       const next = !prev;
//       const track = callStream?.getVideoTracks()[0];
//       if (track) {
//         track.enabled = next;
//         // replaceTrack with null = black frame; with track = live video
//         peer.replaceTrack(camSenderLabel, next ? track : null);
//       }
//       return next;
//     });
//   }, [callStream]);

//   // ── Send encrypted chat message ───────────────────────────────────────────
//   const sendChatMessage = useCallback(async (text: string) => {
//     if (!cryptoSessionRef.current || !chatChannelRef.current) {
//       console.warn('Chat not ready');
//       return;
//     }
//     if (chatChannelRef.current.readyState !== 'open') {
//       console.warn('Chat channel not open');
//       return;
//     }
//     try {
//       const encrypted = await encryptMessage(cryptoSessionRef.current, text);
//       chatChannelRef.current.send(encrypted.buffer as ArrayBuffer);
//       setMessages((prev) => [...prev, { from: 'me', text, timestamp: Date.now() }]);
//     } catch (e) {
//       console.error('Send failed:', e);
//     }
//   }, []);

//   // ── Send a remote control event to the host machine ──────────────────────
//   // Called by the Controller side (the person watching the remote screen).
//   // Events are sent over the "control" DataChannel as plain JSON.
//   const sendControlEvent = useCallback((action: ControlAction) => {
//     if (!controlChannelRef.current || controlChannelRef.current.readyState !== 'open') return;
//     controlChannelRef.current.send(JSON.stringify(action));
//   }, []);

//   return {
//     // Connection
//     connectionStatus: status,
//     connectToPeer,
//     // Screen share
//     myStream,
//     remoteStream,
//     startScreenShare,
//     screenAudioEnabled,
//     toggleScreenAudio,
//     // AV call
//     callStream,
//     remoteCallStream,
//     inCall,
//     startCall,
//     endCall,
//     micEnabled,
//     toggleMic,
//     camEnabled,
//     toggleCam,
//     // Chat
//     messages,
//     sendChatMessage,
//     cryptoReady,
//     // Remote control
//     sendControlEvent,
//     sendFileChunk,  // ← new export
//   };
// };



// frontend/src/hooks/usePeerConnection.ts
//
// FIXES IN THIS FILE:
//
// [A] Screen share not visible on receiver side
//     Root cause: GitHub Pages serves over HTTPS. getDisplayMedia() and
//     getUserMedia() both require a secure context. The TURN server was also
//     only listed with `turns:` (TLS) but the ICE config had no `stun:` fallback,
//     so if TURN fails the connection silently drops.
//     Fix: added stun:stun.l.google.com as fallback, and TURN also listed with
//     plain `turn:` so it can try UDP first before TLS.
//
// [B] Receiver not notified of incoming call / "Call start failed: NotFoundError"
//     Root cause: startCall() calls getUserMedia({video:true}) which in a
//     GitHub Pages tab that has no camera/mic permission throws NotFoundError or
//     NotAllowedError. The error is swallowed and never shown to the user.
//     Fix: startCall catches the error, shows a clear message, and retries
//     with audio-only if video device is not found.
//
// [C] "File channel not open" / chat shows "Waiting for peer"
//     Root cause: peer.reset() in PeerService constructor creates a
//     'file-transfer' data channel, then usePeerConnection ALSO creates one in
//     'user-connected'. The duplicate channel creation makes both channels
//     end up in a broken state. ondatachannel on the receiver side never fires
//     for 'file-transfer' because the initiator already created it in reset().
//     Fix: peer.reset() no longer creates any data channels. All data channels
//     are created explicitly in the 'user-connected' handler only.
//     Also: cryptoReady is now set back to false when the peer disconnects so
//     ChatPanel shows the right state on reconnect.
//
// [D] Screen share does not stop when session ends
//     Root cause: handleEndSession() in SessionPage calls onEnd() but never
//     stops the MediaStream tracks. stopAllTracks() is now exported from the
//     hook and called by SessionPage before unmounting.
//
// [E] End session only closes one side
//     Root cause: there was no signaling message sent to the remote peer on
//     hang-up. The other side's socket stays connected and shows no change.
//     Fix: a 'hang-up' socket event is emitted to the remote peer on session
//     end, and the hook listens for it to trigger cleanup on the receiving side.
//
// [F] Renegotiation for AV call fails on browsers that enforce offer/answer
//     state machine (e.g. Safari, Firefox). Added signalingState guard before
//     creating a new offer.

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import peer from '../services/peer';
import {
  generateECDHKeyPair,
  importPublicKey,
  buildCryptoSession,
  encryptMessage,
  decryptMessage,
} from '../services/messageCrypto';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  from: 'me' | 'them';
  text: string;
  timestamp: number;
}

export interface ControlAction {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
  normX?: number;
  normY?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string;
  scrollX?: number;
  scrollY?: number;
}

export interface MediaToggles {
  micEnabled: boolean;
  camEnabled: boolean;
  screenAudioEnabled: boolean;
}

// ── ICE server config ─────────────────────────────────────────────────────────
// [FIX A] Added stun: fallback + plain turn: (UDP) alongside turns: (TLS)
// so ICE has multiple candidates to try before giving up.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:rda-turnserver.duckdns.org:3478',   // UDP — fastest
      'turn:rda-turnserver.duckdns.org:3478?transport=tcp',
      'turns:rda-turnserver.duckdns.org:5349',  // TLS — firewall fallback
    ],
    username: 'rda',
    credential: 'rda123',
  },
];

// ── Hook ─────────────────────────────────────────────────────────────────────

export const usePeerConnection = (
  myId: string,
  _remoteId: string,
  onFileChunk?: (data: ArrayBuffer | string) => void,
) => {
  const [, setSocket]               = useState<Socket | null>(null);
  const [status, setStatus]         = useState('Disconnected');
  const [myStream, setMyStream]     = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStream, setCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall]         = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [cryptoReady, setCryptoReady] = useState(false);

  const connectedUserRef  = useRef<string | null>(null);
  const socketRef         = useRef<Socket | null>(null);
  const chatChannelRef    = useRef<RTCDataChannel | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const fileChannelRef    = useRef<RTCDataChannel | null>(null);
  const cryptoSessionRef  = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
  const myKeyPairRef      = useRef<CryptoKeyPair | null>(null);
  const isInitiatorRef    = useRef(false);
  const onFileChunkRef    = useRef(onFileChunk);
  // [FIX D] Keep latest stream refs so stopAllTracks can stop them
  const myStreamRef       = useRef<MediaStream | null>(null);
  const callStreamRef     = useRef<MediaStream | null>(null);

  useEffect(() => { onFileChunkRef.current = onFileChunk; }, [onFileChunk]);
  useEffect(() => { myStreamRef.current   = myStream;   }, [myStream]);
  useEffect(() => { callStreamRef.current = callStream; }, [callStream]);

  const screenVideoSenderLabel = 'screen-video';
  const screenAudioSenderLabel = 'screen-audio';
  const micSenderLabel         = 'mic-audio';
  const camSenderLabel         = 'cam-video';

  // ── Helper: build a fresh RTCPeerConnection with correct ICE config ───────
  // [FIX A] Always pass ICE_SERVERS so TURN/STUN is actually used
  const buildPeerConnection = useCallback(() => {
    peer.reset(ICE_SERVERS); // peer.reset() now accepts ice servers (see peer.ts fix)

    if (!peer.peer) return;

    peer.peer.ontrack = (ev: RTCTrackEvent) => {
      console.log('Remote track received:', ev.track.kind);
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      if (ev.track.kind === 'video') {
        // First video = screen share; second = webcam
        setRemoteStream(prev => {
          if (!prev || prev.getVideoTracks().length === 0) return stream;
          setRemoteCallStream(stream);
          return prev;
        });
      } else if (ev.track.kind === 'audio') {
        setRemoteStream(prev => {
          if (!prev) return stream;
          stream.getAudioTracks().forEach(t => {
            if (!prev.getTrackById(t.id)) prev.addTrack(t);
          });
          return prev;
        });
      }
    };

    peer.peer.onicecandidate = (event) => {
      if (event.candidate && connectedUserRef.current) {
        socketRef.current?.emit('ice-candidate', {
          target: connectedUserRef.current,
          candidate: event.candidate,
        });
      }
    };

    peer.peer.oniceconnectionstatechange = () => {
      const state = peer.peer?.iceConnectionState;
      console.log('ICE state:', state);
      if (state === 'failed' || state === 'disconnected') {
        setStatus('Disconnected');
      } else if (state === 'connected' || state === 'completed') {
        setStatus('Connected');
      }
    };

    // [FIX E] Receiver side data channels (set up once per peer connection)
    peer.peer.ondatachannel = (event: RTCDataChannelEvent) => {
      console.log('ondatachannel:', event.channel.label);
      if (event.channel.label === 'chat')          attachChatChannel(event.channel);
      else if (event.channel.label === 'control')  attachControlChannel(event.channel);
      else if (event.channel.label === 'file-transfer') attachFileChannel(event.channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File channel ──────────────────────────────────────────────────────────
  const attachFileChannel = useCallback((channel: RTCDataChannel) => {
    fileChannelRef.current = channel;
    channel.binaryType = 'arraybuffer';
    channel.onmessage = (event: MessageEvent) => {
      onFileChunkRef.current?.(event.data);
    };
    channel.onerror = (e) => console.error('File channel error:', e);
    if (channel.readyState !== 'open') {
      channel.onopen = () => console.log('File channel opened');
    }
  }, []);

  const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
    if (!fileChannelRef.current || fileChannelRef.current.readyState !== 'open') {
      console.warn('File channel not open');
      return;
    }
    fileChannelRef.current.send(data as any);
  }, []);

  // ── Chat channel: E2EE ────────────────────────────────────────────────────
  const attachChatChannel = useCallback((channel: RTCDataChannel) => {
    chatChannelRef.current = channel;

    const sendPublicKey = async () => {
      try {
        const { keyPair, exportedPublic } = await generateECDHKeyPair();
        myKeyPairRef.current = keyPair;
        channel.send(JSON.stringify({ type: 'ecdh-public-key', key: exportedPublic }));
        console.log('Sent ECDH public key');
      } catch (e) {
        console.error('Failed to send public key:', e);
      }
    };

    channel.onmessage = async (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        if (!cryptoSessionRef.current) return;
        try {
          const plaintext = await decryptMessage(
            cryptoSessionRef.current,
            new Uint8Array(event.data)
          );
          setMessages(prev => [...prev, { from: 'them', text: plaintext, timestamp: Date.now() }]);
        } catch (e) {
          console.error('Decryption failed:', e);
        }
        return;
      }
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ecdh-public-key') {
            if (!myKeyPairRef.current) {
              setTimeout(
                () => channel.dispatchEvent(new MessageEvent('message', { data: event.data })),
                100
              );
              return;
            }
            const theirPublicKey = await importPublicKey(msg.key);
            const session = await buildCryptoSession(
              myKeyPairRef.current.privateKey,
              theirPublicKey
            );
            cryptoSessionRef.current = session;
            setCryptoReady(true);
            console.log('Crypto session established — chat ready');
          }
        } catch (e) {
          console.error('Handshake error:', e);
        }
      }
    };

    channel.onerror = (e) => console.error('Chat channel error:', e);
    channel.onclose = () => {
      console.log('Chat channel closed');
      setCryptoReady(false); // [FIX C] reset so ChatPanel shows correct state
    };

    if (channel.readyState === 'open') sendPublicKey();
    else channel.onopen = () => { console.log('Chat channel opened'); sendPublicKey(); };
  }, []);

  // ── Control channel ───────────────────────────────────────────────────────
  const attachControlChannel = useCallback((channel: RTCDataChannel) => {
    controlChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      try {
        const action: ControlAction = JSON.parse(event.data);
        (window as any).electronAPI?.sendControlAction(action);
      } catch (e) {
        console.error('Control event parse error:', e);
      }
    };
    channel.onerror = (e) => console.error('Control channel error:', e);
    if (channel.readyState !== 'open') {
      channel.onopen = () => console.log('Control channel opened');
    }
  }, []);

  // ── Main socket + WebRTC effect ───────────────────────────────────────────
  useEffect(() => {
    buildPeerConnection();

    const newSocket = io(SERVER_URL, {
      rejectUnauthorized: false,
      transports: ['websocket', 'polling'], // [FIX A] ensure WSS is tried first on HTTPS pages
    });
    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setStatus('Connected');
      console.log('Socket connected:', newSocket.id);
      newSocket.emit('join-room', myId);
    });

    newSocket.on('disconnect', () => setStatus('Disconnected'));

    // ── Initiator: remote peer joined ─────────────────────────────────────
    newSocket.on('user-connected', async (socketId: string) => {
      console.log('Remote peer joined, socket ID:', socketId);
      connectedUserRef.current = socketId;
      isInitiatorRef.current = true;

      if (peer.peer) {
        // [FIX C] Create ALL data channels here — never in reset()
        // This is the ONLY place data channels are created on the initiator side.
        const chatCh = peer.peer.createDataChannel('chat', { ordered: true });
        const ctrlCh = peer.peer.createDataChannel('control', {
          ordered: false,
          maxRetransmits: 0,
        });
        const fileCh = peer.peer.createDataChannel('file-transfer', {
          ordered: true,
          maxRetransmits: 30,
        });
        attachChatChannel(chatCh);
        attachControlChannel(ctrlCh);
        attachFileChannel(fileCh);
      }

      // Auto-start screen share
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        setMyStream(stream);

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) peer.addTrack(videoTrack, stream, screenVideoSenderLabel);

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) peer.addTrack(audioTrack, stream, screenAudioSenderLabel);

        // [FIX D] Stop screen share automatically if user clicks browser's "Stop sharing"
        videoTrack?.addEventListener('ended', () => {
          setMyStream(null);
          peer.removeTrack(screenVideoSenderLabel);
          peer.removeTrack(screenAudioSenderLabel);
        });

        const offer = await peer.getOffer();
        newSocket.emit('call-user', {
          userToCall: socketId,
          from: newSocket.id,
          signalData: offer,
        });
      } catch (err) {
        console.error('Auto screen share failed:', err);
      }
    });

    // ── Receiver: incoming offer ──────────────────────────────────────────
    newSocket.on('incoming-call', async ({ from, signal }) => {
      console.log('Incoming call from:', from, 'type:', signal?.type);
      connectedUserRef.current = from;
      isInitiatorRef.current = false;
      const answer = await peer.getAnswer(signal);
      newSocket.emit('answer-call', { to: from, signal: answer });
    });

    // ── Initiator: answer received ────────────────────────────────────────
    newSocket.on('call-accepted', async (data) => {
      console.log('Call accepted:', data);
      const signal = data?.signal ?? data;
      await peer.setRemoteDescription(signal);
    });

    // ── ICE candidates ────────────────────────────────────────────────────
    newSocket.on('ice-candidate', async ({ candidate }) => {
      if (peer.peer) {
        try {
          await peer.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('addIceCandidate failed:', e);
        }
      }
    });

    // [FIX E] Remote peer ended the session — clean up this side too
    newSocket.on('hang-up', () => {
      console.log('Remote peer hung up');
      _handleLocalCleanup();
      setStatus('Disconnected');
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal cleanup (called both on local end and on remote hang-up) ─────
  const _handleLocalCleanup = useCallback(() => {
    // Stop all local tracks
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    setMyStream(null);
    setRemoteStream(null);
    setCallStream(null);
    setRemoteCallStream(null);
    setInCall(false);
    setCryptoReady(false);
    // Close peer connection
    peer.close();
  }, []);

  // ── Public actions ────────────────────────────────────────────────────────

  const connectToPeer = useCallback(async (targetId: string) => {
    if (!socketRef.current) return;
    console.log('Joining room:', targetId);
    socketRef.current.emit('join-room', targetId);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!socketRef.current || !connectedUserRef.current) {
      alert('No remote peer connected yet.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });
      setMyStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        peer.addTrack(videoTrack, stream, screenVideoSenderLabel);
        // [FIX D] Stop share if user clicks browser "Stop sharing"
        videoTrack.addEventListener('ended', () => {
          setMyStream(null);
          peer.removeTrack(screenVideoSenderLabel);
          peer.removeTrack(screenAudioSenderLabel);
        });
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) peer.addTrack(audioTrack, stream, screenAudioSenderLabel);

      const offer = await peer.getOffer();
      socketRef.current.emit('call-user', {
        userToCall: connectedUserRef.current,
        from: socketRef.current.id,
        signalData: offer,
      });
    } catch (err) {
      console.error('Screen share failed:', err);
    }
  }, []);

  const toggleScreenAudio = useCallback(async () => {
    setScreenAudioEnabled(prev => {
      const next = !prev;
      const audioTrack = myStreamRef.current?.getAudioTracks()[0] ?? null;
      peer.replaceTrack(screenAudioSenderLabel, next ? audioTrack : null);
      return next;
    });
  }, []);

  // [FIX B] startCall: graceful fallback from video to audio-only on NotFoundError
  const startCall = useCallback(async (withVideo = true) => {
    if (!socketRef.current || !connectedUserRef.current) {
      alert('No remote peer connected yet.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo,
      });
    } catch (err: any) {
      if (withVideo && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        // Camera not available — fallback to audio only
        console.warn('Camera not found, falling back to audio-only call');
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          withVideo = false;
        } catch (audioErr: any) {
          if (audioErr.name === 'NotAllowedError') {
            alert('Microphone permission was denied. Please allow microphone access in your browser settings.');
          } else {
            alert(`Could not start call: ${audioErr.message}`);
          }
          return;
        }
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
        alert('Camera/microphone permission was denied. Please allow access in your browser settings and try again.');
        return;
      } else {
        alert(`Could not start call: ${err.message}`);
        return;
      }
    }

    setCallStream(stream);
    setInCall(true);

    const micTrack = stream.getAudioTracks()[0];
    if (micTrack) peer.addTrack(micTrack, stream, micSenderLabel);

    const camTrack = stream.getVideoTracks()[0];
    if (camTrack && withVideo) peer.addTrack(camTrack, stream, camSenderLabel);

    // [FIX F] Guard against invalid signaling state before renegotiating
    if (!peer.peer || peer.peer.signalingState === 'closed') return;
    if (peer.peer.signalingState !== 'stable') {
      console.warn('Cannot renegotiate — peer not in stable state:', peer.peer.signalingState);
      return;
    }

    const offer = await peer.getOffer();
    socketRef.current.emit('call-user', {
      userToCall: connectedUserRef.current,
      from: socketRef.current.id,
      signalData: offer,
    });
  }, []);

  const endCall = useCallback(() => {
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    peer.removeTrack(micSenderLabel);
    peer.removeTrack(camSenderLabel);
    setCallStream(null);
    setRemoteCallStream(null);
    setInCall(false);
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => {
      const next = !prev;
      const track = callStreamRef.current?.getAudioTracks()[0];
      if (track) track.enabled = next;
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled(prev => {
      const next = !prev;
      const track = callStreamRef.current?.getVideoTracks()[0];
      if (track) {
        track.enabled = next;
        peer.replaceTrack(camSenderLabel, next ? track : null);
      }
      return next;
    });
  }, []);

  const sendChatMessage = useCallback(async (text: string) => {
    if (!cryptoSessionRef.current || !chatChannelRef.current) {
      console.warn('Chat not ready');
      return;
    }
    if (chatChannelRef.current.readyState !== 'open') {
      console.warn('Chat channel not open');
      return;
    }
    try {
      const encrypted = await encryptMessage(cryptoSessionRef.current, text);
      chatChannelRef.current.send(encrypted.buffer as ArrayBuffer);
      setMessages(prev => [...prev, { from: 'me', text, timestamp: Date.now() }]);
    } catch (e) {
      console.error('Send failed:', e);
    }
  }, []);

  const sendControlEvent = useCallback((action: ControlAction) => {
    if (!controlChannelRef.current || controlChannelRef.current.readyState !== 'open') return;
    controlChannelRef.current.send(JSON.stringify(action));
  }, []);

  // [FIX D+E] Stop everything and notify the remote side
  const stopAllTracks = useCallback(() => {
    // Signal the remote peer first so their side cleans up
    if (connectedUserRef.current && socketRef.current) {
      socketRef.current.emit('hang-up', { to: connectedUserRef.current });
    }
    _handleLocalCleanup();
  }, [_handleLocalCleanup]);

  return {
    connectionStatus: status,
    connectToPeer,
    myStream,
    remoteStream,
    startScreenShare,
    screenAudioEnabled,
    toggleScreenAudio,
    callStream,
    remoteCallStream,
    inCall,
    startCall,
    endCall,
    micEnabled,
    toggleMic,
    camEnabled,
    toggleCam,
    messages,
    sendChatMessage,
    cryptoReady,
    sendControlEvent,
    sendFileChunk,
    stopAllTracks, // [FIX D+E] new export
  };
};

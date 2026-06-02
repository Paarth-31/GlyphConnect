// // frontend/src/hooks/usePeerConnection.ts
// //
// // FIX: Socket.io client reconnection config
// //
// // The old config was: io(SERVER_URL, { rejectUnauthorized: false })
// // No reconnection settings = socket.io defaults:
// //   reconnectionDelay:    1000ms (fixed, no backoff)
// //   reconnectionAttempts: Infinity
// //
// // When the server's rate limiter blocked a connection, socket.io
// // immediately retried after 1 second. The retry also got rate-limited.
// // This created a tight loop of: fail → retry → fail → retry…
// // That's why the console showed 11+ identical WSS failures.
// //
// // FIX: Added exponential backoff (1s → 2s → 4s → max 30s) with a
// // cap of 5 reconnection attempts. After 5 failures the socket stops
// // and the UI shows a clear "Disconnected" state instead of hammering
// // the server forever.
// //
// // Also added transports: ['websocket', 'polling'] — polling is needed
// // as a fallback during the WebSocket upgrade handshake. Without it,
// // if the WebSocket upgrade fails once, there's no fallback.

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

// const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// // ── Types ─────────────────────────────────────────────────────────────────────

// export interface ChatMessage {
//   from: 'me' | 'them';
//   text: string;
//   timestamp: number;
// }

// export interface ControlAction {
//   type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
//   normX?: number;
//   normY?: number;
//   button?: 'left' | 'right' | 'middle';
//   key?: string;
//   scrollX?: number;
//   scrollY?: number;
// }

// type ControlMsg =
//   | ControlAction
//   | { type: 'control-grant' }
//   | { type: 'control-revoke' };

// // ── Hook ─────────────────────────────────────────────────────────────────────

// export const usePeerConnection = (
//   myId: string,
//   _remoteId: string,
//   onFileChunk?: (data: ArrayBuffer | string) => void,
// ) => {
//   const [status, setStatus]               = useState('Disconnected');
//   const [myStream, setMyStream]           = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);
//   const [callStream, setCallStream]       = useState<MediaStream | null>(null);
//   const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
//   const [inCall, setInCall]               = useState(false);
//   const [micEnabled, setMicEnabled]       = useState(true);
//   const [camEnabled, setCamEnabled]       = useState(true);
//   const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
//   const [messages, setMessages]           = useState<ChatMessage[]>([]);
//   const [cryptoReady, setCryptoReady]     = useState(false);
//   const [amInitiator, setAmInitiator]     = useState(false);
//   const [controlGranted, setControlGranted] = useState(false);
//   const [reconnectAttempt, setReconnectAttempt] = useState(0);

//   const socketRef        = useRef<Socket | null>(null);
//   const connectedUserRef = useRef<string | null>(null);
//   const isInitiatorRef   = useRef(false);
//   const chatChannelRef   = useRef<RTCDataChannel | null>(null);
//   const controlChannelRef = useRef<RTCDataChannel | null>(null);
//   const fileChannelRef   = useRef<RTCDataChannel | null>(null);
//   const cryptoRef        = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
//   const keyPairRef       = useRef<CryptoKeyPair | null>(null);
//   const onFileChunkRef   = useRef(onFileChunk);
//   const remoteStreamRef  = useRef<MediaStream | null>(null);
//   const myStreamRef      = useRef<MediaStream | null>(null);
//   const callStreamRef    = useRef<MediaStream | null>(null);

//   useEffect(() => { onFileChunkRef.current = onFileChunk; }, [onFileChunk]);
//   useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
//   useEffect(() => { myStreamRef.current = myStream; }, [myStream]);
//   useEffect(() => { callStreamRef.current = callStream; }, [callStream]);

//   const SCREEN_VIDEO = 'screen-video';
//   const SCREEN_AUDIO = 'screen-audio';
//   const MIC_AUDIO    = 'mic-audio';
//   const CAM_VIDEO    = 'cam-video';

//   // ── DataChannel: file ─────────────────────────────────────────────────────
//   const attachFileChannel = useCallback((ch: RTCDataChannel) => {
//     ch.binaryType = 'arraybuffer';
//     fileChannelRef.current = ch;
//     ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
//     ch.onerror   = (e) => console.error('File channel error:', e);
//     ch.onopen    = () => console.log('File channel open');
//     ch.onclose   = () => console.log('File channel closed');
//   }, []);

//   const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
//     const ch = fileChannelRef.current;
//     if (!ch || ch.readyState !== 'open') { console.warn('File channel not open'); return; }
//     ch.send(data as any);
//   }, []);

//   // ── DataChannel: encrypted chat ───────────────────────────────────────────
//   const attachChatChannel = useCallback((ch: RTCDataChannel) => {
//     chatChannelRef.current = ch;

//     const sendKey = async () => {
//       const { keyPair, exportedPublic } = await generateECDHKeyPair();
//       keyPairRef.current = keyPair;
//       ch.send(JSON.stringify({ type: 'ecdh-public-key', key: exportedPublic }));
//     };

//     ch.onmessage = async (e) => {
//       if (e.data instanceof ArrayBuffer) {
//         if (!cryptoRef.current) return;
//         try {
//           const text = await decryptMessage(cryptoRef.current, new Uint8Array(e.data));
//           setMessages(prev => [...prev, { from: 'them', text, timestamp: Date.now() }]);
//         } catch (err) { console.error('Decrypt failed:', err); }
//         return;
//       }
//       try {
//         const msg = JSON.parse(e.data as string);
//         if (msg.type === 'ecdh-public-key') {
//           if (!keyPairRef.current) {
//             setTimeout(() => ch.dispatchEvent(new MessageEvent('message', { data: e.data })), 100);
//             return;
//           }
//           const theirKey = await importPublicKey(msg.key);
//           cryptoRef.current = await buildCryptoSession(keyPairRef.current.privateKey, theirKey);
//           setCryptoReady(true);
//           console.log('E2EE chat ready');
//         }
//       } catch (err) { console.error('ECDH error:', err); }
//     };

//     ch.onerror  = (e) => console.error('Chat error:', e);
//     ch.onclose  = () => { setCryptoReady(false); };
//     ch.onopen   = () => sendKey();
//     if (ch.readyState === 'open') sendKey();
//   }, []);

//   const sendChatMessage = useCallback(async (text: string) => {
//     const ch = chatChannelRef.current;
//     if (!cryptoRef.current || !ch || ch.readyState !== 'open') return;
//     const enc = await encryptMessage(cryptoRef.current, text);
//     ch.send(enc.buffer as ArrayBuffer);
//     setMessages(prev => [...prev, { from: 'me', text, timestamp: Date.now() }]);
//   }, []);

//   // ── DataChannel: control ──────────────────────────────────────────────────
//   const attachControlChannel = useCallback((ch: RTCDataChannel) => {
//     controlChannelRef.current = ch;
//     ch.onmessage = (e) => {
//       if (typeof e.data !== 'string') return;
//       try {
//         const msg: ControlMsg = JSON.parse(e.data);
//         if (msg.type === 'control-grant')  { setControlGranted(true);  return; }
//         if (msg.type === 'control-revoke') { setControlGranted(false); return; }
//         if (isInitiatorRef.current) {
//           (window as any).electronAPI?.sendControlAction(msg);
//         }
//       } catch {}
//     };
//     ch.onerror = (e) => console.error('Control error:', e);
//   }, []);

//   const grantControl  = useCallback(() => {
//     controlChannelRef.current?.readyState === 'open' &&
//       controlChannelRef.current.send(JSON.stringify({ type: 'control-grant' }));
//   }, []);

//   const revokeControl = useCallback(() => {
//     controlChannelRef.current?.readyState === 'open' &&
//       controlChannelRef.current.send(JSON.stringify({ type: 'control-revoke' }));
//     setControlGranted(false);
//   }, []);

//   const sendControlEvent = useCallback((action: ControlAction) => {
//     const ch = controlChannelRef.current;
//     if (!ch || ch.readyState !== 'open' || !controlGranted) return;
//     ch.send(JSON.stringify(action));
//   }, [controlGranted]);

//   // ── Cleanup ───────────────────────────────────────────────────────────────
//   const _cleanup = useCallback(() => {
//     myStreamRef.current?.getTracks().forEach(t => t.stop());
//     callStreamRef.current?.getTracks().forEach(t => t.stop());
//     setMyStream(null);
//     setRemoteStream(null);
//     setCallStream(null);
//     setRemoteCallStream(null);
//     setInCall(false);
//     setCryptoReady(false);
//     setControlGranted(false);
//     setAmInitiator(false);
//     peer.close();
//     cryptoRef.current  = null;
//     keyPairRef.current = null;
//   }, []);

//   // ── Main effect ───────────────────────────────────────────────────────────
//   useEffect(() => {
//     peer.reset();

//     // [FIX] Proper socket.io config:
//     //   transports: ['websocket','polling'] — polling is needed as upgrade
//     //     fallback; without it a single WebSocket failure = total failure
//     //   reconnectionDelay / reconnectionDelayMax: exponential backoff so
//     //     failed retries don't immediately hammer the server again
//     //   reconnectionAttempts: 5 — stop after 5 failures instead of forever,
//     //     avoids the infinite cascade that filled the console
//     const socket = io(SERVER_URL, {
//       transports: ['websocket', 'polling'],
//       reconnection:           true,
//       reconnectionAttempts:   5,
//       reconnectionDelay:      1000,   // start at 1s
//       reconnectionDelayMax:   30000,  // cap at 30s
//       randomizationFactor:    0.5,    // add jitter so multiple clients
//                                       // don't retry at the exact same moment
//       timeout:                20000,
//     });
//     socketRef.current = socket;

//     // ── Peer connection handlers ───────────────────────────────────────────
//     if (peer.peer) {
//       peer.peer.ontrack = (ev: RTCTrackEvent) => {
//         const track  = ev.track;
//         const stream = ev.streams[0] ?? new MediaStream([track]);
//         console.log('Remote track received:', track.kind);
//         if (track.kind === 'video') {
//           if (remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
//             setRemoteCallStream(stream);
//           } else {
//             setRemoteStream(stream);
//           }
//         } else {
//           setRemoteStream(prev => {
//             if (!prev) return stream;
//             if (!prev.getTrackById(track.id)) prev.addTrack(track);
//             return prev;
//           });
//         }
//       };

//       peer.peer.onicecandidate = (ev) => {
//         if (ev.candidate && connectedUserRef.current) {
//           socket.emit('ice-candidate', { target: connectedUserRef.current, candidate: ev.candidate });
//         }
//       };

//       peer.peer.oniceconnectionstatechange = () => {
//         const s = peer.peer?.iceConnectionState;
//         console.log('ICE:', s);
//         if (s === 'connected' || s === 'completed') setStatus('Connected');
//         if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
//       };

//       peer.peer.ondatachannel = (ev) => {
//         console.log('ondatachannel:', ev.channel.label);
//         if (ev.channel.label === 'chat')           attachChatChannel(ev.channel);
//         else if (ev.channel.label === 'control')   attachControlChannel(ev.channel);
//         else if (ev.channel.label === 'file-transfer') attachFileChannel(ev.channel);
//       };
//     }

//     // ── Socket events ──────────────────────────────────────────────────────
//     socket.on('connect', () => {
//       console.log('Socket connected:', socket.id);
//       setStatus('Connected');
//       setReconnectAttempt(0);
//       socket.emit('join-room', myId);
//     });

//     socket.on('disconnect', (reason) => {
//       console.log('Socket disconnected:', reason);
//       setStatus('Disconnected');
//     });

//     socket.on('connect_error', (err) => {
//       console.error('Socket connect error:', err.message);
//       setStatus('Disconnected');
//     });

//     socket.on('reconnect_attempt', (attempt) => {
//       console.log(`Reconnect attempt ${attempt}/5…`);
//       setReconnectAttempt(attempt);
//       setStatus(`Reconnecting (${attempt}/5)…`);
//     });

//     socket.on('reconnect_failed', () => {
//       console.error('Socket reconnection failed after 5 attempts');
//       setStatus('Connection failed — please refresh');
//     });

//     socket.on('reconnect', () => {
//       console.log('Socket reconnected');
//       socket.emit('join-room', myId);
//     });

//     // Host: viewer joined
//     socket.on('user-connected', async (socketId: string) => {
//       console.log('Viewer joined:', socketId);
//       connectedUserRef.current = socketId;
//       isInitiatorRef.current   = true;
//       setAmInitiator(true);

//       if (!peer.peer) return;

//       const chatCh = peer.peer.createDataChannel('chat', { ordered: true });
//       const ctrlCh = peer.peer.createDataChannel('control', { ordered: false, maxRetransmits: 0 });
//       const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
//       attachChatChannel(chatCh);
//       attachControlChannel(ctrlCh);
//       attachFileChannel(fileCh);

//       try {
//         const stream = await navigator.mediaDevices.getDisplayMedia({
//           video: { frameRate: { ideal: 30 } },
//           audio: true,
//         });
//         setMyStream(stream);
//         const vid = stream.getVideoTracks()[0];
//         const aud = stream.getAudioTracks()[0];
//         if (vid) {
//           peer.addTrack(vid, stream, SCREEN_VIDEO);
//           vid.addEventListener('ended', () => {
//             setMyStream(null);
//             peer.removeTrack(SCREEN_VIDEO);
//             peer.removeTrack(SCREEN_AUDIO);
//           });
//         }
//         if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

//         const offer = await peer.getOffer();
//         socket.emit('call-user', { userToCall: socketId, from: socket.id, signalData: offer });
//       } catch (err) {
//         console.error('Screen share failed:', err);
//       }
//     });

//     // Viewer: incoming offer
//     socket.on('incoming-call', async ({ from, signal }) => {
//       console.log('Incoming call from:', from);
//       connectedUserRef.current = from;
//       isInitiatorRef.current   = false;
//       setAmInitiator(false);
//       const answer = await peer.getAnswer(signal);
//       socket.emit('answer-call', { to: from, signal: answer });
//     });

//     // Host: answer received
//     socket.on('call-accepted', async (data) => {
//       console.log('Call accepted');
//       try { await peer.setRemoteDescription(data?.signal ?? data); }
//       catch (err) { console.error('setRemoteDescription failed:', err); }
//     });

//     // ICE candidates
//     socket.on('ice-candidate', async ({ candidate }) => {
//       if (!peer.peer) return;
//       try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
//       catch (err) { console.warn('addIceCandidate failed:', err); }
//     });

//     // Remote peer ended session
//     socket.on('hang-up', () => {
//       console.log('Remote peer hung up');
//       _cleanup();
//       setStatus('Disconnected');
//     });

//     return () => {
//       socket.disconnect();
//       socketRef.current = null;
//     };
//   }, [myId, attachChatChannel, attachControlChannel, attachFileChannel, _cleanup]);

//   // ── Public actions ────────────────────────────────────────────────────────
//   const connectToPeer = useCallback((targetId: string) => {
//     socketRef.current?.emit('join-room', targetId);
//   }, []);

//   const startScreenShare = useCallback(async () => {
//     if (!connectedUserRef.current || !socketRef.current) {
//       alert('No viewer connected yet.'); return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
//       setMyStream(stream);
//       const vid = stream.getVideoTracks()[0];
//       const aud = stream.getAudioTracks()[0];
//       if (vid) {
//         peer.addTrack(vid, stream, SCREEN_VIDEO);
//         vid.addEventListener('ended', () => { setMyStream(null); peer.removeTrack(SCREEN_VIDEO); peer.removeTrack(SCREEN_AUDIO); });
//       }
//       if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

//       if (peer.peer?.signalingState === 'stable') {
//         const offer = await peer.getOffer();
//         socketRef.current.emit('call-user', { userToCall: connectedUserRef.current, from: socketRef.current.id, signalData: offer });
//       }
//     } catch (err: any) {
//       if (err.name === 'NotAllowedError') alert('Screen share was denied. Please allow it in your browser when prompted.');
//       else console.error('Screen share failed:', err);
//     }
//   }, []);

//   const stopScreenShare = useCallback(() => {
//     myStreamRef.current?.getTracks().forEach(t => t.stop());
//     peer.removeTrack(SCREEN_VIDEO);
//     peer.removeTrack(SCREEN_AUDIO);
//     setMyStream(null);
//   }, []);

//   const toggleScreenAudio = useCallback(() => {
//     setScreenAudioEnabled(prev => {
//       const next = !prev;
//       const aud = myStreamRef.current?.getAudioTracks()[0] ?? null;
//       peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
//       return next;
//     });
//   }, []);

//   const startCall = useCallback(async (withVideo = true) => {
//     if (!connectedUserRef.current || !socketRef.current) { alert('No peer connected yet.'); return; }
//     let stream: MediaStream;
//     try {
//       stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
//     } catch (err: any) {
//       if (withVideo && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
//         try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); withVideo = false; }
//         catch { alert('Microphone not found or permission denied.'); return; }
//       } else if (err.name === 'NotAllowedError') {
//         alert('Camera/microphone permission denied. Allow access in browser settings.');
//         return;
//       } else { alert(`Could not start call: ${err.message}`); return; }
//     }

//     setCallStream(stream); setInCall(true);
//     const mic = stream.getAudioTracks()[0];
//     const cam = stream.getVideoTracks()[0];
//     if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
//     if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

//     if (!peer.peer || peer.peer.signalingState !== 'stable') return;
//     const offer = await peer.getOffer();
//     socketRef.current.emit('call-user', { userToCall: connectedUserRef.current, from: socketRef.current.id, signalData: offer });
//   }, []);

//   const endCall = useCallback(() => {
//     callStreamRef.current?.getTracks().forEach(t => t.stop());
//     peer.removeTrack(MIC_AUDIO); peer.removeTrack(CAM_VIDEO);
//     setCallStream(null); setRemoteCallStream(null); setInCall(false);
//   }, []);

//   const toggleMic = useCallback(() => {
//     setMicEnabled(prev => { const next = !prev; const t = callStreamRef.current?.getAudioTracks()[0]; if (t) t.enabled = next; return next; });
//   }, []);

//   const toggleCam = useCallback(() => {
//     setMicEnabled(prev => { const next = !prev; const t = callStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = next; peer.replaceTrack(CAM_VIDEO, next ? t : null); } return next; });
//   }, []);

//   const stopAllTracks = useCallback(() => {
//     if (connectedUserRef.current && socketRef.current) {
//       socketRef.current.emit('hang-up', { to: connectedUserRef.current });
//     }
//     _cleanup();
//   }, [_cleanup]);

//   return {
//     connectionStatus: status,
//     reconnectAttempt,
//     connectToPeer,
//     myStream, remoteStream,
//     startScreenShare, stopScreenShare,
//     screenAudioEnabled, toggleScreenAudio,
//     callStream, remoteCallStream,
//     inCall, startCall, endCall,
//     micEnabled, toggleMic,
//     camEnabled, toggleCam,
//     messages, sendChatMessage, cryptoReady,
//     amInitiator,
//     controlGranted, grantControl, revokeControl, sendControlEvent,
//     sendFileChunk,
//     stopAllTracks,
//   };
// };



// frontend/src/hooks/usePeerConnection.ts
//
// [FIX 2] One-sided call: when a user starts an audio/video call, only the
//   INITIATOR sends the offer. The remote peer receives an 'incoming-call'
//   event, answers it, and their local camera/mic stream is set up in response.
//   Previously both sides tried to initiate, causing only one stream to appear.
//   Fix: `startCall` on the caller side sends the offer. The receiver side
//   listens for a new 'incoming-av-call' socket event, captures their media,
//   adds tracks, and sends an answer — all automatically.
//
// [FIX 3] End session signals both sides: stopAllTracks emits 'hang-up'
//   so both host and client return to HomeScreen.
//
// [FIX 4] Control grant/revoke wired through data channel.
//
// [FIX 6] In-session buttons: grantControl, revokeControl, stopScreenShare,
//   toggleScreenAudio all properly exposed and functional.

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

type ControlMsg =
  | ControlAction
  | { type: 'control-grant' }
  | { type: 'control-revoke' };

export const usePeerConnection = (
  myId: string,
  _remoteId: string,
  onFileChunk?: (data: ArrayBuffer | string) => void,
) => {
  const [status, setStatus]               = useState('Disconnected');
  const [myStream, setMyStream]           = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);
  // [FIX 2] callStream = my own AV stream; remoteCallStream = remote AV stream
  const [callStream, setCallStream]       = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall]               = useState(false);
  const [micEnabled, setMicEnabled]       = useState(true);
  const [camEnabled, setCamEnabled]       = useState(true);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [cryptoReady, setCryptoReady]     = useState(false);
  const [amInitiator, setAmInitiator]     = useState(false);
  const [controlGranted, setControlGranted] = useState(false);

  const socketRef         = useRef<Socket | null>(null);
  const connectedUserRef  = useRef<string | null>(null);
  const isInitiatorRef    = useRef(false);
  const chatChannelRef    = useRef<RTCDataChannel | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const fileChannelRef    = useRef<RTCDataChannel | null>(null);
  const cryptoRef         = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
  const keyPairRef        = useRef<CryptoKeyPair | null>(null);
  const onFileChunkRef    = useRef(onFileChunk);
  const remoteStreamRef   = useRef<MediaStream | null>(null);
  const myStreamRef       = useRef<MediaStream | null>(null);
  const callStreamRef     = useRef<MediaStream | null>(null);

  useEffect(() => { onFileChunkRef.current = onFileChunk; }, [onFileChunk]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
  useEffect(() => { myStreamRef.current = myStream; }, [myStream]);
  useEffect(() => { callStreamRef.current = callStream; }, [callStream]);

  const SCREEN_VIDEO = 'screen-video';
  const SCREEN_AUDIO = 'screen-audio';
  const MIC_AUDIO    = 'mic-audio';
  const CAM_VIDEO    = 'cam-video';

  // ── File channel ──────────────────────────────────────────────────────────
  const attachFileChannel = useCallback((ch: RTCDataChannel) => {
    ch.binaryType = 'arraybuffer';
    fileChannelRef.current = ch;
    ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
    ch.onerror   = (e) => console.error('File channel error:', e);
    ch.onopen    = () => console.log('File channel open');
    ch.onclose   = () => console.log('File channel closed');
  }, []);

  const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
    const ch = fileChannelRef.current;
    if (!ch || ch.readyState !== 'open') { console.warn('File channel not open'); return; }
    ch.send(data as any);
  }, []);

  // ── Chat channel ──────────────────────────────────────────────────────────
  const attachChatChannel = useCallback((ch: RTCDataChannel) => {
    chatChannelRef.current = ch;

    const sendKey = async () => {
      const { keyPair, exportedPublic } = await generateECDHKeyPair();
      keyPairRef.current = keyPair;
      ch.send(JSON.stringify({ type: 'ecdh-public-key', key: exportedPublic }));
    };

    ch.onmessage = async (e) => {
      if (e.data instanceof ArrayBuffer) {
        if (!cryptoRef.current) return;
        try {
          const text = await decryptMessage(cryptoRef.current, new Uint8Array(e.data));
          setMessages(prev => [...prev, { from: 'them', text, timestamp: Date.now() }]);
        } catch (err) { console.error('Decrypt failed:', err); }
        return;
      }
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === 'ecdh-public-key') {
          if (!keyPairRef.current) {
            setTimeout(() => ch.dispatchEvent(new MessageEvent('message', { data: e.data })), 100);
            return;
          }
          const theirKey = await importPublicKey(msg.key);
          cryptoRef.current = await buildCryptoSession(keyPairRef.current.privateKey, theirKey);
          setCryptoReady(true);
        }
      } catch (err) { console.error('ECDH error:', err); }
    };

    ch.onerror  = (e) => console.error('Chat error:', e);
    ch.onclose  = () => setCryptoReady(false);
    ch.onopen   = () => sendKey();
    if (ch.readyState === 'open') sendKey();
  }, []);

  const sendChatMessage = useCallback(async (text: string) => {
    const ch = chatChannelRef.current;
    if (!cryptoRef.current || !ch || ch.readyState !== 'open') return;
    const enc = await encryptMessage(cryptoRef.current, text);
    ch.send(enc.buffer as ArrayBuffer);
    setMessages(prev => [...prev, { from: 'me', text, timestamp: Date.now() }]);
  }, []);

  // ── Control channel ───────────────────────────────────────────────────────
  const attachControlChannel = useCallback((ch: RTCDataChannel) => {
    controlChannelRef.current = ch;
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg: ControlMsg = JSON.parse(e.data);
        if (msg.type === 'control-grant')  { setControlGranted(true);  return; }
        if (msg.type === 'control-revoke') { setControlGranted(false); return; }
        // Mouse/keyboard events — forward to robotjs in Electron
        if (isInitiatorRef.current) {
          (window as any).electronAPI?.sendControlAction(msg);
        }
      } catch {}
    };
    ch.onerror = (e) => console.error('Control error:', e);
  }, []);

  // [FIX 4+6] Grant / revoke control — host sends message to viewer
  const grantControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-grant' }));
  }, []);

  const revokeControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
    setControlGranted(false);
  }, []);

  const sendControlEvent = useCallback((action: ControlAction) => {
    const ch = controlChannelRef.current;
    if (!ch || ch.readyState !== 'open' || !controlGranted) return;
    ch.send(JSON.stringify(action));
  }, [controlGranted]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const _cleanup = useCallback(() => {
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    setMyStream(null);
    setRemoteStream(null);
    setCallStream(null);
    setRemoteCallStream(null);
    setInCall(false);
    setCryptoReady(false);
    setControlGranted(false);
    setAmInitiator(false);
    peer.close();
    cryptoRef.current  = null;
    keyPairRef.current = null;
  }, []);

  // ── Main effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    peer.reset();

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection:          true,
      reconnectionAttempts:  5,
      reconnectionDelay:     1000,
      reconnectionDelayMax:  30000,
      randomizationFactor:   0.5,
      timeout:               20000,
    });
    socketRef.current = socket;

    if (peer.peer) {
      // ontrack: distinguish screen-share vs AV call tracks
      peer.peer.ontrack = (ev: RTCTrackEvent) => {
        const track  = ev.track;
        const stream = ev.streams[0] ?? new MediaStream([track]);
        console.log('Remote track received:', track.kind, track.label);

        if (track.kind === 'video') {
          // If we already have a remote screen stream, this is the AV call cam
          if (remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
            setRemoteCallStream(stream);
          } else {
            setRemoteStream(stream);
          }
        } else {
          // Audio: add to existing remote stream
          setRemoteStream(prev => {
            if (!prev) return stream;
            if (!prev.getTrackById(track.id)) prev.addTrack(track);
            return prev;
          });
        }
      };

      peer.peer.onicecandidate = (ev) => {
        if (ev.candidate && connectedUserRef.current) {
          socket.emit('ice-candidate', { target: connectedUserRef.current, candidate: ev.candidate });
        }
      };

      peer.peer.oniceconnectionstatechange = () => {
        const s = peer.peer?.iceConnectionState;
        if (s === 'connected' || s === 'completed') setStatus('Connected');
        if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
      };

      peer.peer.ondatachannel = (ev) => {
        if (ev.channel.label === 'chat')               attachChatChannel(ev.channel);
        else if (ev.channel.label === 'control')       attachControlChannel(ev.channel);
        else if (ev.channel.label === 'file-transfer') attachFileChannel(ev.channel);
      };
    }

    socket.on('connect', () => {
      setStatus('Connected');
      socket.emit('join-room', myId);
    });

    socket.on('disconnect', () => setStatus('Disconnected'));
    socket.on('connect_error', () => setStatus('Disconnected'));
    socket.on('reconnect', () => socket.emit('join-room', myId));
    socket.on('reconnect_failed', () => setStatus('Connection failed — please refresh'));

    // HOST: a viewer joined our room → create data channels + auto-share screen
    socket.on('user-connected', async (socketId: string) => {
      console.log('Viewer joined:', socketId);
      connectedUserRef.current = socketId;
      isInitiatorRef.current   = true;
      setAmInitiator(true);

      if (!peer.peer) return;

      const chatCh = peer.peer.createDataChannel('chat', { ordered: true });
      const ctrlCh = peer.peer.createDataChannel('control', { ordered: false, maxRetransmits: 0 });
      const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
      attachChatChannel(chatCh);
      attachControlChannel(ctrlCh);
      attachFileChannel(fileCh);

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        setMyStream(stream);
        const vid = stream.getVideoTracks()[0];
        const aud = stream.getAudioTracks()[0];
        if (vid) {
          peer.addTrack(vid, stream, SCREEN_VIDEO);
          vid.addEventListener('ended', () => {
            setMyStream(null);
            peer.removeTrack(SCREEN_VIDEO);
            peer.removeTrack(SCREEN_AUDIO);
          });
        }
        if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

        const offer = await peer.getOffer();
        socket.emit('call-user', { userToCall: socketId, from: socket.id, signalData: offer });
      } catch (err) {
        console.error('Auto screen-share failed:', err);
      }
    });

    // VIEWER: incoming offer from host (screen share OR av-call renegotiation)
    socket.on('incoming-call', async ({ from, signal }) => {
      console.log('Incoming call from:', from, 'type:', signal?.type);
      connectedUserRef.current = from;
      isInitiatorRef.current   = false;
      setAmInitiator(false);

      const answer = await peer.getAnswer(signal);
      socket.emit('answer-call', { to: from, signal: answer });
    });

    // [FIX 2] VIEWER: incoming AV call offer — auto-capture media and answer.
    //   The host emits 'incoming-av-call' when they start an audio/video call.
    //   The viewer's browser shows a permission prompt, captures mic/cam, adds
    //   tracks to the peer connection, and sends a re-negotiation answer.
    socket.on('incoming-av-call', async ({ from, signal, withVideo }: {
      from: string;
      signal: RTCSessionDescriptionInit;
      withVideo: boolean;
    }) => {
      console.log('[FIX 2] Incoming AV call from:', from, 'withVideo:', withVideo);
      connectedUserRef.current = from;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
      } catch (err: any) {
        if (withVideo) {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
          catch { console.error('Could not get mic for incoming call:', err); return; }
        } else {
          console.error('Could not get mic for incoming call:', err);
          return;
        }
      }

      setCallStream(stream);
      setInCall(true);

      const mic = stream.getAudioTracks()[0];
      const cam = stream.getVideoTracks()[0];
      if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
      if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

      // Answer the re-negotiation offer
      const answer = await peer.getAnswer(signal);
      socket.emit('answer-call', { to: from, signal: answer });
    });

    // HOST: answer received
    socket.on('call-accepted', async (data) => {
      try { await peer.setRemoteDescription(data?.signal ?? data); }
      catch (err) { console.error('setRemoteDescription failed:', err); }
    });

    // ICE candidates
    socket.on('ice-candidate', async ({ candidate }) => {
      if (!peer.peer) return;
      try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.warn('addIceCandidate failed:', err); }
    });

    // [FIX 3] Remote peer ended session → both sides return to home
    socket.on('hang-up', () => {
      console.log('Remote peer hung up');
      _cleanup();
      setStatus('Disconnected');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId, attachChatChannel, attachControlChannel, attachFileChannel, _cleanup]);

  // ── Public actions ────────────────────────────────────────────────────────

  const connectToPeer = useCallback((targetId: string) => {
    socketRef.current?.emit('join-room', targetId);
  }, []);

  // Host: start/stop screen share
  const startScreenShare = useCallback(async () => {
    if (!connectedUserRef.current || !socketRef.current) {
      alert('No viewer connected yet.'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
      });
      setMyStream(stream);
      const vid = stream.getVideoTracks()[0];
      const aud = stream.getAudioTracks()[0];
      if (vid) {
        peer.addTrack(vid, stream, SCREEN_VIDEO);
        vid.addEventListener('ended', () => {
          setMyStream(null);
          peer.removeTrack(SCREEN_VIDEO);
          peer.removeTrack(SCREEN_AUDIO);
        });
      }
      if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

      if (peer.peer?.signalingState === 'stable') {
        const offer = await peer.getOffer();
        socketRef.current!.emit('call-user', {
          userToCall: connectedUserRef.current,
          from: socketRef.current!.id,
          signalData: offer,
        });
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') alert('Screen share denied. Please allow it when prompted.');
      else console.error('Screen share failed:', err);
    }
  }, []);

  // [FIX 6] stopScreenShare properly exported
  const stopScreenShare = useCallback(() => {
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    peer.removeTrack(SCREEN_VIDEO);
    peer.removeTrack(SCREEN_AUDIO);
    setMyStream(null);
  }, []);

  // [FIX 6] toggleScreenAudio properly exported
  const toggleScreenAudio = useCallback(() => {
    setScreenAudioEnabled(prev => {
      const next = !prev;
      const aud  = myStreamRef.current?.getAudioTracks()[0] ?? null;
      peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
      return next;
    });
  }, []);

  // [FIX 2] startCall: ONLY the calling side captures media + sends the offer.
  //   A new 'incoming-av-call' socket event is emitted to the remote peer so
  //   they can capture their media and answer — this makes BOTH sides visible.
  const startCall = useCallback(async (withVideo = true) => {
    if (!connectedUserRef.current || !socketRef.current) {
      alert('No peer connected yet.'); return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
    } catch (err: any) {
      if (withVideo && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); withVideo = false; }
        catch { alert('Microphone not found or permission denied.'); return; }
      } else if (err.name === 'NotAllowedError') {
        alert('Camera/microphone permission denied. Allow access in browser settings.');
        return;
      } else { alert(`Could not start call: ${err.message}`); return; }
    }

    setCallStream(stream);
    setInCall(true);

    const mic = stream.getAudioTracks()[0];
    const cam = stream.getVideoTracks()[0];
    if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
    if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

    if (!peer.peer || peer.peer.signalingState !== 'stable') return;

    // Send an offer that also signals "I am starting an AV call"
    const offer = await peer.getOffer();

    // [FIX 2] Use 'incoming-av-call' event so the server knows to forward the
    // withVideo flag. The signaling-server must relay this (see events.ts).
    socketRef.current.emit('av-call-user', {
      userToCall: connectedUserRef.current,
      from: socketRef.current.id,
      signalData: offer,
      withVideo,
    });
  }, []);

  const endCall = useCallback(() => {
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    peer.removeTrack(MIC_AUDIO);
    peer.removeTrack(CAM_VIDEO);
    setCallStream(null);
    setRemoteCallStream(null);
    setInCall(false);
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => {
      const next = !prev;
      const t    = callStreamRef.current?.getAudioTracks()[0];
      if (t) t.enabled = next;
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled(prev => {
      const next = !prev;
      const t    = callStreamRef.current?.getVideoTracks()[0];
      if (t) {
        t.enabled = next;
        peer.replaceTrack(CAM_VIDEO, next ? t : null);
      }
      return next;
    });
  }, []);

  // [FIX 3] stopAllTracks: stops media + signals remote peer to go to home screen
  const stopAllTracks = useCallback(() => {
    if (connectedUserRef.current && socketRef.current) {
      socketRef.current.emit('hang-up', { to: connectedUserRef.current });
    }
    _cleanup();
  }, [_cleanup]);

  return {
    connectionStatus: status,
    connectToPeer,
    myStream, remoteStream,
    startScreenShare, stopScreenShare,
    screenAudioEnabled, toggleScreenAudio,
    callStream, remoteCallStream,
    inCall, startCall, endCall,
    micEnabled, toggleMic,
    camEnabled, toggleCam,
    messages, sendChatMessage, cryptoReady,
    amInitiator,
    controlGranted, grantControl, revokeControl, sendControlEvent,
    sendFileChunk,
    stopAllTracks,
  };
};

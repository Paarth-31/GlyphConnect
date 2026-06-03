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

// export const usePeerConnection = (
//   myId: string,
//   _remoteId: string,
//   onFileChunk?: (data: ArrayBuffer | string) => void,
// ) => {
//   const [status, setStatus]               = useState('Disconnected');
//   const [myStream, setMyStream]           = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);
//   // [FIX 2] callStream = my own AV stream; remoteCallStream = remote AV stream
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

//   const socketRef         = useRef<Socket | null>(null);
//   const connectedUserRef  = useRef<string | null>(null);
//   const isInitiatorRef    = useRef(false);
//   const chatChannelRef    = useRef<RTCDataChannel | null>(null);
//   const controlChannelRef = useRef<RTCDataChannel | null>(null);
//   const fileChannelRef    = useRef<RTCDataChannel | null>(null);
//   const cryptoRef         = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
//   const keyPairRef        = useRef<CryptoKeyPair | null>(null);
//   const onFileChunkRef    = useRef(onFileChunk);
//   const remoteStreamRef   = useRef<MediaStream | null>(null);
//   const myStreamRef       = useRef<MediaStream | null>(null);
//   const callStreamRef     = useRef<MediaStream | null>(null);

//   useEffect(() => { onFileChunkRef.current = onFileChunk; }, [onFileChunk]);
//   useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
//   useEffect(() => { myStreamRef.current = myStream; }, [myStream]);
//   useEffect(() => { callStreamRef.current = callStream; }, [callStream]);

//   const SCREEN_VIDEO = 'screen-video';
//   const SCREEN_AUDIO = 'screen-audio';
//   const MIC_AUDIO    = 'mic-audio';
//   const CAM_VIDEO    = 'cam-video';

//   // ── File channel ──────────────────────────────────────────────────────────
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

//   // ── Chat channel ──────────────────────────────────────────────────────────
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
//         }
//       } catch (err) { console.error('ECDH error:', err); }
//     };

//     ch.onerror  = (e) => console.error('Chat error:', e);
//     ch.onclose  = () => setCryptoReady(false);
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

//   // ── Control channel ───────────────────────────────────────────────────────
//   const attachControlChannel = useCallback((ch: RTCDataChannel) => {
//     controlChannelRef.current = ch;
//     ch.onmessage = (e) => {
//       if (typeof e.data !== 'string') return;
//       try {
//         const msg: ControlMsg = JSON.parse(e.data);
//         if (msg.type === 'control-grant')  { setControlGranted(true);  return; }
//         if (msg.type === 'control-revoke') { setControlGranted(false); return; }
//         // Mouse/keyboard events — forward to robotjs in Electron
//         if (isInitiatorRef.current) {
//           (window as any).electronAPI?.sendControlAction(msg);
//         }
//       } catch {}
//     };
//     ch.onerror = (e) => console.error('Control error:', e);
//   }, []);

//   // [FIX 4+6] Grant / revoke control — host sends message to viewer
//   const grantControl = useCallback(() => {
//     const ch = controlChannelRef.current;
//     if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-grant' }));
//   }, []);

//   const revokeControl = useCallback(() => {
//     const ch = controlChannelRef.current;
//     if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
//     setControlGranted(false);
//   }, []);

//   const sendControlEvent = useCallback((action: ControlAction) => {
//     const ch = controlChannelRef.current;
//     if (!ch || ch.readyState !== 'open' || !controlGranted) return;
//     ch.send(JSON.stringify(action));
//   }, [controlGranted]);

//   // ── Cleanup ────────────────────────────────────────────────────────────────
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

//   // ── Main effect ────────────────────────────────────────────────────────────
//   useEffect(() => {
//     peer.reset();

//     const socket = io(SERVER_URL, {
//       transports: ['websocket', 'polling'],
//       reconnection:          true,
//       reconnectionAttempts:  5,
//       reconnectionDelay:     1000,
//       reconnectionDelayMax:  30000,
//       randomizationFactor:   0.5,
//       timeout:               20000,
//     });
//     socketRef.current = socket;

//     if (peer.peer) {
//       // ontrack: distinguish screen-share vs AV call tracks
//       peer.peer.ontrack = (ev: RTCTrackEvent) => {
//         const track  = ev.track;
//         const stream = ev.streams[0] ?? new MediaStream([track]);
//         console.log('Remote track received:', track.kind, track.label);

//         if (track.kind === 'video') {
//           // If we already have a remote screen stream, this is the AV call cam
//           if (remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
//             setRemoteCallStream(stream);
//           } else {
//             setRemoteStream(stream);
//           }
//         } else {
//           // Audio: add to existing remote stream
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
//         if (s === 'connected' || s === 'completed') setStatus('Connected');
//         if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
//       };

//       peer.peer.ondatachannel = (ev) => {
//         if (ev.channel.label === 'chat')               attachChatChannel(ev.channel);
//         else if (ev.channel.label === 'control')       attachControlChannel(ev.channel);
//         else if (ev.channel.label === 'file-transfer') attachFileChannel(ev.channel);
//       };
//     }

//     socket.on('connect', () => {
//       setStatus('Connected');
//       socket.emit('join-room', myId);
//     });

//     socket.on('disconnect', () => setStatus('Disconnected'));
//     socket.on('connect_error', () => setStatus('Disconnected'));
//     socket.on('reconnect', () => socket.emit('join-room', myId));
//     socket.on('reconnect_failed', () => setStatus('Connection failed — please refresh'));

//     // HOST: a viewer joined our room → create data channels + auto-share screen
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
//         console.error('Auto screen-share failed:', err);
//       }
//     });

//     // VIEWER: incoming offer from host (screen share OR av-call renegotiation)
//     socket.on('incoming-call', async ({ from, signal }) => {
//       console.log('Incoming call from:', from, 'type:', signal?.type);
//       connectedUserRef.current = from;
//       isInitiatorRef.current   = false;
//       setAmInitiator(false);

//       const answer = await peer.getAnswer(signal);
//       socket.emit('answer-call', { to: from, signal: answer });
//     });

//     // [FIX 2] VIEWER: incoming AV call offer — auto-capture media and answer.
//     //   The host emits 'incoming-av-call' when they start an audio/video call.
//     //   The viewer's browser shows a permission prompt, captures mic/cam, adds
//     //   tracks to the peer connection, and sends a re-negotiation answer.
//     socket.on('incoming-av-call', async ({ from, signal, withVideo }: {
//       from: string;
//       signal: RTCSessionDescriptionInit;
//       withVideo: boolean;
//     }) => {
//       console.log('[FIX 2] Incoming AV call from:', from, 'withVideo:', withVideo);
//       connectedUserRef.current = from;

//       let stream: MediaStream;
//       try {
//         stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
//       } catch (err: any) {
//         if (withVideo) {
//           try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
//           catch { console.error('Could not get mic for incoming call:', err); return; }
//         } else {
//           console.error('Could not get mic for incoming call:', err);
//           return;
//         }
//       }

//       setCallStream(stream);
//       setInCall(true);

//       const mic = stream.getAudioTracks()[0];
//       const cam = stream.getVideoTracks()[0];
//       if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
//       if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

//       // Answer the re-negotiation offer
//       const answer = await peer.getAnswer(signal);
//       socket.emit('answer-call', { to: from, signal: answer });
//     });

//     // HOST: answer received
//     socket.on('call-accepted', async (data) => {
//       try { await peer.setRemoteDescription(data?.signal ?? data); }
//       catch (err) { console.error('setRemoteDescription failed:', err); }
//     });

//     // ICE candidates
//     socket.on('ice-candidate', async ({ candidate }) => {
//       if (!peer.peer) return;
//       try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
//       catch (err) { console.warn('addIceCandidate failed:', err); }
//     });

//     // [FIX 3] Remote peer ended session → both sides return to home
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

//   // Host: start/stop screen share
//   const startScreenShare = useCallback(async () => {
//     if (!connectedUserRef.current || !socketRef.current) {
//       alert('No viewer connected yet.'); return;
//     }
//     try {
//       const stream = await navigator.mediaDevices.getDisplayMedia({
//         video: { frameRate: { ideal: 30 } },
//         audio: true,
//       });
//       setMyStream(stream);
//       const vid = stream.getVideoTracks()[0];
//       const aud = stream.getAudioTracks()[0];
//       if (vid) {
//         peer.addTrack(vid, stream, SCREEN_VIDEO);
//         vid.addEventListener('ended', () => {
//           setMyStream(null);
//           peer.removeTrack(SCREEN_VIDEO);
//           peer.removeTrack(SCREEN_AUDIO);
//         });
//       }
//       if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

//       if (peer.peer?.signalingState === 'stable') {
//         const offer = await peer.getOffer();
//         socketRef.current!.emit('call-user', {
//           userToCall: connectedUserRef.current,
//           from: socketRef.current!.id,
//           signalData: offer,
//         });
//       }
//     } catch (err: any) {
//       if (err.name === 'NotAllowedError') alert('Screen share denied. Please allow it when prompted.');
//       else console.error('Screen share failed:', err);
//     }
//   }, []);

//   // [FIX 6] stopScreenShare properly exported
//   const stopScreenShare = useCallback(() => {
//     myStreamRef.current?.getTracks().forEach(t => t.stop());
//     peer.removeTrack(SCREEN_VIDEO);
//     peer.removeTrack(SCREEN_AUDIO);
//     setMyStream(null);
//   }, []);

//   // [FIX 6] toggleScreenAudio properly exported
//   const toggleScreenAudio = useCallback(() => {
//     setScreenAudioEnabled(prev => {
//       const next = !prev;
//       const aud  = myStreamRef.current?.getAudioTracks()[0] ?? null;
//       peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
//       return next;
//     });
//   }, []);

//   // [FIX 2] startCall: ONLY the calling side captures media + sends the offer.
//   //   A new 'incoming-av-call' socket event is emitted to the remote peer so
//   //   they can capture their media and answer — this makes BOTH sides visible.
//   const startCall = useCallback(async (withVideo = true) => {
//     if (!connectedUserRef.current || !socketRef.current) {
//       alert('No peer connected yet.'); return;
//     }

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

//     setCallStream(stream);
//     setInCall(true);

//     const mic = stream.getAudioTracks()[0];
//     const cam = stream.getVideoTracks()[0];
//     if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
//     if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

//     if (!peer.peer || peer.peer.signalingState !== 'stable') return;

//     // Send an offer that also signals "I am starting an AV call"
//     const offer = await peer.getOffer();

//     // [FIX 2] Use 'incoming-av-call' event so the server knows to forward the
//     // withVideo flag. The signaling-server must relay this (see events.ts).
//     socketRef.current.emit('av-call-user', {
//       userToCall: connectedUserRef.current,
//       from: socketRef.current.id,
//       signalData: offer,
//       withVideo,
//     });
//   }, []);

//   const endCall = useCallback(() => {
//     callStreamRef.current?.getTracks().forEach(t => t.stop());
//     peer.removeTrack(MIC_AUDIO);
//     peer.removeTrack(CAM_VIDEO);
//     setCallStream(null);
//     setRemoteCallStream(null);
//     setInCall(false);
//   }, []);

//   const toggleMic = useCallback(() => {
//     setMicEnabled(prev => {
//       const next = !prev;
//       const t    = callStreamRef.current?.getAudioTracks()[0];
//       if (t) t.enabled = next;
//       return next;
//     });
//   }, []);

//   const toggleCam = useCallback(() => {
//     setCamEnabled(prev => {
//       const next = !prev;
//       const t    = callStreamRef.current?.getVideoTracks()[0];
//       if (t) {
//         t.enabled = next;
//         peer.replaceTrack(CAM_VIDEO, next ? t : null);
//       }
//       return next;
//     });
//   }, []);

//   // [FIX 3] stopAllTracks: stops media + signals remote peer to go to home screen
//   const stopAllTracks = useCallback(() => {
//     if (connectedUserRef.current && socketRef.current) {
//       socketRef.current.emit('hang-up', { to: connectedUserRef.current });
//     }
//     _cleanup();
//   }, [_cleanup]);

//   return {
//     connectionStatus: status,
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




import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import peer from '../services/peer';
import {
  generateECDHKeyPair, importPublicKey,
  buildCryptoSession, encryptMessage, decryptMessage,
} from '../services/messageCrypto';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

export interface ChatMessage { from: 'me' | 'them'; text: string; timestamp: number; }

export interface ControlAction {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
  normX?: number; normY?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string; scrollX?: number; scrollY?: number;
}

type ControlMsg = ControlAction | { type: 'control-grant' } | { type: 'control-revoke' };

export const usePeerConnection = (
  myId: string,
  _remoteId: string,
  onFileChunk?: (data: ArrayBuffer | string) => void,
  onSessionEnded?: () => void,   // NEW: called when remote ends session
) => {
  const [status, setStatus]                   = useState('Disconnected');
  const [myStream, setMyStream]               = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]       = useState<MediaStream | null>(null);
  const [callStream, setCallStream]           = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [inCall, setInCall]                   = useState(false);
  const [micEnabled, setMicEnabled]           = useState(true);
  const [camEnabled, setCamEnabled]           = useState(true);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [cryptoReady, setCryptoReady]         = useState(false);
  const [isHost, setIsHost]                   = useState(false);
  const [controlGranted, setControlGranted]   = useState(false);

  const socketRef         = useRef<Socket | null>(null);
  const peerSocketIdRef   = useRef<string | null>(null); // remote's socket.id
  const isHostRef         = useRef(false);
  const chatChannelRef    = useRef<RTCDataChannel | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const fileChannelRef    = useRef<RTCDataChannel | null>(null);
  const cryptoRef         = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
  const keyPairRef        = useRef<CryptoKeyPair | null>(null);
  const onFileChunkRef    = useRef(onFileChunk);
  const onSessionEndedRef = useRef(onSessionEnded);
  const myStreamRef       = useRef<MediaStream | null>(null);
  const callStreamRef     = useRef<MediaStream | null>(null);
  const controlGrantedRef = useRef(false);

  useEffect(() => { onFileChunkRef.current    = onFileChunk;    }, [onFileChunk]);
  useEffect(() => { onSessionEndedRef.current = onSessionEnded; }, [onSessionEnded]);
  useEffect(() => { myStreamRef.current       = myStream;       }, [myStream]);
  useEffect(() => { callStreamRef.current     = callStream;     }, [callStream]);
  useEffect(() => { controlGrantedRef.current = controlGranted; }, [controlGranted]);

  // Track IDs
  const SCREEN_VIDEO = 'screen-video';
  const SCREEN_AUDIO = 'screen-audio';
  const MIC_AUDIO    = 'mic-audio';
  const CAM_VIDEO    = 'cam-video';

  // ── File channel ──────────────────────────────────────────────────────────
  const attachFileChannel = useCallback((ch: RTCDataChannel) => {
    ch.binaryType = 'arraybuffer';
    fileChannelRef.current = ch;
    ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
    ch.onerror   = (e) => console.error('[file]', e);
  }, []);

  const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
    const ch = fileChannelRef.current;
    if (!ch || ch.readyState !== 'open') { console.warn('file channel not open'); return; }
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
        } catch {}
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
      } catch {}
    };
    ch.onerror = (e) => console.error('[chat]', e);
    ch.onclose = () => setCryptoReady(false);
    ch.onopen  = () => sendKey();
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

        // Mouse/keyboard action: only the HOST executes these (HOST = isHostRef.current)
        // The HOST shares their screen and is the machine being controlled
        if (isHostRef.current) {
          (window as any).electronAPI?.sendControlAction(msg);
        }
      } catch {}
    };
    ch.onerror = (e) => console.error('[ctrl]', e);
  }, []);

  // Grant/revoke — HOST sends to viewer via control channel
  const grantControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-grant' }));
    // Note: we do NOT set controlGranted on host — that state is for the VIEWER
  }, []);

  const revokeControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
  }, []);

  // Viewer sends mouse/keyboard events to host
  const sendControlEvent = useCallback((action: ControlAction) => {
    const ch = controlChannelRef.current;
    if (!ch || ch.readyState !== 'open' || !controlGrantedRef.current) return;
    ch.send(JSON.stringify(action));
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const _stopMedia = useCallback(() => {
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    setMyStream(null);
    setRemoteStream(null);
    setCallStream(null);
    setRemoteCallStream(null);
    setInCall(false);
    setControlGranted(false);
    setCryptoReady(false);
    peer.close();
    cryptoRef.current  = null;
    keyPairRef.current = null;
  }, []);

  // ── Main socket effect ────────────────────────────────────────────────────
  useEffect(() => {
    peer.reset();

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: 5,
      reconnectionDelay: 1000, reconnectionDelayMax: 30000,
      timeout: 20000,
    });
    socketRef.current = socket;

    // ── RTCPeerConnection events ─────────────────────────────────────────────
    if (peer.peer) {
      // Track the first video stream ID (screen share). Any subsequent
      // video stream from a different ID is the AV call camera.
      let firstVideoStreamId: string | null = null;

      peer.peer.ontrack = (ev: RTCTrackEvent) => {
        const track  = ev.track;
        const stream = ev.streams[0] || new MediaStream([track]);
        console.log('[ontrack]', track.kind, stream.id, track.label || track.id);

        if (track.kind === 'video') {
          if (firstVideoStreamId === null) {
            // First video track = screen share
            firstVideoStreamId = stream.id;
            setRemoteStream(stream);
            console.log('[ontrack] → remoteStream (screen share)');
          } else if (stream.id !== firstVideoStreamId) {
            // Different stream = AV call camera
            setRemoteCallStream(stream);
            console.log('[ontrack] → remoteCallStream (AV camera)');
          } else {
            // Same stream as screen share (e.g. replaced track) — update
            setRemoteStream(stream);
          }
        } else {
          // Audio track — route to the correct stream
          if (firstVideoStreamId === null || stream.id === firstVideoStreamId) {
            // Screen-share audio (or first audio before any video)
            setRemoteStream(prev => {
              if (!prev) return stream;
              if (!prev.getTrackById(track.id)) {
                return new MediaStream([...prev.getTracks(), track]);
              }
              return prev;
            });
          } else {
            // AV call microphone audio
            setRemoteCallStream(prev => {
              if (!prev) return stream;
              if (!prev.getTrackById(track.id)) {
                return new MediaStream([...prev.getTracks(), track]);
              }
              return prev;
            });
          }
        }
      };

      peer.peer.onicecandidate = (ev) => {
        if (ev.candidate && peerSocketIdRef.current) {
          socket.emit('ice-candidate', {
            target: peerSocketIdRef.current,
            candidate: ev.candidate,
          });
        }
      };

      peer.peer.oniceconnectionstatechange = () => {
        const s = peer.peer?.iceConnectionState;
        console.log('[ICE]', s);
        if (s === 'connected' || s === 'completed') setStatus('Connected');
        if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
      };

      peer.peer.ondatachannel = (ev) => {
        console.log('[datachannel]', ev.channel.label);
        if (ev.channel.label === 'chat')           attachChatChannel(ev.channel);
        if (ev.channel.label === 'control')        attachControlChannel(ev.channel);
        if (ev.channel.label === 'file-transfer')  attachFileChannel(ev.channel);
      };
    }

    // ── Socket events ────────────────────────────────────────────────────────

    socket.on('connect', () => {
      setStatus('Connected');
      socket.emit('join-room', myId);
      console.log('[socket] connected, joined room', myId);
    });

    socket.on('disconnect', () => setStatus('Disconnected'));
    socket.on('connect_error', (e) => { console.error('[socket] connect_error', e); setStatus('Disconnected'); });
    socket.on('reconnect', () => socket.emit('join-room', myId));
    socket.on('room-full', () => alert('Room is full. Only 2 peers allowed per session.'));

    // HOST: viewer connected → create data channels + start screen share
    socket.on('user-connected', async (viewerSocketId: string) => {
      console.log('[host] viewer connected:', viewerSocketId);
      peerSocketIdRef.current = viewerSocketId;
      isHostRef.current = true;
      setIsHost(true);

      if (!peer.peer) return;

      // Create all three data channels (host side always creates them)
      const chatCh = peer.peer.createDataChannel('chat',          { ordered: true });
      const ctrlCh = peer.peer.createDataChannel('control',       { ordered: true });
      const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
      attachChatChannel(chatCh);
      attachControlChannel(ctrlCh);
      attachFileChannel(fileCh);

      // Auto-prompt host to share screen
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 30 } },
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
        if (offer) {
          socket.emit('call-user', { userToCall: viewerSocketId, from: socket.id, signalData: offer });
        }
      } catch (err: any) {
        console.error('[host] screen share failed:', err.message);
        // Still send offer so data channels open (no media tracks yet)
        const offer = await peer.getOffer();
        if (offer) socket.emit('call-user', { userToCall: viewerSocketId, from: socket.id, signalData: offer });
      }
    });

    // VIEWER: incoming offer from host (screen share)
    socket.on('incoming-call', async ({ from, signal }: { from: string; signal: RTCSessionDescriptionInit }) => {
      console.log('[viewer] incoming-call from', from);
      peerSocketIdRef.current = from;
      isHostRef.current = false;
      setIsHost(false);

      const answer = await peer.getAnswer(signal);
      if (answer) socket.emit('answer-call', { to: from, signal: answer });
    });

    // VIEWER: host started AV call — capture own cam/mic and answer
    socket.on('incoming-av-call', async ({
      from, signal, withVideo,
    }: { from: string; signal: RTCSessionDescriptionInit; withVideo: boolean }) => {
      console.log('[viewer] incoming-av-call from', from, 'video:', withVideo);

      // Capture viewer's own media BEFORE answering so the tracks
      // are included in the SDP answer (this is the key fix for
      // two-way AV visibility)
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e2) {
          console.error('[viewer] cannot get media for AV call:', e2);
        }
      }

      if (stream) {
        setCallStream(stream);
        setInCall(true);
        const mic = stream.getAudioTracks()[0];
        const cam = stream.getVideoTracks()[0];
        if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
        if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);
      }

      // Use peer.getAnswer() which atomically sets remote description
      // and creates the answer. This avoids the race condition that
      // occurred when manually calling setRemoteDescription + createAnswer.
      const answer = await peer.getAnswer(signal);
      if (answer) {
        socket.emit('answer-call', { to: from, signal: answer });
        console.log('[viewer] AV call answered successfully');
      } else {
        console.error('[viewer] AV renegotiation failed: no answer generated');
      }
    });

    // HOST/VIEWER: answer received
    socket.on('call-accepted', async (data: any) => {
      try {
        const sdp = data?.signal ?? data;
        await peer.setRemoteDescription(sdp);
        console.log('[peer] remote description set');
      } catch (e) { console.error('[peer] setRemoteDescription failed:', e); }
    });

    // ICE candidates
    socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!peer.peer) return;
      try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[ICE] addIceCandidate failed:', e); }
    });

    // ── session-ended: REMOTE peer ended session → call onSessionEnded ───────
    // This is the key fix for issue #1: remote side navigates to home screen
    socket.on('session-ended', () => {
      console.log('[socket] session-ended received from remote');
      _stopMedia();
      setStatus('Disconnected');
      // Use setTimeout so React state updates flush before navigation
      setTimeout(() => { onSessionEndedRef.current?.(); }, 100);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myId, attachChatChannel, attachControlChannel, attachFileChannel, _stopMedia]);

  // ── Public API ────────────────────────────────────────────────────────────

  const connectToPeer = useCallback((targetId: string) => {
    socketRef.current?.emit('join-room', targetId);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!peerSocketIdRef.current) { alert('No peer connected yet.'); return; }
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
        if (offer) socketRef.current?.emit('call-user', {
          userToCall: peerSocketIdRef.current,
          from: socketRef.current?.id,
          signalData: offer,
        });
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') console.error('[screen]', err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    myStreamRef.current?.getTracks().forEach(t => t.stop());
    peer.removeTrack(SCREEN_VIDEO);
    peer.removeTrack(SCREEN_AUDIO);
    setMyStream(null);
  }, []);

  const toggleScreenAudio = useCallback(() => {
    setScreenAudioEnabled(prev => {
      const next = !prev;
      const aud  = myStreamRef.current?.getAudioTracks()[0] ?? null;
      if (aud) aud.enabled = next;
      peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
      return next;
    });
  }, []);

  // ── startCall: caller captures media + sends AV offer to remote ───────────
  // Remote receives 'incoming-av-call', captures their own media, and answers.
  // This results in BOTH sides having their camera/mic active.
  const startCall = useCallback(async (withVideo = true) => {
    if (!peerSocketIdRef.current || !socketRef.current) {
      alert('No peer connected yet.'); return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
    } catch (err: any) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        withVideo = false;
      } catch {
        alert('Could not access microphone. Check browser permissions.');
        return;
      }
    }

    if (!stream) {
      alert('Could not access microphone. Check browser permissions.');
      return;
    }

    setCallStream(stream);
    setInCall(true);

    const mic = stream.getAudioTracks()[0];
    const cam = stream.getVideoTracks()[0];
    if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
    if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

    // Wait until signaling is stable before sending new offer
    const waitForStable = () => new Promise<void>(resolve => {
      if (!peer.peer || peer.peer.signalingState === 'stable') { resolve(); return; }
      const check = () => {
        if (!peer.peer || peer.peer.signalingState === 'stable') {
          peer.peer?.removeEventListener('signalingstatechange', check);
          resolve();
        }
      };
      peer.peer.addEventListener('signalingstatechange', check);
      setTimeout(resolve, 3000); // timeout safety
    });

    await waitForStable();

    try {
      const offer = await peer.getOffer();
      if (offer) {
        socketRef.current.emit('av-call-user', {
          userToCall: peerSocketIdRef.current,
          from: socketRef.current.id,
          signalData: offer,
          withVideo,
        });
      }
    } catch (e) {
      console.error('[startCall] offer failed:', e);
    }
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
      const t = callStreamRef.current?.getAudioTracks()[0];
      if (t) t.enabled = next;
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled(prev => {
      const next = !prev;
      const t = callStreamRef.current?.getVideoTracks()[0];
      if (t) t.enabled = next;
      return next;
    });
  }, []);

  // ── End session: emit hang-up then clean up ───────────────────────────────
  // Issue #1 fix: we emit 'hang-up' with the PEER'S socket.id so the server
  // delivers 'session-ended' to exactly that socket. The remote listener calls
  // onSessionEnded() which navigates to home. We call onSessionEnded() locally
  // too via the caller (SessionPage → onEnd).
  const stopAllTracks = useCallback(() => {
    const peerId = peerSocketIdRef.current;
    if (peerId && socketRef.current?.connected) {
      socketRef.current.emit('hang-up', { to: peerId });
    }
    _stopMedia();
  }, [_stopMedia]);

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
    isHost,
    controlGranted, grantControl, revokeControl, sendControlEvent,
    sendFileChunk,
    stopAllTracks,
  };
};

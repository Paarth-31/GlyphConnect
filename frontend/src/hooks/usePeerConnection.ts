// // import { useEffect, useState, useCallback, useRef } from 'react';
// // import { io, Socket } from 'socket.io-client';
// // import peer from '../services/peer';
// // import {
// //   generateECDHKeyPair,
// //   importPublicKey,
// //   buildCryptoSession,
// //   encryptMessage,
// //   decryptMessage,
// // } from '../services/messageCrypto';

// // const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// // export interface ChatMessage {
// //   from: 'me' | 'them';
// //   text: string;
// //   timestamp: number;
// // }

// // export interface ControlAction {
// //   type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
// //   normX?: number;
// //   normY?: number;
// //   button?: 'left' | 'right' | 'middle';
// //   key?: string;
// //   scrollX?: number;
// //   scrollY?: number;
// // }

// // type ControlMsg =
// //   | ControlAction
// //   | { type: 'control-grant' }
// //   | { type: 'control-revoke' };

// // export const usePeerConnection = (
// //   myId: string,
// //   _remoteId: string,
// //   onFileChunk?: (data: ArrayBuffer | string) => void,
// // ) => {
// //   const [status, setStatus]               = useState('Disconnected');
// //   const [myStream, setMyStream]           = useState<MediaStream | null>(null);
// //   const [remoteStream, setRemoteStream]   = useState<MediaStream | null>(null);
// //   // [FIX 2] callStream = my own AV stream; remoteCallStream = remote AV stream
// //   const [callStream, setCallStream]       = useState<MediaStream | null>(null);
// //   const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
// //   const [inCall, setInCall]               = useState(false);
// //   const [micEnabled, setMicEnabled]       = useState(true);
// //   const [camEnabled, setCamEnabled]       = useState(true);
// //   const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
// //   const [messages, setMessages]           = useState<ChatMessage[]>([]);
// //   const [cryptoReady, setCryptoReady]     = useState(false);
// //   const [amInitiator, setAmInitiator]     = useState(false);
// //   const [controlGranted, setControlGranted] = useState(false);

// //   const socketRef         = useRef<Socket | null>(null);
// //   const connectedUserRef  = useRef<string | null>(null);
// //   const isInitiatorRef    = useRef(false);
// //   const chatChannelRef    = useRef<RTCDataChannel | null>(null);
// //   const controlChannelRef = useRef<RTCDataChannel | null>(null);
// //   const fileChannelRef    = useRef<RTCDataChannel | null>(null);
// //   const cryptoRef         = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
// //   const keyPairRef        = useRef<CryptoKeyPair | null>(null);
// //   const onFileChunkRef    = useRef(onFileChunk);
// //   const remoteStreamRef   = useRef<MediaStream | null>(null);
// //   const myStreamRef       = useRef<MediaStream | null>(null);
// //   const callStreamRef     = useRef<MediaStream | null>(null);

// //   useEffect(() => { onFileChunkRef.current = onFileChunk; }, [onFileChunk]);
// //   useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);
// //   useEffect(() => { myStreamRef.current = myStream; }, [myStream]);
// //   useEffect(() => { callStreamRef.current = callStream; }, [callStream]);

// //   const SCREEN_VIDEO = 'screen-video';
// //   const SCREEN_AUDIO = 'screen-audio';
// //   const MIC_AUDIO    = 'mic-audio';
// //   const CAM_VIDEO    = 'cam-video';

// //   // ── File channel ──────────────────────────────────────────────────────────
// //   const attachFileChannel = useCallback((ch: RTCDataChannel) => {
// //     ch.binaryType = 'arraybuffer';
// //     fileChannelRef.current = ch;
// //     ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
// //     ch.onerror   = (e) => console.error('File channel error:', e);
// //     ch.onopen    = () => console.log('File channel open');
// //     ch.onclose   = () => console.log('File channel closed');
// //   }, []);

// //   const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
// //     const ch = fileChannelRef.current;
// //     if (!ch || ch.readyState !== 'open') { console.warn('File channel not open'); return; }
// //     ch.send(data as any);
// //   }, []);

// //   // ── Chat channel ──────────────────────────────────────────────────────────
// //   const attachChatChannel = useCallback((ch: RTCDataChannel) => {
// //     chatChannelRef.current = ch;

// //     const sendKey = async () => {
// //       const { keyPair, exportedPublic } = await generateECDHKeyPair();
// //       keyPairRef.current = keyPair;
// //       ch.send(JSON.stringify({ type: 'ecdh-public-key', key: exportedPublic }));
// //     };

// //     ch.onmessage = async (e) => {
// //       if (e.data instanceof ArrayBuffer) {
// //         if (!cryptoRef.current) return;
// //         try {
// //           const text = await decryptMessage(cryptoRef.current, new Uint8Array(e.data));
// //           setMessages(prev => [...prev, { from: 'them', text, timestamp: Date.now() }]);
// //         } catch (err) { console.error('Decrypt failed:', err); }
// //         return;
// //       }
// //       try {
// //         const msg = JSON.parse(e.data as string);
// //         if (msg.type === 'ecdh-public-key') {
// //           if (!keyPairRef.current) {
// //             setTimeout(() => ch.dispatchEvent(new MessageEvent('message', { data: e.data })), 100);
// //             return;
// //           }
// //           const theirKey = await importPublicKey(msg.key);
// //           cryptoRef.current = await buildCryptoSession(keyPairRef.current.privateKey, theirKey);
// //           setCryptoReady(true);
// //         }
// //       } catch (err) { console.error('ECDH error:', err); }
// //     };

// //     ch.onerror  = (e) => console.error('Chat error:', e);
// //     ch.onclose  = () => setCryptoReady(false);
// //     ch.onopen   = () => sendKey();
// //     if (ch.readyState === 'open') sendKey();
// //   }, []);

// //   const sendChatMessage = useCallback(async (text: string) => {
// //     const ch = chatChannelRef.current;
// //     if (!cryptoRef.current || !ch || ch.readyState !== 'open') return;
// //     const enc = await encryptMessage(cryptoRef.current, text);
// //     ch.send(enc.buffer as ArrayBuffer);
// //     setMessages(prev => [...prev, { from: 'me', text, timestamp: Date.now() }]);
// //   }, []);

// //   // ── Control channel ───────────────────────────────────────────────────────
// //   const attachControlChannel = useCallback((ch: RTCDataChannel) => {
// //     controlChannelRef.current = ch;
// //     ch.onmessage = (e) => {
// //       if (typeof e.data !== 'string') return;
// //       try {
// //         const msg: ControlMsg = JSON.parse(e.data);
// //         if (msg.type === 'control-grant')  { setControlGranted(true);  return; }
// //         if (msg.type === 'control-revoke') { setControlGranted(false); return; }
// //         // Mouse/keyboard events — forward to robotjs in Electron
// //         if (isInitiatorRef.current) {
// //           (window as any).electronAPI?.sendControlAction(msg);
// //         }
// //       } catch {}
// //     };
// //     ch.onerror = (e) => console.error('Control error:', e);
// //   }, []);

// //   // [FIX 4+6] Grant / revoke control — host sends message to viewer
// //   const grantControl = useCallback(() => {
// //     const ch = controlChannelRef.current;
// //     if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-grant' }));
// //   }, []);

// //   const revokeControl = useCallback(() => {
// //     const ch = controlChannelRef.current;
// //     if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
// //     setControlGranted(false);
// //   }, []);

// //   const sendControlEvent = useCallback((action: ControlAction) => {
// //     const ch = controlChannelRef.current;
// //     if (!ch || ch.readyState !== 'open' || !controlGranted) return;
// //     ch.send(JSON.stringify(action));
// //   }, [controlGranted]);

// //   // ── Cleanup ────────────────────────────────────────────────────────────────
// //   const _cleanup = useCallback(() => {
// //     myStreamRef.current?.getTracks().forEach(t => t.stop());
// //     callStreamRef.current?.getTracks().forEach(t => t.stop());
// //     setMyStream(null);
// //     setRemoteStream(null);
// //     setCallStream(null);
// //     setRemoteCallStream(null);
// //     setInCall(false);
// //     setCryptoReady(false);
// //     setControlGranted(false);
// //     setAmInitiator(false);
// //     peer.close();
// //     cryptoRef.current  = null;
// //     keyPairRef.current = null;
// //   }, []);

// //   // ── Main effect ────────────────────────────────────────────────────────────
// //   useEffect(() => {
// //     peer.reset();

// //     const socket = io(SERVER_URL, {
// //       transports: ['websocket', 'polling'],
// //       reconnection:          true,
// //       reconnectionAttempts:  5,
// //       reconnectionDelay:     1000,
// //       reconnectionDelayMax:  30000,
// //       randomizationFactor:   0.5,
// //       timeout:               20000,
// //     });
// //     socketRef.current = socket;

// //     if (peer.peer) {
// //       // ontrack: distinguish screen-share vs AV call tracks
// //       peer.peer.ontrack = (ev: RTCTrackEvent) => {
// //         const track  = ev.track;
// //         const stream = ev.streams[0] ?? new MediaStream([track]);
// //         console.log('Remote track received:', track.kind, track.label);

// //         if (track.kind === 'video') {
// //           // If we already have a remote screen stream, this is the AV call cam
// //           if (remoteStreamRef.current && remoteStreamRef.current.getVideoTracks().length > 0) {
// //             setRemoteCallStream(stream);
// //           } else {
// //             setRemoteStream(stream);
// //           }
// //         } else {
// //           // Audio: add to existing remote stream
// //           setRemoteStream(prev => {
// //             if (!prev) return stream;
// //             if (!prev.getTrackById(track.id)) prev.addTrack(track);
// //             return prev;
// //           });
// //         }
// //       };

// //       peer.peer.onicecandidate = (ev) => {
// //         if (ev.candidate && connectedUserRef.current) {
// //           socket.emit('ice-candidate', { target: connectedUserRef.current, candidate: ev.candidate });
// //         }
// //       };

// //       peer.peer.oniceconnectionstatechange = () => {
// //         const s = peer.peer?.iceConnectionState;
// //         if (s === 'connected' || s === 'completed') setStatus('Connected');
// //         if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
// //       };

// //       peer.peer.ondatachannel = (ev) => {
// //         if (ev.channel.label === 'chat')               attachChatChannel(ev.channel);
// //         else if (ev.channel.label === 'control')       attachControlChannel(ev.channel);
// //         else if (ev.channel.label === 'file-transfer') attachFileChannel(ev.channel);
// //       };
// //     }

// //     socket.on('connect', () => {
// //       setStatus('Connected');
// //       socket.emit('join-room', myId);
// //     });

// //     socket.on('disconnect', () => setStatus('Disconnected'));
// //     socket.on('connect_error', () => setStatus('Disconnected'));
// //     socket.on('reconnect', () => socket.emit('join-room', myId));
// //     socket.on('reconnect_failed', () => setStatus('Connection failed — please refresh'));

// //     // HOST: a viewer joined our room → create data channels + auto-share screen
// //     socket.on('user-connected', async (socketId: string) => {
// //       console.log('Viewer joined:', socketId);
// //       connectedUserRef.current = socketId;
// //       isInitiatorRef.current   = true;
// //       setAmInitiator(true);

// //       if (!peer.peer) return;

// //       const chatCh = peer.peer.createDataChannel('chat', { ordered: true });
// //       const ctrlCh = peer.peer.createDataChannel('control', { ordered: false, maxRetransmits: 0 });
// //       const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
// //       attachChatChannel(chatCh);
// //       attachControlChannel(ctrlCh);
// //       attachFileChannel(fileCh);

// //       try {
// //         const stream = await navigator.mediaDevices.getDisplayMedia({
// //           video: { frameRate: { ideal: 30 } },
// //           audio: true,
// //         });
// //         setMyStream(stream);
// //         const vid = stream.getVideoTracks()[0];
// //         const aud = stream.getAudioTracks()[0];
// //         if (vid) {
// //           peer.addTrack(vid, stream, SCREEN_VIDEO);
// //           vid.addEventListener('ended', () => {
// //             setMyStream(null);
// //             peer.removeTrack(SCREEN_VIDEO);
// //             peer.removeTrack(SCREEN_AUDIO);
// //           });
// //         }
// //         if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

// //         const offer = await peer.getOffer();
// //         socket.emit('call-user', { userToCall: socketId, from: socket.id, signalData: offer });
// //       } catch (err) {
// //         console.error('Auto screen-share failed:', err);
// //       }
// //     });

// //     // VIEWER: incoming offer from host (screen share OR av-call renegotiation)
// //     socket.on('incoming-call', async ({ from, signal }) => {
// //       console.log('Incoming call from:', from, 'type:', signal?.type);
// //       connectedUserRef.current = from;
// //       isInitiatorRef.current   = false;
// //       setAmInitiator(false);

// //       const answer = await peer.getAnswer(signal);
// //       socket.emit('answer-call', { to: from, signal: answer });
// //     });

// //     // [FIX 2] VIEWER: incoming AV call offer — auto-capture media and answer.
// //     //   The host emits 'incoming-av-call' when they start an audio/video call.
// //     //   The viewer's browser shows a permission prompt, captures mic/cam, adds
// //     //   tracks to the peer connection, and sends a re-negotiation answer.
// //     socket.on('incoming-av-call', async ({ from, signal, withVideo }: {
// //       from: string;
// //       signal: RTCSessionDescriptionInit;
// //       withVideo: boolean;
// //     }) => {
// //       console.log('[FIX 2] Incoming AV call from:', from, 'withVideo:', withVideo);
// //       connectedUserRef.current = from;

// //       let stream: MediaStream;
// //       try {
// //         stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
// //       } catch (err: any) {
// //         if (withVideo) {
// //           try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
// //           catch { console.error('Could not get mic for incoming call:', err); return; }
// //         } else {
// //           console.error('Could not get mic for incoming call:', err);
// //           return;
// //         }
// //       }

// //       setCallStream(stream);
// //       setInCall(true);

// //       const mic = stream.getAudioTracks()[0];
// //       const cam = stream.getVideoTracks()[0];
// //       if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
// //       if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

// //       // Answer the re-negotiation offer
// //       const answer = await peer.getAnswer(signal);
// //       socket.emit('answer-call', { to: from, signal: answer });
// //     });

// //     // HOST: answer received
// //     socket.on('call-accepted', async (data) => {
// //       try { await peer.setRemoteDescription(data?.signal ?? data); }
// //       catch (err) { console.error('setRemoteDescription failed:', err); }
// //     });

// //     // ICE candidates
// //     socket.on('ice-candidate', async ({ candidate }) => {
// //       if (!peer.peer) return;
// //       try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
// //       catch (err) { console.warn('addIceCandidate failed:', err); }
// //     });

// //     // [FIX 3] Remote peer ended session → both sides return to home
// //     socket.on('hang-up', () => {
// //       console.log('Remote peer hung up');
// //       _cleanup();
// //       setStatus('Disconnected');
// //     });

// //     return () => {
// //       socket.disconnect();
// //       socketRef.current = null;
// //     };
// //   }, [myId, attachChatChannel, attachControlChannel, attachFileChannel, _cleanup]);

// //   // ── Public actions ────────────────────────────────────────────────────────

// //   const connectToPeer = useCallback((targetId: string) => {
// //     socketRef.current?.emit('join-room', targetId);
// //   }, []);

// //   // Host: start/stop screen share
// //   const startScreenShare = useCallback(async () => {
// //     if (!connectedUserRef.current || !socketRef.current) {
// //       alert('No viewer connected yet.'); return;
// //     }
// //     try {
// //       const stream = await navigator.mediaDevices.getDisplayMedia({
// //         video: { frameRate: { ideal: 30 } },
// //         audio: true,
// //       });
// //       setMyStream(stream);
// //       const vid = stream.getVideoTracks()[0];
// //       const aud = stream.getAudioTracks()[0];
// //       if (vid) {
// //         peer.addTrack(vid, stream, SCREEN_VIDEO);
// //         vid.addEventListener('ended', () => {
// //           setMyStream(null);
// //           peer.removeTrack(SCREEN_VIDEO);
// //           peer.removeTrack(SCREEN_AUDIO);
// //         });
// //       }
// //       if (aud) peer.addTrack(aud, stream, SCREEN_AUDIO);

// //       if (peer.peer?.signalingState === 'stable') {
// //         const offer = await peer.getOffer();
// //         socketRef.current!.emit('call-user', {
// //           userToCall: connectedUserRef.current,
// //           from: socketRef.current!.id,
// //           signalData: offer,
// //         });
// //       }
// //     } catch (err: any) {
// //       if (err.name === 'NotAllowedError') alert('Screen share denied. Please allow it when prompted.');
// //       else console.error('Screen share failed:', err);
// //     }
// //   }, []);

// //   // [FIX 6] stopScreenShare properly exported
// //   const stopScreenShare = useCallback(() => {
// //     myStreamRef.current?.getTracks().forEach(t => t.stop());
// //     peer.removeTrack(SCREEN_VIDEO);
// //     peer.removeTrack(SCREEN_AUDIO);
// //     setMyStream(null);
// //   }, []);

// //   // [FIX 6] toggleScreenAudio properly exported
// //   const toggleScreenAudio = useCallback(() => {
// //     setScreenAudioEnabled(prev => {
// //       const next = !prev;
// //       const aud  = myStreamRef.current?.getAudioTracks()[0] ?? null;
// //       peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
// //       return next;
// //     });
// //   }, []);

// //   // [FIX 2] startCall: ONLY the calling side captures media + sends the offer.
// //   //   A new 'incoming-av-call' socket event is emitted to the remote peer so
// //   //   they can capture their media and answer — this makes BOTH sides visible.
// //   const startCall = useCallback(async (withVideo = true) => {
// //     if (!connectedUserRef.current || !socketRef.current) {
// //       alert('No peer connected yet.'); return;
// //     }

// //     let stream: MediaStream;
// //     try {
// //       stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
// //     } catch (err: any) {
// //       if (withVideo && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
// //         try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); withVideo = false; }
// //         catch { alert('Microphone not found or permission denied.'); return; }
// //       } else if (err.name === 'NotAllowedError') {
// //         alert('Camera/microphone permission denied. Allow access in browser settings.');
// //         return;
// //       } else { alert(`Could not start call: ${err.message}`); return; }
// //     }

// //     setCallStream(stream);
// //     setInCall(true);

// //     const mic = stream.getAudioTracks()[0];
// //     const cam = stream.getVideoTracks()[0];
// //     if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
// //     if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

// //     if (!peer.peer || peer.peer.signalingState !== 'stable') return;

// //     // Send an offer that also signals "I am starting an AV call"
// //     const offer = await peer.getOffer();

// //     // [FIX 2] Use 'incoming-av-call' event so the server knows to forward the
// //     // withVideo flag. The signaling-server must relay this (see events.ts).
// //     socketRef.current.emit('av-call-user', {
// //       userToCall: connectedUserRef.current,
// //       from: socketRef.current.id,
// //       signalData: offer,
// //       withVideo,
// //     });
// //   }, []);

// //   const endCall = useCallback(() => {
// //     callStreamRef.current?.getTracks().forEach(t => t.stop());
// //     peer.removeTrack(MIC_AUDIO);
// //     peer.removeTrack(CAM_VIDEO);
// //     setCallStream(null);
// //     setRemoteCallStream(null);
// //     setInCall(false);
// //   }, []);

// //   const toggleMic = useCallback(() => {
// //     setMicEnabled(prev => {
// //       const next = !prev;
// //       const t    = callStreamRef.current?.getAudioTracks()[0];
// //       if (t) t.enabled = next;
// //       return next;
// //     });
// //   }, []);

// //   const toggleCam = useCallback(() => {
// //     setCamEnabled(prev => {
// //       const next = !prev;
// //       const t    = callStreamRef.current?.getVideoTracks()[0];
// //       if (t) {
// //         t.enabled = next;
// //         peer.replaceTrack(CAM_VIDEO, next ? t : null);
// //       }
// //       return next;
// //     });
// //   }, []);

// //   // [FIX 3] stopAllTracks: stops media + signals remote peer to go to home screen
// //   const stopAllTracks = useCallback(() => {
// //     if (connectedUserRef.current && socketRef.current) {
// //       socketRef.current.emit('hang-up', { to: connectedUserRef.current });
// //     }
// //     _cleanup();
// //   }, [_cleanup]);

// //   return {
// //     connectionStatus: status,
// //     connectToPeer,
// //     myStream, remoteStream,
// //     startScreenShare, stopScreenShare,
// //     screenAudioEnabled, toggleScreenAudio,
// //     callStream, remoteCallStream,
// //     inCall, startCall, endCall,
// //     micEnabled, toggleMic,
// //     camEnabled, toggleCam,
// //     messages, sendChatMessage, cryptoReady,
// //     amInitiator,
// //     controlGranted, grantControl, revokeControl, sendControlEvent,
// //     sendFileChunk,
// //     stopAllTracks,
// //   };
// // };




// import { useEffect, useState, useCallback, useRef } from 'react';
// import { io, Socket } from 'socket.io-client';
// import peer from '../services/peer';
// import {
//   generateECDHKeyPair, importPublicKey,
//   buildCryptoSession, encryptMessage, decryptMessage,
// } from '../services/messageCrypto';

// const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// export interface ChatMessage { from: 'me' | 'them'; text: string; timestamp: number; }

// export interface ControlAction {
//   type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
//   normX?: number; normY?: number;
//   button?: 'left' | 'right' | 'middle';
//   key?: string; scrollX?: number; scrollY?: number;
// }

// type ControlMsg = ControlAction | { type: 'control-grant' } | { type: 'control-revoke' };

// export const usePeerConnection = (
//   myId: string,
//   _remoteId: string,
//   onFileChunk?: (data: ArrayBuffer | string) => void,
//   onSessionEnded?: () => void,   // NEW: called when remote ends session
// ) => {
//   const [status, setStatus]                   = useState('Disconnected');
//   const [myStream, setMyStream]               = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream]       = useState<MediaStream | null>(null);
//   const [callStream, setCallStream]           = useState<MediaStream | null>(null);
//   const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
//   const [inCall, setInCall]                   = useState(false);
//   const [micEnabled, setMicEnabled]           = useState(true);
//   const [camEnabled, setCamEnabled]           = useState(true);
//   const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
//   const [messages, setMessages]               = useState<ChatMessage[]>([]);
//   const [cryptoReady, setCryptoReady]         = useState(false);
//   const [isHost, setIsHost]                   = useState(false);
//   const [controlGranted, setControlGranted]   = useState(false);

//   const socketRef         = useRef<Socket | null>(null);
//   const peerSocketIdRef   = useRef<string | null>(null); // remote's socket.id
//   const isHostRef         = useRef(false);
//   const chatChannelRef    = useRef<RTCDataChannel | null>(null);
//   const controlChannelRef = useRef<RTCDataChannel | null>(null);
//   const fileChannelRef    = useRef<RTCDataChannel | null>(null);
//   const cryptoRef         = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
//   const keyPairRef        = useRef<CryptoKeyPair | null>(null);
//   const onFileChunkRef    = useRef(onFileChunk);
//   const onSessionEndedRef = useRef(onSessionEnded);
//   const myStreamRef       = useRef<MediaStream | null>(null);
//   const callStreamRef     = useRef<MediaStream | null>(null);
//   const controlGrantedRef = useRef(false);

//   useEffect(() => { onFileChunkRef.current    = onFileChunk;    }, [onFileChunk]);
//   useEffect(() => { onSessionEndedRef.current = onSessionEnded; }, [onSessionEnded]);
//   useEffect(() => { myStreamRef.current       = myStream;       }, [myStream]);
//   useEffect(() => { callStreamRef.current     = callStream;     }, [callStream]);
//   useEffect(() => { controlGrantedRef.current = controlGranted; }, [controlGranted]);

//   // Track IDs
//   const SCREEN_VIDEO = 'screen-video';
//   const SCREEN_AUDIO = 'screen-audio';
//   const MIC_AUDIO    = 'mic-audio';
//   const CAM_VIDEO    = 'cam-video';

//   // ── File channel ──────────────────────────────────────────────────────────
//   const attachFileChannel = useCallback((ch: RTCDataChannel) => {
//     ch.binaryType = 'arraybuffer';
//     fileChannelRef.current = ch;
//     ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
//     ch.onerror   = (e) => console.error('[file]', e);
//   }, []);

//   const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
//     const ch = fileChannelRef.current;
//     if (!ch || ch.readyState !== 'open') { console.warn('file channel not open'); return; }
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
//         } catch {}
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
//       } catch {}
//     };
//     ch.onerror = (e) => console.error('[chat]', e);
//     ch.onclose = () => setCryptoReady(false);
//     ch.onopen  = () => sendKey();
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

//         // Mouse/keyboard action: only the HOST executes these (HOST = isHostRef.current)
//         // The HOST shares their screen and is the machine being controlled
//         if (isHostRef.current) {
//           (window as any).electronAPI?.sendControlAction(msg);
//         }
//       } catch {}
//     };
//     ch.onerror = (e) => console.error('[ctrl]', e);
//   }, []);

//   // Grant/revoke — HOST sends to viewer via control channel
//   // Also updates local controlGranted so the host's UI toggles correctly
//   const grantControl = useCallback(() => {
//     const ch = controlChannelRef.current;
//     if (ch?.readyState === 'open') {
//       ch.send(JSON.stringify({ type: 'control-grant' }));
//       setControlGranted(true);
//       console.log('[control] granted access to viewer');
//     } else {
//       console.warn('[control] cannot grant — control channel not open');
//     }
//   }, []);

//   const revokeControl = useCallback(() => {
//     const ch = controlChannelRef.current;
//     if (ch?.readyState === 'open') {
//       ch.send(JSON.stringify({ type: 'control-revoke' }));
//       console.log('[control] revoked access from viewer');
//     }
//     setControlGranted(false);
//   }, []);

//   // Viewer sends mouse/keyboard events to host
//   const sendControlEvent = useCallback((action: ControlAction) => {
//     const ch = controlChannelRef.current;
//     if (!ch || ch.readyState !== 'open' || !controlGrantedRef.current) return;
//     ch.send(JSON.stringify(action));
//   }, []);

//   // ── Cleanup ───────────────────────────────────────────────────────────────
//   const _stopMedia = useCallback(() => {
//     myStreamRef.current?.getTracks().forEach(t => t.stop());
//     callStreamRef.current?.getTracks().forEach(t => t.stop());
//     setMyStream(null);
//     setRemoteStream(null);
//     setCallStream(null);
//     setRemoteCallStream(null);
//     setInCall(false);
//     setControlGranted(false);
//     setCryptoReady(false);
//     peer.close();
//     cryptoRef.current  = null;
//     keyPairRef.current = null;
//   }, []);

//   // ── Main socket effect ────────────────────────────────────────────────────
//   useEffect(() => {
//     peer.reset();

//     const socket = io(SERVER_URL, {
//       transports: ['websocket', 'polling'],
//       reconnection: true, reconnectionAttempts: 5,
//       reconnectionDelay: 1000, reconnectionDelayMax: 30000,
//       timeout: 20000,
//     });
//     socketRef.current = socket;

//     // ── RTCPeerConnection events ─────────────────────────────────────────────
//     if (peer.peer) {
//       // Track the first video stream ID (screen share). Any subsequent
//       // video stream from a different ID is the AV call camera.
//       let firstVideoStreamId: string | null = null;

//       peer.peer.ontrack = (ev: RTCTrackEvent) => {
//         const track  = ev.track;
//         const stream = ev.streams[0] || new MediaStream([track]);
//         console.log('[ontrack]', track.kind, stream.id, track.label || track.id);

//         if (track.kind === 'video') {
//           if (firstVideoStreamId === null) {
//             // First video track = screen share
//             firstVideoStreamId = stream.id;
//             setRemoteStream(stream);
//             console.log('[ontrack] → remoteStream (screen share)');
//           } else if (stream.id !== firstVideoStreamId) {
//             // Different stream = AV call camera
//             setRemoteCallStream(stream);
//             console.log('[ontrack] → remoteCallStream (AV camera)');
//           } else {
//             // Same stream as screen share (e.g. replaced track) — update
//             setRemoteStream(stream);
//           }
//         } else {
//           // Audio track — route to the correct stream
//           if (firstVideoStreamId === null || stream.id === firstVideoStreamId) {
//             // Screen-share audio (or first audio before any video)
//             setRemoteStream(prev => {
//               if (!prev) return stream;
//               if (!prev.getTrackById(track.id)) {
//                 return new MediaStream([...prev.getTracks(), track]);
//               }
//               return prev;
//             });
//           } else {
//             // AV call microphone audio
//             setRemoteCallStream(prev => {
//               if (!prev) return stream;
//               if (!prev.getTrackById(track.id)) {
//                 return new MediaStream([...prev.getTracks(), track]);
//               }
//               return prev;
//             });
//           }
//         }
//       };

//       peer.peer.onicecandidate = (ev) => {
//         if (ev.candidate && peerSocketIdRef.current) {
//           socket.emit('ice-candidate', {
//             target: peerSocketIdRef.current,
//             candidate: ev.candidate,
//           });
//         }
//       };

//       peer.peer.oniceconnectionstatechange = () => {
//         const s = peer.peer?.iceConnectionState;
//         console.log('[ICE]', s);
//         if (s === 'connected' || s === 'completed') setStatus('Connected');
//         if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
//       };

//       peer.peer.ondatachannel = (ev) => {
//         console.log('[datachannel]', ev.channel.label);
//         if (ev.channel.label === 'chat')           attachChatChannel(ev.channel);
//         if (ev.channel.label === 'control')        attachControlChannel(ev.channel);
//         if (ev.channel.label === 'file-transfer')  attachFileChannel(ev.channel);
//       };
//     }

//     // ── Socket events ────────────────────────────────────────────────────────

//     socket.on('connect', () => {
//       setStatus('Connected');
//       socket.emit('join-room', myId);
//       console.log('[socket] connected, joined room', myId);
//     });

//     socket.on('disconnect', () => setStatus('Disconnected'));
//     socket.on('connect_error', (e) => { console.error('[socket] connect_error', e); setStatus('Disconnected'); });
//     socket.on('reconnect', () => socket.emit('join-room', myId));
//     socket.on('room-full', () => alert('Room is full. Only 2 peers allowed per session.'));

//     // HOST: viewer connected → create data channels + start screen share
//     socket.on('user-connected', async (viewerSocketId: string) => {
//       console.log('[host] viewer connected:', viewerSocketId);
//       peerSocketIdRef.current = viewerSocketId;
//       isHostRef.current = true;
//       setIsHost(true);

//       if (!peer.peer) return;

//       // Create all three data channels (host side always creates them)
//       const chatCh = peer.peer.createDataChannel('chat',          { ordered: true });
//       const ctrlCh = peer.peer.createDataChannel('control',       { ordered: true });
//       const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
//       attachChatChannel(chatCh);
//       attachControlChannel(ctrlCh);
//       attachFileChannel(fileCh);

//       // Auto-prompt host to share screen
//       try {
//         const stream = await navigator.mediaDevices.getDisplayMedia({
//           video: { frameRate: { ideal: 30, max: 30 } },
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
//         if (offer) {
//           socket.emit('call-user', { userToCall: viewerSocketId, from: socket.id, signalData: offer });
//         }
//       } catch (err: any) {
//         console.error('[host] screen share failed:', err.message);
//         // Still send offer so data channels open (no media tracks yet)
//         const offer = await peer.getOffer();
//         if (offer) socket.emit('call-user', { userToCall: viewerSocketId, from: socket.id, signalData: offer });
//       }
//     });

//     // VIEWER: incoming offer from host (screen share)
//     socket.on('incoming-call', async ({ from, signal }: { from: string; signal: RTCSessionDescriptionInit }) => {
//       console.log('[viewer] incoming-call from', from);
//       peerSocketIdRef.current = from;
//       isHostRef.current = false;
//       setIsHost(false);

//       const answer = await peer.getAnswer(signal);
//       if (answer) socket.emit('answer-call', { to: from, signal: answer });
//     });

//     // VIEWER: host started AV call — capture own cam/mic and answer
//     socket.on('incoming-av-call', async ({
//       from, signal, withVideo,
//     }: { from: string; signal: RTCSessionDescriptionInit; withVideo: boolean }) => {
//       console.log('[viewer] incoming-av-call from', from, 'video:', withVideo);

//       // Capture viewer's own media BEFORE answering so the tracks
//       // are included in the SDP answer (this is the key fix for
//       // two-way AV visibility)
//       let stream: MediaStream | null = null;
//       try {
//         stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
//       } catch {
//         try {
//           stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
//         } catch (e2) {
//           console.error('[viewer] cannot get media for AV call:', e2);
//         }
//       }

//       if (stream) {
//         setCallStream(stream);
//         setInCall(true);
//         const mic = stream.getAudioTracks()[0];
//         const cam = stream.getVideoTracks()[0];
//         if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
//         if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);
//       }

//       // Use peer.getAnswer() which atomically sets remote description
//       // and creates the answer. This avoids the race condition that
//       // occurred when manually calling setRemoteDescription + createAnswer.
//       const answer = await peer.getAnswer(signal);
//       if (answer) {
//         socket.emit('answer-call', { to: from, signal: answer });
//         console.log('[viewer] AV call answered successfully');
//       } else {
//         console.error('[viewer] AV renegotiation failed: no answer generated');
//       }
//     });

//     // HOST/VIEWER: answer received
//     socket.on('call-accepted', async (data: any) => {
//       try {
//         const sdp = data?.signal ?? data;
//         await peer.setRemoteDescription(sdp);
//         console.log('[peer] remote description set');
//       } catch (e) { console.error('[peer] setRemoteDescription failed:', e); }
//     });

//     // ICE candidates
//     socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
//       if (!peer.peer) return;
//       try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
//       catch (e) { console.warn('[ICE] addIceCandidate failed:', e); }
//     });

//     // ── session-ended: REMOTE peer ended session → call onSessionEnded ───────
//     // This is the key fix for issue #1: remote side navigates to home screen
//     socket.on('session-ended', () => {
//       console.log('[socket] session-ended received from remote');
//       _stopMedia();
//       setStatus('Disconnected');
//       // Use setTimeout so React state updates flush before navigation
//       setTimeout(() => { onSessionEndedRef.current?.(); }, 100);
//     });

//     return () => {
//       socket.removeAllListeners();
//       socket.disconnect();
//       socketRef.current = null;
//     };
//   }, [myId, attachChatChannel, attachControlChannel, attachFileChannel, _stopMedia]);

//   // ── Public API ────────────────────────────────────────────────────────────

//   const connectToPeer = useCallback((targetId: string) => {
//     socketRef.current?.emit('join-room', targetId);
//   }, []);

//   const startScreenShare = useCallback(async () => {
//     if (!peerSocketIdRef.current) { alert('No peer connected yet.'); return; }
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
//         if (offer) socketRef.current?.emit('call-user', {
//           userToCall: peerSocketIdRef.current,
//           from: socketRef.current?.id,
//           signalData: offer,
//         });
//       }
//     } catch (err: any) {
//       if (err.name !== 'NotAllowedError') console.error('[screen]', err);
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
//       const aud  = myStreamRef.current?.getAudioTracks()[0] ?? null;
//       if (aud) aud.enabled = next;
//       peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
//       return next;
//     });
//   }, []);

//   // ── startCall: caller captures media + sends AV offer to remote ───────────
//   // Remote receives 'incoming-av-call', captures their own media, and answers.
//   // This results in BOTH sides having their camera/mic active.
//   const startCall = useCallback(async (withVideo = true) => {
//     if (!peerSocketIdRef.current || !socketRef.current) {
//       alert('No peer connected yet.'); return;
//     }

//     let stream: MediaStream | null = null;
//     try {
//       stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });
//     } catch (err: any) {
//       try {
//         stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
//         withVideo = false;
//       } catch {
//         alert('Could not access microphone. Check browser permissions.');
//         return;
//       }
//     }

//     if (!stream) {
//       alert('Could not access microphone. Check browser permissions.');
//       return;
//     }

//     setCallStream(stream);
//     setInCall(true);

//     const mic = stream.getAudioTracks()[0];
//     const cam = stream.getVideoTracks()[0];
//     if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
//     if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

//     // Wait until signaling is stable before sending new offer
//     const waitForStable = () => new Promise<void>(resolve => {
//       if (!peer.peer || peer.peer.signalingState === 'stable') { resolve(); return; }
//       const check = () => {
//         if (!peer.peer || peer.peer.signalingState === 'stable') {
//           peer.peer?.removeEventListener('signalingstatechange', check);
//           resolve();
//         }
//       };
//       peer.peer.addEventListener('signalingstatechange', check);
//       setTimeout(resolve, 3000); // timeout safety
//     });

//     await waitForStable();

//     try {
//       const offer = await peer.getOffer();
//       if (offer) {
//         socketRef.current.emit('av-call-user', {
//           userToCall: peerSocketIdRef.current,
//           from: socketRef.current.id,
//           signalData: offer,
//           withVideo,
//         });
//       }
//     } catch (e) {
//       console.error('[startCall] offer failed:', e);
//     }
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
//       const t = callStreamRef.current?.getAudioTracks()[0];
//       if (t) t.enabled = next;
//       return next;
//     });
//   }, []);

//   const toggleCam = useCallback(() => {
//     setCamEnabled(prev => {
//       const next = !prev;
//       const t = callStreamRef.current?.getVideoTracks()[0];
//       if (t) t.enabled = next;
//       return next;
//     });
//   }, []);

//   // ── End session: emit hang-up then clean up ───────────────────────────────
//   // Issue #1 fix: we emit 'hang-up' with the PEER'S socket.id so the server
//   // delivers 'session-ended' to exactly that socket. The remote listener calls
//   // onSessionEnded() which navigates to home. We call onSessionEnded() locally
//   // too via the caller (SessionPage → onEnd).
//   const stopAllTracks = useCallback(() => {
//     const peerId = peerSocketIdRef.current;
//     if (peerId && socketRef.current?.connected) {
//       socketRef.current.emit('hang-up', { to: peerId });
//     }
//     _stopMedia();
//   }, [_stopMedia]);

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
//     isHost,
//     controlGranted, grantControl, revokeControl, sendControlEvent,
//     sendFileChunk,
//     stopAllTracks,
//   };
// };






// frontend/src/hooks/usePeerConnection.ts
//
// FIXES IN THIS FILE:
//
// [BRAVE] transports: ['polling','websocket'] — Brave Shields block the initial
//   WSS handshake causing an infinite connect_error loop. Polling (HTTP) always
//   works through Brave; socket.io upgrades to WebSocket after it connects.
//
// [ACCEPT] Session request/accept flow — host now gets pendingViewer state +
//   acceptConnection() / rejectConnection() instead of auto-proceeding.
//   The 'user-connected' event stores the viewer and waits for the host to accept.
//
// [QUALITY] connectionQuality via RTCPeerConnection.getStats() polled every 2s.
//   Exposes rttMs, bitrateKbps, packetLossPct, fps.
//
// [CLIPBOARD] New 'clipboard' DataChannel for bidirectional text sync.
//   syncClipboard() reads local clipboard and sends it to the peer.
//
// [PERMS] grantControl() now accepts a ControlPerms bitmask (mouse, keyboard,
//   clipboard, fileTransfer) so the host can grant granular permissions.
//
// [RECONNECT] Host reconnect works because the room ID is now permanent
//   (persisted in localStorage) — see HomePage.tsx for the ID management.
//   When the host reconnects to the same room ID the viewer is still in,
//   'user-connected' fires again and the host can accept the reconnect.

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import peer from '../services/peer';
import {
  generateECDHKeyPair, importPublicKey,
  buildCryptoSession, encryptMessage, decryptMessage,
} from '../services/messageCrypto';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://rda-signaling.duckdns.org';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ChatMessage { from: 'me' | 'them'; text: string; timestamp: number; }

export interface ControlAction {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'scroll' | 'keydown' | 'keyup';
  normX?: number; normY?: number;
  button?: 'left' | 'right' | 'middle';
  key?: string; code?: string; scrollX?: number; scrollY?: number;
  ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean;
}

/** Granular permission set sent with control-grant */
export interface ControlPerms {
  mouse: boolean;
  keyboard: boolean;
  clipboard: boolean;
  fileTransfer: boolean;
}

/** Connection quality snapshot from getStats() */
export interface ConnectionQuality {
  rttMs: number;
  bitrateKbps: number;
  packetLossPct: number;
  fps: number;
}

/** Viewer waiting for host to accept */
export interface PendingViewer {
  socketId: string;
  joinedAt: number;
}

type ControlMsg =
  | ControlAction
  | { type: 'control-grant'; perms: ControlPerms }
  | { type: 'control-revoke' }
  | { type: 'clipboard-sync'; text: string };

// ── Hook ─────────────────────────────────────────────────────────────────────

export const usePeerConnection = (
  myId: string,
  _remoteId: string,
  onFileChunk?: (data: ArrayBuffer | string) => void,
  onSessionEnded?: () => void,
  onConnectionRequest?: (viewer: PendingViewer) => void,
) => {
  const [status, setStatus]                       = useState('Disconnected');
  const [myStream, setMyStream]                   = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream]           = useState<MediaStream | null>(null);
  const [callStream, setCallStream]               = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream]   = useState<MediaStream | null>(null);
  const [inCall, setInCall]                       = useState(false);
  const [micEnabled, setMicEnabled]               = useState(true);
  const [camEnabled, setCamEnabled]               = useState(true);
  const [screenAudioEnabled, setScreenAudioEnabled] = useState(true);
  const [messages, setMessages]                   = useState<ChatMessage[]>([]);
  const [cryptoReady, setCryptoReady]             = useState(false);
  const [isHost, setIsHost]                       = useState(false);
  const [controlGranted, setControlGranted]       = useState(false);
  const [controlPerms, setControlPerms]           = useState<ControlPerms>({
    mouse: true, keyboard: true, clipboard: true, fileTransfer: true,
  });
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [pendingViewer, setPendingViewer]         = useState<PendingViewer | null>(null);
  const [isWaitingForHost, setIsWaitingForHost]   = useState(false);

  // Refs
  const socketRef          = useRef<Socket | null>(null);
  const peerSocketIdRef    = useRef<string | null>(null);
  const isHostRef          = useRef(false);
  const chatChannelRef     = useRef<RTCDataChannel | null>(null);
  const controlChannelRef  = useRef<RTCDataChannel | null>(null);
  const fileChannelRef     = useRef<RTCDataChannel | null>(null);
  const clipboardChannelRef = useRef<RTCDataChannel | null>(null);
  const cryptoRef          = useRef<Awaited<ReturnType<typeof buildCryptoSession>> | null>(null);
  const keyPairRef         = useRef<CryptoKeyPair | null>(null);
  const onFileChunkRef     = useRef(onFileChunk);
  const onSessionEndedRef  = useRef(onSessionEnded);
  const onConnectionReqRef = useRef(onConnectionRequest);
  const myStreamRef        = useRef<MediaStream | null>(null);
  const callStreamRef      = useRef<MediaStream | null>(null);
  const controlGrantedRef  = useRef(false);
  const controlPermsRef    = useRef<ControlPerms>({ mouse: true, keyboard: true, clipboard: true, fileTransfer: true });
  const grantedPermsRef    = useRef<ControlPerms>({ mouse: true, keyboard: true, clipboard: true, fileTransfer: true });
  const pendingViewerRef   = useRef<PendingViewer | null>(null);
  const statsIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionEstablishedRef = useRef(false);

  useEffect(() => { onFileChunkRef.current    = onFileChunk;       }, [onFileChunk]);
  useEffect(() => { onSessionEndedRef.current  = onSessionEnded;   }, [onSessionEnded]);
  useEffect(() => { onConnectionReqRef.current = onConnectionRequest; }, [onConnectionRequest]);
  useEffect(() => { myStreamRef.current        = myStream;         }, [myStream]);
  useEffect(() => { callStreamRef.current      = callStream;       }, [callStream]);
  useEffect(() => { controlGrantedRef.current  = controlGranted;   }, [controlGranted]);
  useEffect(() => { controlPermsRef.current    = controlPerms;     }, [controlPerms]);
  useEffect(() => { pendingViewerRef.current   = pendingViewer;    }, [pendingViewer]);

  const applyClipboardText = useCallback(async (text: string) => {
    const api = (window as any).electronAPI;
    try {
      if (api?.writeClipboard) await api.writeClipboard(text);
      else await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  const readClipboardText = useCallback(async (): Promise<string> => {
    const api = (window as any).electronAPI;
    try {
      if (api?.readClipboard) return await api.readClipboard();
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  }, []);

  const SCREEN_VIDEO = 'screen-video';
  const SCREEN_AUDIO = 'screen-audio';
  const MIC_AUDIO    = 'mic-audio';
  const CAM_VIDEO    = 'cam-video';

  // ── Quality polling ───────────────────────────────────────────────────────

  const startQualityPolling = useCallback(() => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!peer.peer || peer.peer.connectionState !== 'connected') return;
      try {
        const stats = await peer.peer.getStats();
        let rtt = 0, bitrate = 0, packetLoss = 0, fps = 0;
        let prevBytes = 0, prevTs = 0;
        stats.forEach((r: RTCStats & Record<string, any>) => {
          if (r.type === 'candidate-pair' && r.state === 'succeeded') {
            rtt = Math.round((r.currentRoundTripTime ?? 0) * 1000);
          }
          if (r.type === 'inbound-rtp' && r.mediaType === 'video') {
            fps = Math.round(r.framesPerSecond ?? 0);
            const total = (r.packetsReceived ?? 0) + (r.packetsLost ?? 0);
            if (total > 0) packetLoss = Math.round(((r.packetsLost ?? 0) / total) * 100);
          }
          if (r.type === 'inbound-rtp') {
            const bytes = r.bytesReceived ?? 0;
            const ts    = r.timestamp ?? 0;
            if (prevTs > 0 && ts > prevTs) {
              bitrate = Math.round(((bytes - prevBytes) * 8) / ((ts - prevTs) / 1000) / 1000);
            }
            prevBytes = bytes; prevTs = ts;
          }
        });
        setConnectionQuality({ rttMs: rtt, bitrateKbps: bitrate, packetLossPct: packetLoss, fps });
      } catch {}
    }, 2000);
  }, []);

  const stopQualityPolling = useCallback(() => {
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
  }, []);

  // ── DataChannel: file ─────────────────────────────────────────────────────

  const attachFileChannel = useCallback((ch: RTCDataChannel) => {
    ch.binaryType = 'arraybuffer';
    fileChannelRef.current = ch;
    ch.onmessage = (e) => onFileChunkRef.current?.(e.data);
    ch.onerror   = (e) => console.error('[file]', e);
    ch.onopen    = () => console.log('[file] open');
    ch.onclose   = () => console.log('[file] closed');
  }, []);

  const sendFileChunk = useCallback((data: string | ArrayBuffer) => {
    const ch = fileChannelRef.current;
    if (!ch || ch.readyState !== 'open') { console.warn('[file] not open'); return; }
    ch.send(data as any);
  }, []);

  // ── DataChannel: clipboard sync ───────────────────────────────────────────

  const attachClipboardChannel = useCallback((ch: RTCDataChannel) => {
    clipboardChannelRef.current = ch;
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'clipboard-sync' && typeof msg.text === 'string') {
          applyClipboardText(msg.text);
        }
      } catch {}
    };
    ch.onerror = (e) => console.error('[clipboard]', e);
  }, [applyClipboardText]);

  /** Copy local clipboard content to the peer's clipboard */
  const syncClipboard = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const text = await readClipboardText();
    if (!text) {
      return { ok: false, message: 'Clipboard is empty or access was denied.' };
    }

    const payload = JSON.stringify({ type: 'clipboard-sync', text });

    const ch = clipboardChannelRef.current;
    if (ch?.readyState === 'open') {
      ch.send(payload);
      return { ok: true, message: 'Clipboard sent to remote.' };
    }

    const ctrlCh = controlChannelRef.current;
    if (ctrlCh?.readyState === 'open') {
      ctrlCh.send(payload);
      return { ok: true, message: 'Clipboard sent to remote.' };
    }

    if (peerSocketIdRef.current && socketRef.current?.connected) {
      socketRef.current.emit('clipboard-sync', { to: peerSocketIdRef.current, text });
      return { ok: true, message: 'Clipboard sent to remote (relay).' };
    }

    return { ok: false, message: 'Not connected — clipboard sync unavailable.' };
  }, [readClipboardText]);

  // ── DataChannel: encrypted chat ───────────────────────────────────────────

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
          console.log('[chat] E2EE ready');
        }
      } catch {}
    };
    ch.onerror  = (e) => console.error('[chat]', e);
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

  // ── DataChannel: control (bidirectional typed messages) ───────────────────

  const attachControlChannel = useCallback((ch: RTCDataChannel) => {
    controlChannelRef.current = ch;
    ch.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      try {
        const msg: ControlMsg = JSON.parse(e.data);
        if (msg.type === 'control-grant') {
          setControlGranted(true);
          if ('perms' in msg && msg.perms) {
            setControlPerms(msg.perms);
            controlPermsRef.current = msg.perms;
          }
          return;
        }
        if (msg.type === 'control-revoke')   { setControlGranted(false); return; }
        if (msg.type === 'clipboard-sync')   {
          applyClipboardText((msg as any).text ?? '');
          return;
        }
        // Mouse/keyboard: HOST executes these (HOST has isHostRef.current = true)
        if (isHostRef.current) {
          const perms = grantedPermsRef.current;
          if (msg.type === 'keydown' || msg.type === 'keyup') {
            if (!perms.keyboard) return;
          } else if (msg.type === 'mousemove' || msg.type === 'mousedown' || msg.type === 'mouseup' || msg.type === 'click' || msg.type === 'scroll') {
            if (!perms.mouse) return;
          }
          (window as any).electronAPI?.sendControlAction(msg);
        }
      } catch {}
    };
    ch.onerror = (e) => console.error('[ctrl]', e);
    ch.onopen  = () => {
      console.log('[ctrl] open');
      // Host: auto-grant mouse, keyboard & clipboard when control channel is ready
      if (isHostRef.current && !controlGrantedRef.current) {
        const perms: ControlPerms = {
          mouse: true, keyboard: true, clipboard: true, fileTransfer: true,
        };
        grantedPermsRef.current = perms;
        ch.send(JSON.stringify({ type: 'control-grant', perms }));
        setControlGranted(true);
        setControlPerms(perms);
      }
    };
  }, [applyClipboardText]);

  /** Host: grant control to viewer with optional granular permissions */
  const grantControl = useCallback((perms?: Partial<ControlPerms>) => {
    const ch = controlChannelRef.current;
    const fullPerms: ControlPerms = {
      mouse: true, keyboard: true, clipboard: true, fileTransfer: true,
      ...perms,
    };
    if (ch?.readyState === 'open') {
      ch.send(JSON.stringify({ type: 'control-grant', perms: fullPerms }));
      grantedPermsRef.current = fullPerms;
      setControlGranted(true);
      setControlPerms(fullPerms);
    }
  }, []);

  /** Host: revoke all viewer control */
  const revokeControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
    setControlGranted(false);
  }, []);

  /** Viewer: send a mouse/keyboard event to the host */
  const sendControlEvent = useCallback((action: ControlAction) => {
    const ch = controlChannelRef.current;
    if (!ch || ch.readyState !== 'open' || !controlGrantedRef.current) return;
    const perms = controlPermsRef.current;
    if (action.type === 'keydown' || action.type === 'keyup') {
      if (!perms.keyboard) return;
    } else if (action.type === 'mousemove' || action.type === 'mousedown' || action.type === 'mouseup' || action.type === 'click' || action.type === 'scroll') {
      if (!perms.mouse) return;
    }
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
    setConnectionQuality(null);
    setPendingViewer(null);
    setIsWaitingForHost(false);
    sessionEstablishedRef.current = false;
    stopQualityPolling();
    peer.close();
    cryptoRef.current  = null;
    keyPairRef.current = null;
  }, [stopQualityPolling]);

  // ── Helper: host initiates connection after accepting viewer ──────────────

  const waitForSignalingStable = useCallback((): Promise<void> => new Promise((resolve) => {
    if (!peer.peer || peer.peer.signalingState === 'stable') { resolve(); return; }
    const timeout = setTimeout(resolve, 5000);
    const check = () => {
      if (!peer.peer || peer.peer.signalingState === 'stable') {
        clearTimeout(timeout);
        peer.peer?.removeEventListener('signalingstatechange', check);
        resolve();
      }
    };
    peer.peer?.addEventListener('signalingstatechange', check);
  }), []);

  const _initiateConnection = useCallback(async (viewerSocketId: string) => {
    if (!peer.peer || !socketRef.current) return;

    // Create ALL data channels here (only on initiator/host side)
    const chatCh = peer.peer.createDataChannel('chat',          { ordered: true });
    const ctrlCh = peer.peer.createDataChannel('control',       { ordered: true });
    const fileCh = peer.peer.createDataChannel('file-transfer', { ordered: true, maxRetransmits: 30 });
    const clipCh = peer.peer.createDataChannel('clipboard',     { ordered: true });
    attachChatChannel(chatCh);
    attachControlChannel(ctrlCh);
    attachFileChannel(fileCh);
    attachClipboardChannel(clipCh);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
        // @ts-ignore — Chromium-only: request system audio in non-Electron browsers
        systemAudio: 'include',
      } as any);
      setMyStream(stream);
      const vid = stream.getVideoTracks()[0];
      const aud = stream.getAudioTracks()[0];
      console.log('[host] screen share tracks — video:', !!vid, ', audio:', !!aud);
      if (vid) {
        peer.addTrack(vid, stream, SCREEN_VIDEO);
        vid.addEventListener('ended', () => {
          setMyStream(null);
          peer.removeTrack(SCREEN_VIDEO);
          peer.removeTrack(SCREEN_AUDIO);
        });
      }
      if (aud) {
        peer.addTrack(aud, stream, SCREEN_AUDIO);
        console.log('[host] system audio track added successfully');
      } else {
        console.warn('[host] No audio track in screen share stream — system audio not captured');
      }
    } catch (err: any) {
      // Screen share denied — still proceed so data channels open
      console.warn('[host] screen share not granted:', err.message);
    }

    // Create offer (includes data channels ± media tracks)
    const offer = await peer.getOffer();
    if (offer) {
      socketRef.current.emit('call-user', {
        userToCall: viewerSocketId,
        from: socketRef.current.id,
        signalData: offer,
      });
    }
  }, [attachChatChannel, attachControlChannel, attachFileChannel, attachClipboardChannel]);

  // ── Main socket + WebRTC effect ───────────────────────────────────────────

  useEffect(() => {
    peer.reset();

    // [BRAVE FIX] polling first — Brave Shields block the WebSocket initial
    // connection. By starting with polling (HTTP long-poll) we get a stable
    // connection, then upgrade to WebSocket when possible.
    // With ['websocket','polling'] (old order), Brave gets a connect_error and
    // retries infinitely because WSS never succeeds.
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,                   // attempt WS upgrade after polling connects
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });
    socketRef.current = socket;

    // ── RTCPeerConnection handlers ────────────────────────────────────────────

    if (peer.peer) {
      let firstVideoStreamId: string | null = null;

      peer.peer.ontrack = (ev) => {
        const track  = ev.track;
        const stream = ev.streams[0] || new MediaStream([track]);
        console.log('[ontrack]', track.kind, stream.id);

        if (track.kind === 'video') {
          if (!firstVideoStreamId) {
            firstVideoStreamId = stream.id;
            setRemoteStream(stream);
          } else if (stream.id !== firstVideoStreamId) {
            setRemoteCallStream(stream);
          }
        } else {
          if (!firstVideoStreamId || stream.id === firstVideoStreamId) {
            setRemoteStream(prev => {
              if (!prev) return stream;
              if (!prev.getTrackById(track.id)) return new MediaStream([...prev.getTracks(), track]);
              return prev;
            });
          } else {
            setRemoteCallStream(prev => {
              if (!prev) return stream;
              if (!prev.getTrackById(track.id)) return new MediaStream([...prev.getTracks(), track]);
              return prev;
            });
          }
        }
      };

      peer.peer.onicecandidate = (ev) => {
        if (ev.candidate && peerSocketIdRef.current) {
          socket.emit('ice-candidate', { target: peerSocketIdRef.current, candidate: ev.candidate });
        }
      };

      peer.peer.oniceconnectionstatechange = () => {
        const s = peer.peer?.iceConnectionState;
        console.log('[ICE]', s);
        if (s === 'connected' || s === 'completed') {
          setStatus('Connected');
          sessionEstablishedRef.current = true;
          startQualityPolling();
        }
        if (s === 'failed' || s === 'disconnected') setStatus('Disconnected');
      };

      // Receiver side: data channels sent by the initiator (host)
      peer.peer.ondatachannel = (ev) => {
        console.log('[datachannel]', ev.channel.label);
        if (ev.channel.label === 'chat')           attachChatChannel(ev.channel);
        if (ev.channel.label === 'control')        attachControlChannel(ev.channel);
        if (ev.channel.label === 'file-transfer')  attachFileChannel(ev.channel);
        if (ev.channel.label === 'clipboard')      attachClipboardChannel(ev.channel);
      };
    }

    // ── Socket events ─────────────────────────────────────────────────────────

    socket.on('connect', () => {
      console.log('[socket] connected:', socket.id);
      setStatus('Connected');
      socket.emit('join-room', myId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnect:', reason);
      setStatus('Disconnected');
    });

    socket.on('connect_error', (e) => {
      console.error('[socket] connect_error:', e.message);
      setStatus('Disconnected');
    });

    socket.on('reconnect', () => {
      socket.emit('join-room', myId);
    });

    socket.on('room-full', () => {
      alert('This room is already full — only 2 peers per session.');
    });

    // HOST: a viewer joined → don't auto-proceed. Show accept/decline modal.
    socket.on('user-connected', (viewerSocketId: string) => {
      console.log('[host] viewer joined:', viewerSocketId);
      peerSocketIdRef.current = viewerSocketId;
      isHostRef.current = true;
      setIsHost(true);

      const viewer: PendingViewer = { socketId: viewerSocketId, joinedAt: Date.now() };
      setPendingViewer(viewer);
      pendingViewerRef.current = viewer;

      // Tell viewer they're waiting (prevents viewer from seeing just "Disconnected")
      socket.emit('viewer-pending-ack', { to: viewerSocketId });

      // Callback lets SessionPage show the accept/decline modal
      onConnectionReqRef.current?.(viewer);
    });

    // VIEWER: host confirmed the request is pending (show "waiting for host" UI)
    socket.on('waiting-for-host', () => {
      console.log('[viewer] waiting for host to accept');
      setIsWaitingForHost(true);
    });

    // VIEWER: host declined the connection
    socket.on('connection-rejected', () => {
      console.log('[viewer] connection rejected');
      setIsWaitingForHost(false);
      setStatus('Disconnected');
      alert('The host declined your connection request.');
      setTimeout(() => onSessionEndedRef.current?.(), 200);
    });

    // VIEWER: initial screen-share offer, or renegotiation (e.g. after AV call ends).
    // Only assign viewer role on the first offer — renegotiation must not flip isHost.
    socket.on('incoming-call', async ({ from, signal }) => {
      console.log('[viewer] incoming-call from', from, 'established:', sessionEstablishedRef.current);
      peerSocketIdRef.current = from;
      if (!sessionEstablishedRef.current) {
        isHostRef.current = false;
        setIsHost(false);
        setIsWaitingForHost(false);
      }

      const answer = await peer.getAnswer(signal);
      if (answer) {
        sessionEstablishedRef.current = true;
        socket.emit('answer-call', { to: from, signal: answer });
      }
    });

    // Callee: incoming AV call offer (peer started video/audio call)
    socket.on('incoming-av-call', async ({ from, signal, withVideo }) => {
      console.log('[incoming-av-call] from', from, 'video:', withVideo);
      peerSocketIdRef.current = from;
      if (!callStreamRef.current) {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: withVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          });
        } catch {
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); } catch {}
        }
        if (stream) {
          setCallStream(stream); setInCall(true);
          const mic = stream.getAudioTracks()[0];
          const cam = stream.getVideoTracks()[0];
          if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
          if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);
        }
      } else {
        setInCall(true);
      }
      const answer = await peer.getAnswer(signal);
      if (answer) socket.emit('answer-call', { to: from, signal: answer });
    });

    // HOST/VIEWER: answer received
    socket.on('call-accepted', async (data) => {
      try {
        await peer.setRemoteDescription(data?.signal ?? data);
        sessionEstablishedRef.current = true;
      } catch (e) { console.error('[peer] setRemoteDescription failed:', e); }
    });

    // ICE candidates
    socket.on('ice-candidate', async ({ candidate }) => {
      if (!peer.peer) return;
      try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[ICE] addIceCandidate failed:', e); }
    });

    // Remote peer ended session
    socket.on('session-ended', () => {
      console.log('[socket] session-ended received');
      _stopMedia();
      setStatus('Disconnected');
      setTimeout(() => onSessionEndedRef.current?.(), 100);
    });

    // Clipboard relay fallback when DataChannel is not ready
    socket.on('clipboard-sync', ({ text }: { text: string }) => {
      if (typeof text === 'string' && text.length > 0) applyClipboardText(text);
    });

    return () => {
      stopQualityPolling();
      // [FIX M5] Only remove app-specific listeners, not Socket.io internal ones
      const appEvents = [
        'connect', 'connection-request', 'connection-accepted',
        'connection-rejected', 'viewer-joined', 'call-user',
        'call-accepted', 'ice-candidate', 'session-ended',
        'av-call-user', 'av-call-accepted', 'hang-up', 'clipboard-sync',
      ];
      appEvents.forEach(evt => socket.off(evt));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    myId,
    attachChatChannel, attachControlChannel, attachFileChannel, attachClipboardChannel,
    applyClipboardText, _stopMedia, startQualityPolling, stopQualityPolling,
  ]);

  // ── Public actions ────────────────────────────────────────────────────────

  const connectToPeer = useCallback((targetId: string) => {
    socketRef.current?.emit('join-room', targetId);
  }, []);

  /** Host: accept an incoming connection request */
  const acceptConnection = useCallback(async () => {
    const viewer = pendingViewerRef.current;
    if (!viewer || !socketRef.current) return;
    setPendingViewer(null);
    socketRef.current.emit('connection-accepted', { to: viewer.socketId });
    await _initiateConnection(viewer.socketId);
  }, [_initiateConnection]);

  /** Host: reject an incoming connection request */
  const rejectConnection = useCallback(() => {
    const viewer = pendingViewerRef.current;
    if (!viewer || !socketRef.current) return;
    setPendingViewer(null);
    socketRef.current.emit('connection-rejected', { to: viewer.socketId });
    peerSocketIdRef.current = null;
    isHostRef.current = false;
    setIsHost(false);
  }, []);

  /** Host: manually start/restart screen share (e.g. if auto-start was denied) */
  const startScreenShare = useCallback(async () => {
    if (!peerSocketIdRef.current) { alert('No viewer connected yet.'); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
        // @ts-ignore — Chromium-only: request system audio in non-Electron browsers
        systemAudio: 'include',
      } as any);
      setMyStream(stream);
      const vid = stream.getVideoTracks()[0];
      const aud = stream.getAudioTracks()[0];
      console.log('[startScreenShare] tracks — video:', !!vid, ', audio:', !!aud);
      if (vid) {
        peer.addTrack(vid, stream, SCREEN_VIDEO);
        vid.addEventListener('ended', () => {
          setMyStream(null);
          peer.removeTrack(SCREEN_VIDEO);
          peer.removeTrack(SCREEN_AUDIO);
        });
      }
      if (aud) {
        peer.addTrack(aud, stream, SCREEN_AUDIO);
        console.log('[startScreenShare] system audio track added');
      } else {
        console.warn('[startScreenShare] No audio track — system audio not captured');
      }
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
      const aud = myStreamRef.current?.getAudioTracks()[0] ?? null;
      if (aud) aud.enabled = next;
      peer.replaceTrack(SCREEN_AUDIO, next ? aud : null);
      return next;
    });
  }, []);

  const startCall = useCallback(async (withVideo = true) => {
    if (!peerSocketIdRef.current || !socketRef.current) {
      alert('No peer connected yet.');
      return;
    }
    if (!sessionEstablishedRef.current) {
      alert('Wait for the remote session to connect before starting a call.');
      return;
    }
    if (callStreamRef.current) {
      console.warn('[startCall] already in call');
      return;
    }

    await waitForSignalingStable();

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: withVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (err) {
      console.warn('[startCall] getUserMedia failed:', err);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        withVideo = false;
      } catch {
        alert('Could not access microphone/camera. Check Windows privacy settings and allow GlyphConnect.');
        return;
      }
    }
    if (!stream) return;
    setCallStream(stream); setInCall(true);
    const mic = stream.getAudioTracks()[0];
    const cam = stream.getVideoTracks()[0];
    if (mic) peer.addTrack(mic, stream, MIC_AUDIO);
    if (cam && withVideo) peer.addTrack(cam, stream, CAM_VIDEO);

    await waitForSignalingStable();
    const offer = await peer.renegotiate();
    if (offer) socketRef.current.emit('av-call-user', {
      userToCall: peerSocketIdRef.current,
      from: socketRef.current.id,
      signalData: offer, withVideo,
    });
  }, [waitForSignalingStable]);

  const endCall = useCallback(async () => {
    if (!callStreamRef.current && !inCall) return;

    callStreamRef.current?.getTracks().forEach(t => t.stop());
    peer.removeTrack(MIC_AUDIO);
    peer.removeTrack(CAM_VIDEO);
    setCallStream(null); setRemoteCallStream(null); setInCall(false);

    if (!peerSocketIdRef.current || !socketRef.current?.connected || !sessionEstablishedRef.current) return;

    await waitForSignalingStable();
    const offer = await peer.renegotiate();
    if (offer) {
      socketRef.current.emit('call-user', {
        userToCall: peerSocketIdRef.current,
        from: socketRef.current.id,
        signalData: offer,
      });
    }
  }, [inCall, waitForSignalingStable]);

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => { const next = !prev; const t = callStreamRef.current?.getAudioTracks()[0]; if (t) t.enabled = next; return next; });
  }, []);

  const toggleCam = useCallback(() => {
    setCamEnabled(prev => { const next = !prev; const t = callStreamRef.current?.getVideoTracks()[0]; if (t) t.enabled = next; return next; });
  }, []);

  /** End session: emit hang-up to remote then clean up locally */
  const stopAllTracks = useCallback(() => {
    if (peerSocketIdRef.current && socketRef.current?.connected) {
      socketRef.current.emit('hang-up', { to: peerSocketIdRef.current });
    }
    _stopMedia();
  }, [_stopMedia]);

  return {
    connectionStatus: status,
    connectToPeer,
    // Screen share
    myStream, remoteStream,
    startScreenShare, stopScreenShare,
    screenAudioEnabled, toggleScreenAudio,
    // AV call
    callStream, remoteCallStream,
    inCall, startCall, endCall,
    micEnabled, toggleMic,
    camEnabled, toggleCam,
    // Chat
    messages, sendChatMessage, cryptoReady,
    // Roles
    isHost,
    // Remote control
    controlGranted, controlPerms,
    grantControl, revokeControl, sendControlEvent,
    // File transfer
    sendFileChunk,
    // Session control
    stopAllTracks,
    // New features
    connectionQuality,    // RTCPeerConnection.getStats() data
    pendingViewer,        // set when viewer joins, cleared after accept/reject
    acceptConnection,     // host: proceed with connection
    rejectConnection,     // host: decline connection
    isWaitingForHost,     // viewer: true while waiting for host to accept
    syncClipboard,        // send local clipboard content to peer
  };
};
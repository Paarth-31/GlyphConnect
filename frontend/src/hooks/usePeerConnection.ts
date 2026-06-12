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
  key?: string; code?: string; scrollX?: number; scrollY?: number;
  ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean;
}

export interface ControlPerms {
  mouse: boolean;
  keyboard: boolean;
  clipboard: boolean;
  fileTransfer: boolean;
}

export interface ConnectionQuality {
  rttMs: number;
  bitrateKbps: number;
  packetLossPct: number;
  fps: number;
}

export interface PendingViewer {
  socketId: string;
  joinedAt: number;
}

type ControlMsg =
  | ControlAction
  | { type: 'control-grant'; perms: ControlPerms }
  | { type: 'control-revoke' }
  | { type: 'clipboard-sync'; text: string };

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

  const revokeControl = useCallback(() => {
    const ch = controlChannelRef.current;
    if (ch?.readyState === 'open') ch.send(JSON.stringify({ type: 'control-revoke' }));
    setControlGranted(false);
  }, []);

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
      console.warn('[host] screen share not granted:', err.message);
    }

    const offer = await peer.getOffer();
    if (offer) {
      socketRef.current.emit('call-user', {
        userToCall: viewerSocketId,
        from: socketRef.current.id,
        signalData: offer,
      });
    }
  }, [attachChatChannel, attachControlChannel, attachFileChannel, attachClipboardChannel]);

  useEffect(() => {
    peer.reset();

    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
    });
    socketRef.current = socket;

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

      peer.peer.ondatachannel = (ev) => {
        console.log('[datachannel]', ev.channel.label);
        if (ev.channel.label === 'chat')           attachChatChannel(ev.channel);
        if (ev.channel.label === 'control')        attachControlChannel(ev.channel);
        if (ev.channel.label === 'file-transfer')  attachFileChannel(ev.channel);
        if (ev.channel.label === 'clipboard')      attachClipboardChannel(ev.channel);
      };
    }

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

    socket.on('user-connected', (viewerSocketId: string) => {
      console.log('[host] viewer joined:', viewerSocketId);
      peerSocketIdRef.current = viewerSocketId;
      isHostRef.current = true;
      setIsHost(true);

      const viewer: PendingViewer = { socketId: viewerSocketId, joinedAt: Date.now() };
      setPendingViewer(viewer);
      pendingViewerRef.current = viewer;
      socket.emit('viewer-pending-ack', { to: viewerSocketId });
      onConnectionReqRef.current?.(viewer);
    });

    socket.on('waiting-for-host', () => {
      console.log('[viewer] waiting for host to accept');
      setIsWaitingForHost(true);
    });

    socket.on('connection-rejected', () => {
      console.log('[viewer] connection rejected');
      setIsWaitingForHost(false);
      setStatus('Disconnected');
      alert('The host declined your connection request.');
      setTimeout(() => onSessionEndedRef.current?.(), 200);
    });

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

    socket.on('call-accepted', async (data) => {
      try {
        await peer.setRemoteDescription(data?.signal ?? data);
        sessionEstablishedRef.current = true;
      } catch (e) { console.error('[peer] setRemoteDescription failed:', e); }
    });

    socket.on('ice-candidate', async ({ candidate }) => {
      if (!peer.peer) return;
      try { await peer.peer.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('[ICE] addIceCandidate failed:', e); }
    });

    socket.on('session-ended', () => {
      console.log('[socket] session-ended received');
      _stopMedia();
      setStatus('Disconnected');
      setTimeout(() => onSessionEndedRef.current?.(), 100);
    });

    socket.on('clipboard-sync', ({ text }: { text: string }) => {
      if (typeof text === 'string' && text.length > 0) applyClipboardText(text);
    });

    return () => {
      stopQualityPolling();
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

  const connectToPeer = useCallback((targetId: string) => {
    socketRef.current?.emit('join-room', targetId);
  }, []);

  const acceptConnection = useCallback(async () => {
    const viewer = pendingViewerRef.current;
    if (!viewer || !socketRef.current) return;
    setPendingViewer(null);
    socketRef.current.emit('connection-accepted', { to: viewer.socketId });
    await _initiateConnection(viewer.socketId);
  }, [_initiateConnection]);

  const rejectConnection = useCallback(() => {
    const viewer = pendingViewerRef.current;
    if (!viewer || !socketRef.current) return;
    setPendingViewer(null);
    socketRef.current.emit('connection-rejected', { to: viewer.socketId });
    peerSocketIdRef.current = null;
    isHostRef.current = false;
    setIsHost(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!peerSocketIdRef.current) { alert('No viewer connected yet.'); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: true,
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

  const stopAllTracks = useCallback(() => {
    if (peerSocketIdRef.current && socketRef.current?.connected) {
      socketRef.current.emit('hang-up', { to: peerSocketIdRef.current });
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
    controlGranted, controlPerms,
    grantControl, revokeControl, sendControlEvent,
    sendFileChunk,
    stopAllTracks,
    connectionQuality,
    pendingViewer,
    acceptConnection,
    rejectConnection,
    isWaitingForHost,
    syncClipboard,
  };
};
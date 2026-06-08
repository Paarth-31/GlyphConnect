// // class PeerService {
// //   public peer: RTCPeerConnection | null = null;
// //   public chatChannel: RTCDataChannel | null = null;
// //   public fileChannel: RTCDataChannel | null = null;

// //   private static CHUNK_SIZE = 16 * 1024; // 16KB per chunk
// //   // Track all senders so we can swap tracks without full renegotiation
// //   private senders: Map<string, RTCRtpSender> = new Map();

// //   constructor() {
// //     this.reset();
// //   }

// //   reset() {
// //     if (this.peer) {
// //       this.peer.close();
// //       this.peer = null;
// //       this.chatChannel = null;
// //       this.fileChannel = null;
// //     }
// //     this.senders.clear();
// //     this.peer = new RTCPeerConnection({
// //       iceServers: [
// //         {
// //           urls: 'turns:rda-turnserver.duckdns.org:5349',
// //           username: 'rda',
// //           credential: 'rda123',
// //         },
// //       ],
// //     });

// //     // File transfer channel — binary, ordered delivery
// //     this.fileChannel = this.peer.createDataChannel('file-transfer', {
// //       ordered: true,        // files must arrive in order
// //       maxRetransmits: 30,   // retry dropped packets
// //     });
// //     this.fileChannel.binaryType = 'arraybuffer';
// //   }

// //   // Called on the RECEIVING side when peer creates a channel
// //   setupIncomingChannels(
// //     onChat: (msg: any) => void,
// //     onFileChunk: (data: ArrayBuffer | string) => void
// //   ) {
// //     if (!this.peer) return;
// //     this.peer.ondatachannel = (event) => {
// //       const channel = event.channel;
// //       if (channel.label === 'file-transfer') {
// //         channel.binaryType = 'arraybuffer';
// //         this.fileChannel = channel;
// //         channel.onmessage = (e) => onFileChunk(e.data);
// //       }
// //       if (channel.label === 'chat') {
// //         this.chatChannel = channel;
// //         channel.onmessage = (e) => onChat(JSON.parse(e.data));
// //       }
// //     };
// //   }

// //   // Send a file in chunks
// //   async sendFile(
// //     file: File,
// //     onProgress: (percent: number) => void
// //   ): Promise<void> {
// //     if (!this.fileChannel || this.fileChannel.readyState !== 'open') {
// //       throw new Error('File channel not open');
// //     }

// //     const totalChunks = Math.ceil(file.size / PeerService.CHUNK_SIZE);

// //     // 1. Send metadata first as JSON string
// //     const metadata = JSON.stringify({
// //       type: 'file-meta',
// //       name: file.name,
// //       size: file.size,
// //       mimeType: file.type,
// //       totalChunks,
// //     });
// //     this.fileChannel.send(metadata);

// //     // 2. Read and send chunks
// //     const arrayBuffer = await file.arrayBuffer();
// //     let chunkIndex = 0;

// //     const sendNextChunk = () => {
// //       return new Promise<void>((resolve) => {
// //         const sendChunk = () => {
// //           // Respect buffer limits — pause if buffer is getting full
// //           if (this.fileChannel!.bufferedAmount > 5 * 1024 * 1024) {
// //             setTimeout(sendChunk, 100);
// //             return;
// //           }

// //           if (chunkIndex >= totalChunks) {
// //             // Send completion signal
// //             this.fileChannel!.send(JSON.stringify({ type: 'file-complete' }));
// //             onProgress(100);
// //             resolve();
// //             return;
// //           }

// //           const start = chunkIndex * PeerService.CHUNK_SIZE;
// //           const end = Math.min(start + PeerService.CHUNK_SIZE, file.size);
// //           const chunk = arrayBuffer.slice(start, end);

// //           this.fileChannel!.send(chunk);
// //           chunkIndex++;
// //           onProgress(Math.round((chunkIndex / totalChunks) * 100));
// //           setTimeout(sendChunk, 0); // yield to event loop between chunks
// //         };
// //         sendChunk();
// //       });
// //     };

// //     await sendNextChunk();
// //   }

// //   // ── Add a track and remember its sender by a label ───────────────────────
// //   addTrack(track: MediaStreamTrack, stream: MediaStream, label?: string): RTCRtpSender {
// //     const sender = this.peer!.addTrack(track, stream);
// //     const key = label ?? `${track.kind}-${track.id}`;
// //     this.senders.set(key, sender);
// //     return sender;
// //   }

// //   // ── Replace a track on an existing sender (no full renegotiation needed) ─
// //   async replaceTrack(label: string, newTrack: MediaStreamTrack | null): Promise<boolean> {
// //     const sender = this.senders.get(label);
// //     if (!sender) return false;
// //     await sender.replaceTrack(newTrack);
// //     return true;
// //   }

// //   // ── Remove a sender entirely (requires renegotiation) ───────────────────
// //   removeTrack(label: string) {
// //     const sender = this.senders.get(label);
// //     if (sender && this.peer) {
// //       this.peer.removeTrack(sender);
// //       this.senders.delete(label);
// //     }
// //   }

// //   getSender(label: string): RTCRtpSender | undefined {
// //     return this.senders.get(label);
// //   }

// //   async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
// //     if (!this.peer) return;
// //     const offer = await this.peer.createOffer();
// //     await this.peer.setLocalDescription(new RTCSessionDescription(offer));
// //     return offer;
// //   }

// //   async getAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | undefined> {
// //     if (!this.peer) return;
// //     await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
// //     const answer = await this.peer.createAnswer();
// //     await this.peer.setLocalDescription(new RTCSessionDescription(answer));
// //     return answer;
// //   }

// //   async setRemoteDescription(ans: RTCSessionDescriptionInit) {
// //     if (!this.peer) return;
// //     await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
// //   }

// //   close() {
// //     if (this.peer) {
// //       this.peer.close();
// //       this.peer = null;
// //     }
// //     this.senders.clear();
// //   }
// // }

// // export default new PeerService();


// // frontend/src/services/peer.ts

// class PeerService {
//   public peer: RTCPeerConnection | null = null;
//   public chatChannel: RTCDataChannel | null = null;
//   public fileChannel: RTCDataChannel | null = null;

//   private static CHUNK_SIZE = 16 * 1024; // 16 KB per chunk
//   private senders: Map<string, RTCRtpSender> = new Map();

//   constructor() {
//     // Do NOT call reset() here — ICE servers aren't known yet at construction
//     // time. usePeerConnection calls reset(iceServers) explicitly on mount.
//   }

//   // [FIX A] accepts iceServers; [FIX C] no data channel created here
//   reset(iceServers?: RTCIceServer[]) {
//     if (this.peer) {
//       this.peer.close();
//       this.peer = null;
//       this.chatChannel = null;
//       this.fileChannel = null;
//     }
//     this.senders.clear();

//     const servers: RTCIceServer[] = iceServers ?? [
//       { urls: 'stun:stun.l.google.com:19302' },
//     ];

//     this.peer = new RTCPeerConnection({ iceServers: servers });
//     // [FIX C] NO data channels created here. The initiator creates them in
//     // usePeerConnection after 'user-connected' fires. The receiver receives
//     // them via ondatachannel.
//   }

//   // Called on the RECEIVING side when peer creates a channel
//   setupIncomingChannels(
//     onChat: (msg: any) => void,
//     onFileChunk: (data: ArrayBuffer | string) => void
//   ) {
//     if (!this.peer) return;
//     this.peer.ondatachannel = (event) => {
//       const channel = event.channel;
//       if (channel.label === 'file-transfer') {
//         channel.binaryType = 'arraybuffer';
//         this.fileChannel = channel;
//         channel.onmessage = (e) => onFileChunk(e.data);
//       }
//       if (channel.label === 'chat') {
//         this.chatChannel = channel;
//         channel.onmessage = (e) => onChat(JSON.parse(e.data));
//       }
//     };
//   }

//   // Send a file in chunks over the file-transfer data channel
//   async sendFile(
//     file: File,
//     onProgress: (percent: number) => void
//   ): Promise<void> {
//     if (!this.fileChannel || this.fileChannel.readyState !== 'open') {
//       throw new Error('File channel not open');
//     }

//     const totalChunks = Math.ceil(file.size / PeerService.CHUNK_SIZE);

//     const metadata = JSON.stringify({
//       type: 'file-meta',
//       name: file.name,
//       size: file.size,
//       mimeType: file.type,
//       totalChunks,
//     });
//     this.fileChannel.send(metadata);

//     const arrayBuffer = await file.arrayBuffer();
//     let chunkIndex = 0;

//     const sendNextChunk = () => {
//       return new Promise<void>((resolve) => {
//         const sendChunk = () => {
//           if (this.fileChannel!.bufferedAmount > 5 * 1024 * 1024) {
//             setTimeout(sendChunk, 100);
//             return;
//           }

//           if (chunkIndex >= totalChunks) {
//             this.fileChannel!.send(JSON.stringify({ type: 'file-complete' }));
//             onProgress(100);
//             resolve();
//             return;
//           }

//           const start = chunkIndex * PeerService.CHUNK_SIZE;
//           const end   = Math.min(start + PeerService.CHUNK_SIZE, file.size);
//           const chunk = arrayBuffer.slice(start, end);

//           this.fileChannel!.send(chunk);
//           chunkIndex++;
//           onProgress(Math.round((chunkIndex / totalChunks) * 100));
//           setTimeout(sendChunk, 0);
//         };
//         sendChunk();
//       });
//     };

//     await sendNextChunk();
//   }

//   addTrack(track: MediaStreamTrack, stream: MediaStream, label?: string): RTCRtpSender {
//     const sender = this.peer!.addTrack(track, stream);
//     const key = label ?? `${track.kind}-${track.id}`;
//     this.senders.set(key, sender);
//     return sender;
//   }

//   async replaceTrack(label: string, newTrack: MediaStreamTrack | null): Promise<boolean> {
//     const sender = this.senders.get(label);
//     if (!sender) return false;
//     await sender.replaceTrack(newTrack);
//     return true;
//   }

//   removeTrack(label: string) {
//     const sender = this.senders.get(label);
//     if (sender && this.peer) {
//       this.peer.removeTrack(sender);
//       this.senders.delete(label);
//     }
//   }

//   getSender(label: string): RTCRtpSender | undefined {
//     return this.senders.get(label);
//   }

//   async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
//     if (!this.peer) return;
//     const offer = await this.peer.createOffer();
//     await this.peer.setLocalDescription(new RTCSessionDescription(offer));
//     return offer;
//   }

//   async getAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | undefined> {
//     if (!this.peer) return;
//     await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
//     const answer = await this.peer.createAnswer();
//     await this.peer.setLocalDescription(new RTCSessionDescription(answer));
//     return answer;
//   }

//   async setRemoteDescription(ans: RTCSessionDescriptionInit) {
//     if (!this.peer) return;
//     await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
//   }

//   close() {
//     if (this.peer) {
//       this.peer.close();
//       this.peer = null;
//     }
//     this.senders.clear();
//     this.chatChannel = null;
//     this.fileChannel = null;
//   }
// }

// export default new PeerService();




// frontend/src/services/peer.ts
//
// ROOT CAUSE FIXED HERE:
// The original constructor called reset(), which created an RTCPeerConnection
// AND a 'file-transfer' DataChannel. Then usePeerConnection's user-connected
// handler created chat + control + ANOTHER file-transfer channel. Having two
// DataChannels with the same label confuses the browser's SDP negotiation —
// the receiver's ondatachannel fires twice for 'file-transfer', the second
// overwrites the first, and both chat and file channels end up in a broken
// state. This is why chat always said "Waiting for peer" and file transfer
// silently failed.
//
// ALSO FIXED: ICE servers now include STUN fallbacks so the connection works
// when the TURN server is unreachable or slow.

export const ICE_SERVERS: RTCIceServer[] = [
  // STUN (public, free — for direct P2P or as fallback)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // TURN — try UDP first (fastest), then TCP, then TLS
  {
    urls: [
      'turn:rda-turnserver.duckdns.org:3478',
      'turn:rda-turnserver.duckdns.org:3478?transport=tcp',
      'turns:rda-turnserver.duckdns.org:5349',
    ],
    username: 'rda',
    credential: 'rda123',
  },
];

class PeerService {
  public peer: RTCPeerConnection | null = null;
  private senders: Map<string, RTCRtpSender> = new Map();

  constructor() {
    // Do NOT call reset() here.
    // usePeerConnection calls reset() explicitly inside the effect
    // so it can attach all handlers before any async events fire.
  }

  // Creates a fresh RTCPeerConnection with STUN+TURN config.
  // Does NOT create any DataChannels — that is the caller's responsibility.
  reset() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    this.senders.clear();

    this.peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  // ── Track management ──────────────────────────────────────────────────────

  addTrack(track: MediaStreamTrack, stream: MediaStream, label: string): RTCRtpSender {
    if (!this.peer) throw new Error('No peer connection');
    const sender = this.peer.addTrack(track, stream);
    this.senders.set(label, sender);
    return sender;
  }

  async replaceTrack(label: string, newTrack: MediaStreamTrack | null): Promise<boolean> {
    const sender = this.senders.get(label);
    if (!sender) return false;
    await sender.replaceTrack(newTrack);
    return true;
  }

  removeTrack(label: string) {
    const sender = this.senders.get(label);
    if (sender && this.peer) {
      try { this.peer.removeTrack(sender); } catch (_) {}
      this.senders.delete(label);
    }
  }

  getSender(label: string): RTCRtpSender | undefined {
    return this.senders.get(label);
  }

  // ── Offer / Answer ────────────────────────────────────────────────────────

  async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
    if (!this.peer) return;
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  }

  /** Renegotiate after adding/removing tracks mid-session (AV calls, screen share). */
  async renegotiate(): Promise<RTCSessionDescriptionInit | undefined> {
    if (!this.peer) return;
    const state = this.peer.signalingState;
    if (state === 'have-local-offer') {
      try {
        await this.peer.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
      } catch {
        return;
      }
    }
    if (this.peer.signalingState === 'have-remote-offer') return;
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  }

  async getAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | undefined> {
    if (!this.peer) return;
    await this.peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(new RTCSessionDescription(answer));
    return answer;
  }

  async setRemoteDescription(ans: RTCSessionDescriptionInit) {
    if (!this.peer) return;
    await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  close() {
    if (this.peer) {
      try { this.peer.close(); } catch (_) {}
      this.peer = null;
    }
    this.senders.clear();
  }
}

export default new PeerService();
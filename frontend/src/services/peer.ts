export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
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

  constructor() {}

  reset() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    this.senders.clear();

    this.peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

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

  async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
    if (!this.peer) return;
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(new RTCSessionDescription(offer));
    return offer;
  }

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

  close() {
    if (this.peer) {
      try { this.peer.close(); } catch (_) {}
      this.peer = null;
    }
    this.senders.clear();
  }
}

export default new PeerService();
import { useRef, useState, useCallback, useEffect } from 'react';

export const useRecording = () => {
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savedPath, setSavedPath]         = useState<string | null>(null);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef   = useRef<AudioContext | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onRecordingSaved) return;
    api.onRecordingSaved(({ filePath }: { filePath: string }) => {
      setSavedPath(filePath);
    });
  }, []);

  const startRecording = useCallback(async (
    myStream: MediaStream | null,
    remoteStream: MediaStream | null,
    sessionId?: string,
  ) => {
    if (!myStream && !remoteStream) {
      alert('Nothing to record — start a screen share or AV call first.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width  = 1920;
    canvas.height = 540;
    const ctx = canvas.getContext('2d')!;

    const toVideoEl = (stream: MediaStream | null): HTMLVideoElement => {
      const v = document.createElement('video');
      v.muted = true; v.autoplay = true; v.playsInline = true;
      if (stream) { v.srcObject = stream; v.play().catch(() => {}); }
      return v;
    };
    const myVid     = toVideoEl(myStream);
    const remoteVid = toVideoEl(remoteStream);

    const drawFrame = () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const both = myStream && remoteStream;
      const w = both ? canvas.width / 2 : canvas.width;

      if (myStream && myVid.readyState >= 2) {
        ctx.drawImage(myVid, 0, 0, w, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, 120, 22);
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
        ctx.fillText('Host Screen', 6, 15);
      }
      if (remoteStream && remoteVid.readyState >= 2) {
        ctx.drawImage(remoteVid, both ? w : 0, 0, w, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(both ? w : 0, 0, 130, 22);
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
        ctx.fillText('Remote Screen', (both ? w : 0) + 6, 15);
      }

      const ts = new Date().toLocaleTimeString();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(canvas.width - 120, canvas.height - 20, 120, 20);
      ctx.fillStyle = '#fff'; ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`⏺ ${ts}`, canvas.width - 6, canvas.height - 6);
      ctx.textAlign = 'left';

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const dest = audioContext.createMediaStreamDestination();

    [myStream, remoteStream].forEach(s => {
      if (!s) return;
      const tracks = s.getAudioTracks();
      if (tracks.length === 0) return;
      const src  = audioContext.createMediaStreamSource(new MediaStream(tracks));
      const gain = audioContext.createGain();
      gain.gain.value = 1.0;
      src.connect(gain); gain.connect(dest);
    });

    const canvasStream = canvas.captureStream(30);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    const mimeType = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=h264,aac',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

    const mr = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 128_000,
    });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      await audioContextRef.current?.close();

      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.saveRecording) {
        const buffer = await blob.arrayBuffer();
        electronAPI.saveRecording(Array.from(new Uint8Array(buffer)), mimeType);
      } else {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        a.href     = url;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `RDA-Recording-${sessionId ? sessionId + '-' : ''}${ts}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };

    mr.start(3000);
    setIsRecording(true);
    setSavedPath(null);

    let secs = 0;
    timerRef.current = setInterval(() => { secs++; setRecordingTime(secs); }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return { startRecording, stopRecording, isRecording, recordingTime, formatTime, savedPath };
};
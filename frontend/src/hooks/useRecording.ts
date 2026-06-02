// frontend/src/hooks/useRecording.ts
//
// [FIX 1] Recording saves to a specific local path:
//   - Electron (desktop): auto-saved to ~/Videos/RDA-Recordings/ with no dialog.
//     Main process fires an IPC "recording-saved" event back with the final path
//     and shows a brief toast notification in the renderer.
//   - Browser (web): falls back to a browser download (same as before).
//
// The hook now also accepts an optional `sessionId` so the filename can include
// session context, and it listens for the `recording-saved` IPC callback to
// show a success toast.

import { useRef, useState, useCallback, useEffect } from 'react';

export const useRecording = () => {
  const [isRecording, setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savedPath, setSavedPath]       = useState<string | null>(null);

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const canvasRef         = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef   = useRef<AudioContext | null>(null);

  // ── [FIX 1] Listen for Electron IPC "recording-saved" confirmation ──────
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onRecordingSaved) return;
    api.onRecordingSaved(({ filePath }: { filePath: string }) => {
      setSavedPath(filePath);
      console.log('[Recording] Saved to:', filePath);
    });
  }, []);

  const startRecording = useCallback(async (
    myStream: MediaStream | null,
    remoteStream: MediaStream | null,
    sessionId?: string
  ) => {
    if (!myStream && !remoteStream) {
      alert('No active streams to record.');
      return;
    }

    // --- 1. Canvas for side-by-side video mixing ---
    const canvas = document.createElement('canvas');
    canvas.width  = 2560;
    canvas.height = 720;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d')!;

    const myVideo = document.createElement('video');
    myVideo.srcObject = myStream;
    myVideo.muted     = true;
    myVideo.autoplay  = true;
    await myVideo.play().catch(() => {});

    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = remoteStream;
    remoteVideo.muted     = true;
    remoteVideo.autoplay  = true;
    await remoteVideo.play().catch(() => {});

    const drawFrame = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Left — my screen
      if (myStream && myVideo.readyState >= 2) {
        ctx.drawImage(myVideo, 0, 0, 1280, 720);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 200, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText('My Screen', 8, 18);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 1280, 720);
        ctx.fillStyle = '#555555';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No local stream', 640, 360);
        ctx.textAlign = 'left';
      }

      // Right — remote screen
      if (remoteStream && remoteVideo.readyState >= 2) {
        ctx.drawImage(remoteVideo, 1280, 0, 1280, 720);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(1280, 0, 220, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px sans-serif';
        ctx.fillText('Remote Screen', 1288, 18);
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(1280, 0, 1280, 720);
        ctx.fillStyle = '#555555';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No remote stream', 1920, 360);
        ctx.textAlign = 'left';
      }

      // Timestamp overlay
      const now = new Date().toLocaleTimeString();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(canvas.width - 160, canvas.height - 28, 160, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`REC • ${now}`, canvas.width - 8, canvas.height - 10);
      ctx.textAlign = 'left';

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // --- 2. Audio mixing ---
    const audioContext  = new AudioContext();
    audioContextRef.current = audioContext;
    const destination  = audioContext.createMediaStreamDestination();

    if (myStream) {
      const tracks = myStream.getAudioTracks();
      if (tracks.length > 0) {
        const src  = audioContext.createMediaStreamSource(new MediaStream(tracks));
        const gain = audioContext.createGain();
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(destination);
      }
    }

    if (remoteStream) {
      const tracks = remoteStream.getAudioTracks();
      if (tracks.length > 0) {
        const src  = audioContext.createMediaStreamSource(new MediaStream(tracks));
        const gain = audioContext.createGain();
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(destination);
      }
    }

    // --- 3. Combine canvas + audio ---
    const canvasStream   = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    // --- 4. MediaRecorder ---
    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 128_000,
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current        = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current)   await audioContextRef.current.close();

      const blob   = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];

      const electronAPI = (window as any).electronAPI;

      if (electronAPI?.saveRecording) {
        // ── [FIX 1] Electron path: send raw bytes to main process.
        //    Main process auto-saves to ~/Videos/RDA-Recordings/ and fires
        //    'recording-saved' IPC back with the final filePath.
        const buffer = await blob.arrayBuffer();
        const uint8  = new Uint8Array(buffer);
        electronAPI.saveRecording(Array.from(uint8), mimeType);
        // No dialog — the file lands in RECORDINGS_DIR automatically.
      } else {
        // ── Browser fallback: trigger a download ──────────────────────────
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        const name = sessionId
          ? `RDA-Recording-${sessionId}-${ts}.webm`
          : `RDA-Recording-${ts}.webm`;
        a.href     = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[Recording] Browser download triggered:', name);
      }
    };

    mediaRecorder.start(5000);
    setIsRecording(true);
    setSavedPath(null);

    let seconds = 0;
    timerRef.current = setInterval(() => {
      seconds++;
      setRecordingTime(seconds);
    }, 1000);

    console.log(`[Recording] Started — codec: ${mimeType}`);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      console.log('[Recording] Stopping…');
    }
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { startRecording, stopRecording, isRecording, recordingTime, formatTime, savedPath };
};

// frontend/src/components/RemoteScreen.tsx
import { useRef, useCallback, useEffect } from 'react';
import { ControlAction } from '../hooks/usePeerConnection';

interface Props {
  stream: MediaStream | null;
  onControlEvent: (action: ControlAction) => void;
  controlEnabled: boolean;
}

export function RemoteScreen({ stream, onControlEvent, controlEnabled }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && stream) node.srcObject = stream;
    },
    [stream]
  );

  useEffect(() => {
    if (controlEnabled) containerRef.current?.focus();
  }, [controlEnabled]);

  const norm = (e: React.MouseEvent) => {
    const rect = videoRef.current!.getBoundingClientRect();
    return {
      normX: (e.clientX - rect.left) / rect.width,
      normY: (e.clientY - rect.top) / rect.height,
    };
  };

  const focusContainer = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!controlEnabled) return;
      onControlEvent({ type: 'mousemove', ...norm(e) });
    },
    [controlEnabled, onControlEvent]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!controlEnabled) return;
      e.preventDefault();
      focusContainer();
      const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
      onControlEvent({ type: 'mousedown', button, ...norm(e) });
    },
    [controlEnabled, onControlEvent, focusContainer]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!controlEnabled) return;
      const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
      onControlEvent({ type: 'mouseup', button, ...norm(e) });
    },
    [controlEnabled, onControlEvent]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!controlEnabled) return;
      e.preventDefault();
      onControlEvent({
        type: 'scroll',
        scrollX: Math.round(e.deltaX),
        scrollY: Math.round(e.deltaY),
      });
    },
    [controlEnabled, onControlEvent]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!controlEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      onControlEvent({ type: 'keydown', key: e.key, code: e.code });
    },
    [controlEnabled, onControlEvent]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (!controlEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      onControlEvent({ type: 'keyup', key: e.key, code: e.code });
    },
    [controlEnabled, onControlEvent]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseDown={focusContainer}
      style={{ cursor: controlEnabled ? 'none' : 'default' }}
    >
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain bg-black"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {controlEnabled && (
        <div className="absolute top-3 right-3 bg-blue-600/80 text-white text-xs px-2 py-1 rounded">
          Control active — click here then type
        </div>
      )}
    </div>
  );
}

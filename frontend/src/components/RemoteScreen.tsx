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
  const onControlRef = useRef(onControlEvent);
  onControlRef.current = onControlEvent;

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && stream) node.srcObject = stream;
    },
    [stream]
  );

  const norm = (e: React.MouseEvent) => {
    const rect = videoRef.current!.getBoundingClientRect();
    return {
      normX: (e.clientX - rect.left) / rect.width,
      normY: (e.clientY - rect.top) / rect.height,
    };
  };

  const focusContainer = useCallback(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const isLocalEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return !!target.closest('[data-local-input]');
  };

  useEffect(() => {
    if (!controlEnabled) return;

    const sendKey = (type: 'keydown' | 'keyup', e: KeyboardEvent) => {
      if (isLocalEditableTarget(e.target)) return;
      if (e.repeat && type === 'keydown') return;
      e.preventDefault();
      e.stopPropagation();
      onControlRef.current({
        type,
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
      });
    };

    const onKeyDown = (e: KeyboardEvent) => sendKey('keydown', e);
    const onKeyUp = (e: KeyboardEvent) => sendKey('keyup', e);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    focusContainer();

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [controlEnabled, focusContainer]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full outline-none"
      tabIndex={0}
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
        <div className="absolute top-3 right-3 bg-blue-600/80 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Control active — type to send keystrokes
        </div>
      )}
    </div>
  );
}

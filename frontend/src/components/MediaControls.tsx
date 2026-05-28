// frontend/src/components/MediaControls.tsx
//import { useRef } from 'react';

interface Props {
  inCall: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  screenAudioEnabled: boolean;
  onStartCall: (withVideo: boolean) => void;
  onEndCall: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenAudio: () => void;
  isHost: boolean; // host = the machine being shared; controller = the viewer
}

export function MediaControls({
  inCall,
  micEnabled,
  camEnabled,
  screenAudioEnabled,
  onStartCall,
  onEndCall,
  onToggleMic,
  onToggleCam,
  onToggleScreenAudio,
  isHost,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-xl">

      {/* Screen audio toggle — only relevant on host side */}
      {isHost && (
        <button
          onClick={onToggleScreenAudio}
          title="Toggle system audio"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
            screenAudioEnabled
              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              : 'bg-gray-800/60 border-white/10 text-gray-500 line-through'
          }`}
        >
          {screenAudioEnabled ? '🔊' : '🔇'} System audio
        </button>
      )}

      {/* AV call controls */}
      {!inCall ? (
        <>
          <button
            onClick={() => onStartCall(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 transition-all"
          >
            📹 Start video call
          </button>
          <button
            onClick={() => onStartCall(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600/10 border border-green-500/20 text-green-500 hover:bg-green-600/20 transition-all"
          >
            🎙 Audio only
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onToggleMic}
            title="Toggle microphone"
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              micEnabled
                ? 'bg-green-600/20 border-green-500/40 text-green-400'
                : 'bg-red-600/20 border-red-500/40 text-red-400'
            }`}
          >
            {micEnabled ? '🎙 Mic on' : '🔇 Mic off'}
          </button>

          <button
            onClick={onToggleCam}
            title="Toggle camera"
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
              camEnabled
                ? 'bg-green-600/20 border-green-500/40 text-green-400'
                : 'bg-red-600/20 border-red-500/40 text-red-400'
            }`}
          >
            {camEnabled ? '📹 Cam on' : '📷 Cam off'}
          </button>

          <button
            onClick={onEndCall}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 transition-all"
          >
            ✕ End call
          </button>
        </>
      )}
    </div>
  );
}
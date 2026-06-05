// // import { useState, useRef, useEffect, useCallback } from 'react';
// // import {
// //   Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
// //   Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
// //   Radio, Square, MousePointer2, ChevronLeft,
// //   Maximize2, Minimize2, GripVertical, Circle, X,
// //   Settings2, ShieldCheck, ShieldOff, Lock, Unlock,
// // } from 'lucide-react';
// // import { ChatPanel }         from '../components/ChatPanel';
// // import { FileTransferPanel } from '../components/FileTransferPanel';
// // import { RemoteScreen }      from '../components/RemoteScreen';
// // import { usePeerConnection } from '../hooks/usePeerConnection';
// // import { useRecording }      from '../hooks/useRecording';
// // import { useFileTransfer }   from '../hooks/useFileTransfer';

// // interface Props {
// //   myId: string;
// //   remoteId: string;
// //   isHostInitial: boolean;
// //   onEnd: () => void;
// // }

// // type SidePanel = 'chat' | 'files' | null;

// // export function SessionPage({ myId, remoteId, isHostInitial, onEnd }: Props) {
// //   const [sidePanel, setSidePanel]           = useState<SidePanel>(null);
// //   const [sidePanelWidth, setSidePanelWidth] = useState(320);
// //   const [isResizingSide, setIsResizingSide] = useState(false);
// //   const [sessionTime, setSessionTime]       = useState(0);
// //   const [isFullscreen, setIsFullscreen]     = useState(false);
// //   const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
// //   const [camSize, setCamSize] = useState({ w: 240, h: 135 });

// //   // [FIX 6] Settings modal state
// //   const [showSettings, setShowSettings] = useState(false);
// //   const [videoQuality, setVideoQuality] = useState<'720p' | '1080p' | '480p'>('720p');

// //   // [FIX 6] Access controls modal state (host only)
// //   const [showAccessControls, setShowAccessControls] = useState(false);

// //   // [FIX 1] Recording saved path toast
// //   const [recordingSavedPath, setRecordingSavedPath] = useState<string | null>(null);

// //   const camDragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
// //   const fileChunkRef = useRef<((d: ArrayBuffer | string) => void) | null>(null);
// //   const containerRef = useRef<HTMLDivElement>(null);
// //   const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

// //   const {
// //     connectionStatus,
// //     connectToPeer,
// //     myStream, remoteStream,
// //     startScreenShare, stopScreenShare,
// //     screenAudioEnabled, toggleScreenAudio,
// //     callStream, remoteCallStream,
// //     inCall, startCall, endCall,
// //     micEnabled, toggleMic,
// //     camEnabled, toggleCam,
// //     messages, sendChatMessage, cryptoReady,
// //     controlGranted, grantControl, revokeControl, sendControlEvent,
// //     sendFileChunk,
// //     stopAllTracks,
// //   } = usePeerConnection(myId, remoteId, (d) => fileChunkRef.current?.(d));

// //   const {
// //     startRecording, stopRecording,
// //     isRecording, recordingTime, formatTime, savedPath,
// //   } = useRecording();

// //   const {
// //     sendFile, handleFileChunk, incomingFile, receivedFiles,
// //     outgoing, receiveProgress, downloadFile, formatSize,
// //   } = useFileTransfer(sendFileChunk);
// //   fileChunkRef.current = handleFileChunk;

// //   // Show recording-saved toast
// //   useEffect(() => {
// //     if (savedPath) {
// //       setRecordingSavedPath(savedPath);
// //       const t = setTimeout(() => setRecordingSavedPath(null), 5000);
// //       return () => clearTimeout(t);
// //     }
// //   }, [savedPath]);

// //   // Session timer
// //   useEffect(() => {
// //     timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
// //     return () => { if (timerRef.current) clearInterval(timerRef.current); };
// //   }, []);

// //   // Viewer connects to host room
// //   useEffect(() => {
// //     if (remoteId) connectToPeer(remoteId);
// //   }, []); // eslint-disable-line react-hooks/exhaustive-deps

// //   // Fullscreen API
// //   const toggleFullscreen = useCallback(() => {
// //     if (!document.fullscreenElement) {
// //       containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
// //     } else {
// //       document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
// //     }
// //   }, []);
// //   useEffect(() => {
// //     const h = () => setIsFullscreen(!!document.fullscreenElement);
// //     document.addEventListener('fullscreenchange', h);
// //     return () => document.removeEventListener('fullscreenchange', h);
// //   }, []);

// //   // Video ref callbacks
// //   const myVideoRef = useCallback((n: HTMLVideoElement | null) => {
// //     if (n && myStream) n.srcObject = myStream;
// //   }, [myStream]);
// //   const callVideoRef = useCallback((n: HTMLVideoElement | null) => {
// //     if (n && callStream) n.srcObject = callStream;
// //   }, [callStream]);
// //   const remoteCallVideoRef = useCallback((n: HTMLVideoElement | null) => {
// //     if (n && remoteCallStream) n.srcObject = remoteCallStream;
// //   }, [remoteCallStream]);

// //   // Side panel resize
// //   const startSideResize = (e: React.MouseEvent) => {
// //     e.preventDefault();
// //     setIsResizingSide(true);
// //     const x0 = e.clientX, w0 = sidePanelWidth;
// //     const onMove = (ev: MouseEvent) => setSidePanelWidth(Math.max(260, Math.min(520, w0 + (x0 - ev.clientX))));
// //     const onUp   = () => { setIsResizingSide(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
// //     window.addEventListener('mousemove', onMove);
// //     window.addEventListener('mouseup', onUp);
// //   };

// //   // Webcam PiP drag
// //   const startCamDrag = (e: React.MouseEvent) => {
// //     e.preventDefault();
// //     camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
// //     const onMove = (ev: MouseEvent) => setCamPos({ x: camDragStart.current.px + ev.clientX - camDragStart.current.mx, y: camDragStart.current.py + ev.clientY - camDragStart.current.my });
// //     const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
// //     window.addEventListener('mousemove', onMove);
// //     window.addEventListener('mouseup', onUp);
// //   };

// //   // [FIX 3] End session — stops tracks on both sides via hang-up signal
// //   const handleEndSession = useCallback(() => {
// //     if (isRecording) stopRecording();
// //     stopAllTracks();
// //     onEnd();
// //   }, [isRecording, stopRecording, stopAllTracks, onEnd]);

// //   const fmtTime = (s: number) => {
// //     const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
// //     return h > 0
// //       ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
// //       : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// //   };

// //   const sessionActive = myStream || remoteStream;
// //   const isHost        = isHostInitial;

// //   return (
// //     <div
// //       ref={containerRef}
// //       className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none"
// //       style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
// //     >
// //       {/* ── Top bar ── */}
// //       <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">
// //         <div className="flex items-center gap-4">
// //           <button onClick={handleEndSession} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors">
// //             <ChevronLeft className="w-3.5 h-3.5" /> Back
// //           </button>
// //           <div className="w-px h-4 bg-white/10" />
// //           <div className="flex items-center gap-2">
// //             <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'Connected' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
// //             <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
// //           </div>
// //           <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md">{fmtTime(sessionTime)}</div>
// //           {isRecording && (
// //             <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
// //               <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
// //               REC {formatTime(recordingTime)}
// //             </div>
// //           )}
// //         </div>

// //         <div className="flex items-center gap-2">
// //           <Monitor className="w-3.5 h-3.5 text-white/30" />
// //           <span className="text-xs font-mono text-white/40">
// //             {remoteId ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}` : 'Host Mode'}
// //           </span>
// //           {isHost  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">HOST</span>}
// //           {!isHost && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-bold">VIEWER</span>}
// //         </div>

// //         <div className="flex items-center gap-1">
// //           <button onClick={() => setSidePanel(p => p === 'chat' ? null : 'chat')} className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
// //             <MessageSquare className="w-4 h-4" />
// //             {messages.some(m => m.from === 'them') && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
// //           </button>
// //           <button onClick={() => setSidePanel(p => p === 'files' ? null : 'files')} className={`p-2 rounded-lg transition-all ${sidePanel === 'files' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
// //             <Files className="w-4 h-4" />
// //           </button>
// //           <button onClick={toggleFullscreen} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
// //             {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
// //           </button>
// //           <button onClick={handleEndSession} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all ml-2">
// //             <PhoneOff className="w-3.5 h-3.5" /> End
// //           </button>
// //         </div>
// //       </div>

// //       {/* ── Main workspace ── */}
// //       <div className="flex flex-1 overflow-hidden">

// //         {/* Video area */}
// //         <div className="flex-1 relative bg-[#050506] overflow-hidden">
// //           {sessionActive ? (
// //             <>
// //               <div className="absolute inset-0">
// //                 {/* [FIX 2] Viewer sees remote; host sees own preview */}
// //                 {remoteStream && !isHost ? (
// //                   <RemoteScreen
// //                     stream={remoteStream}
// //                     onControlEvent={sendControlEvent}
// //                     controlEnabled={controlGranted}
// //                   />
// //                 ) : myStream ? (
// //                   <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
// //                 ) : remoteStream ? (
// //                   <RemoteScreen stream={remoteStream} onControlEvent={() => {}} controlEnabled={false} />
// //                 ) : null}
// //               </div>

// //               {/* Webcam PiP */}
// //               {(callStream || remoteCallStream) && (
// //                 <div
// //                   className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/60 cursor-move"
// //                   style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
// //                   onMouseDown={startCamDrag}
// //                 >
// //                   <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
// //                     <GripVertical className="w-3 h-3 text-white/40" />
// //                     <span className="text-[9px] text-white/40">{remoteCallStream ? 'Remote' : 'You'}</span>
// //                   </div>
// //                   {remoteCallStream
// //                     ? <video ref={remoteCallVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
// //                     : <video ref={callVideoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black" />
// //                   }
// //                   <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
// //                     onMouseDown={e => {
// //                       e.stopPropagation(); e.preventDefault();
// //                       const sx = e.clientX, sy = e.clientY, sw = camSize.w, sh = camSize.h;
// //                       const mv = (ev: MouseEvent) => setCamSize({ w: Math.max(160, sw + ev.clientX - sx), h: Math.max(90, sh + ev.clientY - sy) });
// //                       const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
// //                       window.addEventListener('mousemove', mv);
// //                       window.addEventListener('mouseup', up);
// //                     }}>
// //                     <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/30 rounded-br-sm" />
// //                   </div>
// //                 </div>
// //               )}

// //               {/* Control active banner (viewer) */}
// //               {controlGranted && !isHost && (
// //                 <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg">
// //                   <MousePointer2 className="w-3.5 h-3.5" /> Control Active
// //                 </div>
// //               )}
// //             </>
// //           ) : (
// //             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
// //               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
// //                 <Monitor className="w-8 h-8 text-white/20" />
// //               </div>
// //               <div className="text-center">
// //                 <p className="text-white/40 text-sm font-medium">
// //                   {connectionStatus === 'Connected'
// //                     ? (isHost ? 'Viewer connected — start sharing below' : 'Waiting for host to share screen…')
// //                     : 'Connecting…'}
// //                 </p>
// //                 <p className="text-white/20 text-xs mt-1">
// //                   {isHost ? 'Click "Share Screen" in the toolbar' : `Host ID: ${remoteId}`}
// //                 </p>
// //               </div>
// //               {isHost && (
// //                 <button
// //                   onClick={startScreenShare}
// //                   className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
// //                 >
// //                   <Monitor className="w-4 h-4" /> Share My Screen
// //                 </button>
// //               )}
// //             </div>
// //           )}
// //         </div>

// //         {/* Side panel resize handle */}
// //         {sidePanel && (
// //           <div
// //             className={`w-1 cursor-col-resize bg-white/[0.04] hover:bg-indigo-500/40 transition-colors relative flex items-center justify-center group ${isResizingSide ? 'bg-indigo-500/40' : ''}`}
// //             onMouseDown={startSideResize}
// //           >
// //             <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400" />
// //           </div>
// //         )}

// //         {/* Side panel */}
// //         {sidePanel && (
// //           <div className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0" style={{ width: sidePanelWidth }}>
// //             <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
// //               <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
// //                 {([
// //                   { id: 'chat'  as SidePanel, icon: MessageSquare, label: 'Chat'  },
// //                   { id: 'files' as SidePanel, icon: Files,         label: 'Files' },
// //                 ] as const).map(tab => (
// //                   <button
// //                     key={tab.id!}
// //                     onClick={() => setSidePanel(tab.id)}
// //                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
// //                   >
// //                     <tab.icon className="w-3.5 h-3.5" />{tab.label}
// //                   </button>
// //                 ))}
// //               </div>
// //               <button onClick={() => setSidePanel(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5">
// //                 <X className="w-3.5 h-3.5" />
// //               </button>
// //             </div>
// //             <div className="flex-1 overflow-hidden">
// //               {sidePanel === 'chat' && (
// //                 <div className="h-full bg-[#0d0d0f]">
// //                   <ChatPanel messages={messages} onSend={sendChatMessage} cryptoReady={cryptoReady} />
// //                 </div>
// //               )}
// //               {sidePanel === 'files' && (
// //                 <div className="p-3 h-full overflow-y-auto">
// //                   <FileTransferPanel
// //                     onSendFile={sendFile}
// //                     receivedFiles={receivedFiles}
// //                     outgoing={outgoing}
// //                     incomingFile={incomingFile}
// //                     receiveProgress={receiveProgress}
// //                     onDownload={downloadFile}
// //                     formatSize={formatSize}
// //                   />
// //                 </div>
// //               )}
// //             </div>
// //           </div>
// //         )}
// //       </div>

// //       {/* ── Bottom toolbar ── */}
// //       <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">

// //         {/* Left: screen + control (host) | control status (viewer) */}
// //         <div className="flex items-center gap-2">
// //           {isHost && (
// //             <>
// //               <ToolbarBtn
// //                 icon={myStream ? Monitor : MonitorOff}
// //                 label={myStream ? 'Sharing' : 'Share Screen'}
// //                 active={!!myStream}
// //                 activeColor="indigo"
// //                 onClick={myStream ? stopScreenShare : startScreenShare}
// //               />
// //               <ToolbarBtn
// //                 icon={screenAudioEnabled ? Volume2 : VolumeX}
// //                 label="Sys Audio"
// //                 active={screenAudioEnabled}
// //                 activeColor="blue"
// //                 onClick={toggleScreenAudio}
// //               />
// //               {/* [FIX 6] Access Controls button — opens modal */}
// //               <ToolbarBtn
// //                 icon={controlGranted ? ShieldOff : ShieldCheck}
// //                 label={controlGranted ? 'Revoke Ctrl' : 'Grant Ctrl'}
// //                 active={controlGranted}
// //                 activeColor="indigo"
// //                 onClick={() => setShowAccessControls(true)}
// //               />
// //             </>
// //           )}
// //           {!isHost && (
// //             <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border ${controlGranted ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-white/[0.04] text-white/35 border-white/[0.06]'}`}>
// //               <MousePointer2 className="w-4 h-4" />
// //               <span>{controlGranted ? 'Control On' : 'No Control'}</span>
// //             </div>
// //           )}
// //         </div>

// //         {/* Center: AV call */}
// //         <div className="flex items-center gap-2">
// //           {!inCall ? (
// //             <>
// //               <ToolbarBtn icon={Video} label="Video Call"  onClick={() => startCall(true)}  activeColor="green" />
// //               <ToolbarBtn icon={Mic}   label="Audio Call"  onClick={() => startCall(false)} activeColor="green" />
// //             </>
// //           ) : (
// //             <>
// //               <ToolbarBtn icon={micEnabled ? Mic : MicOff}     label={micEnabled ? 'Mute'   : 'Unmute'}  active={micEnabled}  activeColor="green" onClick={toggleMic} />
// //               <ToolbarBtn icon={camEnabled ? Video : VideoOff}  label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  activeColor="green" onClick={toggleCam} />
// //               <ToolbarBtn icon={PhoneOff} label="End Call" danger onClick={endCall} />
// //             </>
// //           )}
// //         </div>

// //         {/* Right: recording + settings */}
// //         <div className="flex items-center gap-2">
// //           <ToolbarBtn
// //             icon={isRecording ? Square : Radio}
// //             label={isRecording ? `Stop (${formatTime(recordingTime)})` : 'Record'}
// //             active={isRecording}
// //             activeColor="red"
// //             onClick={() => isRecording ? stopRecording() : startRecording(myStream, remoteStream)}
// //           />
// //           {/* [FIX 6] Settings button — opens modal */}
// //           <ToolbarBtn icon={Settings2} label="Settings" onClick={() => setShowSettings(true)} />
// //         </div>
// //       </div>

// //       {/* ── [FIX 1] Recording saved toast ── */}
// //       {recordingSavedPath && (
// //         <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-lg backdrop-blur">
// //           <Radio className="w-3.5 h-3.5" />
// //           Recording saved to: <span className="font-mono text-emerald-400 max-w-[280px] truncate">{recordingSavedPath}</span>
// //           <button onClick={() => setRecordingSavedPath(null)} className="ml-1 text-white/30 hover:text-white/70">
// //             <X className="w-3.5 h-3.5" />
// //           </button>
// //         </div>
// //       )}

// //       {/* ── [FIX 6] Settings modal ── */}
// //       {showSettings && (
// //         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
// //           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
// //             <div className="flex items-center justify-between mb-5">
// //               <h2 className="text-white font-bold text-base flex items-center gap-2">
// //                 <Settings2 className="w-4 h-4 text-white/50" /> Session Settings
// //               </h2>
// //               <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
// //                 <X className="w-4 h-4" />
// //               </button>
// //             </div>

// //             <div className="space-y-4">
// //               <div>
// //                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Video Quality</p>
// //                 <div className="flex gap-2">
// //                   {(['480p', '720p', '1080p'] as const).map(q => (
// //                     <button
// //                       key={q}
// //                       onClick={() => setVideoQuality(q)}
// //                       className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${videoQuality === q ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
// //                     >
// //                       {q}
// //                     </button>
// //                   ))}
// //                 </div>
// //                 <p className="text-[10px] text-white/25 mt-1.5">Lower quality uses less bandwidth and CPU.</p>
// //               </div>

// //               <div>
// //                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">System Audio</p>
// //                 <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
// //                   <span className="text-sm text-white/70">Include system audio in share</span>
// //                   <button
// //                     onClick={toggleScreenAudio}
// //                     className={`w-10 h-5 rounded-full transition-all relative ${screenAudioEnabled ? 'bg-indigo-500' : 'bg-white/15'}`}
// //                   >
// //                     <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${screenAudioEnabled ? 'left-5' : 'left-0.5'}`} />
// //                   </button>
// //                 </div>
// //               </div>

// //               <div>
// //                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Recording</p>
// //                 <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
// //                   <p className="text-[11px] text-white/40 leading-relaxed">
// //                     Recordings are saved automatically to{' '}
// //                     <span className="font-mono text-white/60">~/Videos/RDA-Recordings/</span> on the host machine.
// //                   </p>
// //                 </div>
// //               </div>
// //             </div>

// //             <button
// //               onClick={() => setShowSettings(false)}
// //               className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
// //             >
// //               Done
// //             </button>
// //           </div>
// //         </div>
// //       )}

// //       {/* ── [FIX 6] Access Controls modal (host only) ── */}
// //       {showAccessControls && isHost && (
// //         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
// //           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
// //             <div className="flex items-center justify-between mb-5">
// //               <h2 className="text-white font-bold text-base flex items-center gap-2">
// //                 <ShieldCheck className="w-4 h-4 text-white/50" /> Access Controls
// //               </h2>
// //               <button onClick={() => setShowAccessControls(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
// //                 <X className="w-4 h-4" />
// //               </button>
// //             </div>

// //             <div className="space-y-3">
// //               {/* Remote Control */}
// //               <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
// //                 <div className="flex items-center gap-3">
// //                   <MousePointer2 className="w-4 h-4 text-white/40" />
// //                   <div>
// //                     <p className="text-sm font-semibold text-white/80">Remote Control</p>
// //                     <p className="text-[11px] text-white/30">Allow viewer to control mouse & keyboard</p>
// //                   </div>
// //                 </div>
// //                 <button
// //                   onClick={controlGranted ? revokeControl : grantControl}
// //                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${controlGranted
// //                     ? 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25'
// //                     : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
// //                   }`}
// //                 >
// //                   {controlGranted ? <><Unlock className="w-3 h-3" /> Revoke</> : <><Lock className="w-3 h-3" /> Grant</>}
// //                 </button>
// //               </div>

// //               {/* Status summary */}
// //               <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
// //                 <p className="text-[11px] text-white/40 leading-relaxed">
// //                   {controlGranted
// //                     ? '⚡ Viewer has control. They can move the mouse and type on this machine. Click Revoke to take it back.'
// //                     : '🔒 Viewer is in view-only mode. Grant control to let them interact with this machine.'}
// //                 </p>
// //               </div>
// //             </div>

// //             <button
// //               onClick={() => setShowAccessControls(false)}
// //               className="mt-5 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all"
// //             >
// //               Close
// //             </button>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // // ── Toolbar button ─────────────────────────────────────────────────────────

// // interface TBProps {
// //   icon: React.ElementType;
// //   label: string;
// //   active?: boolean;
// //   activeColor?: 'indigo' | 'green' | 'blue' | 'red';
// //   danger?: boolean;
// //   onClick?: () => void;
// // }

// // function ToolbarBtn({ icon: Icon, label, active, activeColor = 'indigo', danger, onClick }: TBProps) {
// //   const colors = {
// //     indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
// //     green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
// //     blue:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
// //     red:    'bg-red-500/15 text-red-300 border-red-500/25',
// //   };
// //   return (
// //     <button
// //       onClick={onClick}
// //       title={label}
// //       className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all min-w-[56px] ${
// //         danger
// //           ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
// //           : active
// //           ? colors[activeColor]
// //           : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
// //       }`}
// //     >
// //       <Icon className="w-4 h-4" />
// //       <span className="whitespace-nowrap">{label}</span>
// //     </button>
// //   );
// // }




// import { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
//   Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
//   Radio, Square, MousePointer2, ChevronLeft,
//   Maximize2, Minimize2, GripVertical, Circle, X,
//   Settings2, ShieldCheck, Lock, Unlock, AlertCircle,
// } from 'lucide-react';
// import { ChatPanel }         from '../components/ChatPanel';
// import { FileTransferPanel } from '../components/FileTransferPanel';
// import { RemoteScreen }      from '../components/RemoteScreen';
// import { usePeerConnection } from '../hooks/usePeerConnection';
// import { useRecording }      from '../hooks/useRecording';
// import { useFileTransfer }   from '../hooks/useFileTransfer';

// interface Props {
//   myId: string;
//   remoteId: string;
//   isHostInitial: boolean;
//   onEnd: () => void;
// }

// type SidePanel = 'chat' | 'files' | null;

// export function SessionPage({ myId, remoteId,onEnd }: Props) {
//   const [sidePanel, setSidePanel]           = useState<SidePanel>(null);
//   const [sidePanelWidth, setSidePanelWidth] = useState(320);
//   const [isResizingSide, setIsResizingSide] = useState(false);
//   const [sessionTime, setSessionTime]       = useState(0);
//   const [isFullscreen, setIsFullscreen]     = useState(false);
//   const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
//   const [camSize, setCamSize] = useState({ w: 240, h: 135 });
//   const [showSettings, setShowSettings]         = useState(false);
//   const [showAccessControls, setShowAccessControls] = useState(false);
//   const [videoQuality, setVideoQuality]         = useState<'480p' | '720p' | '1080p'>('720p');
//   const [recordingSavedPath, setRecordingSavedPath] = useState<string | null>(null);
//   const [endingSession, setEndingSession]       = useState(false);

//   const camDragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });
//   const fileChunkRef  = useRef<((d: ArrayBuffer | string) => void) | null>(null);
//   const containerRef  = useRef<HTMLDivElement>(null);
//   const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
//   const myVideoRef    = useRef<HTMLVideoElement | null>(null);
//   const callVideoRef  = useRef<HTMLVideoElement | null>(null);
//   const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);

//   // ── onSessionEnded: called when REMOTE peer ends the session ─────────────
//   // This is the fix for Issue #1: the remote side navigates home automatically
//   const handleRemoteSessionEnd = useCallback(() => {
//     console.log('[Session] Remote ended session — going home');
//     onEnd();
//   }, [onEnd]);

//   const {
//     connectionStatus,
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
//   } = usePeerConnection(myId, remoteId, (d) => fileChunkRef.current?.(d), handleRemoteSessionEnd);

//   const {
//     startRecording, stopRecording,
//     isRecording, recordingTime, formatTime, savedPath,
//   } = useRecording();

//   const {
//     sendFile, handleFileChunk, incomingFile, receivedFiles,
//     outgoing, receiveProgress, downloadFile, formatSize,
//   } = useFileTransfer(sendFileChunk);
//   fileChunkRef.current = handleFileChunk;

//   // Recording saved toast
//   useEffect(() => {
//     if (savedPath) {
//       setRecordingSavedPath(savedPath);
//       const t = setTimeout(() => setRecordingSavedPath(null), 6000);
//       return () => clearTimeout(t);
//     }
//   }, [savedPath]);

//   // Session timer
//   useEffect(() => {
//     timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
//     return () => { if (timerRef.current) clearInterval(timerRef.current); };
//   }, []);

//   // Viewer joins host room
//   useEffect(() => {
//     if (remoteId) connectToPeer(remoteId);
//   }, []); // eslint-disable-line

//   // Fullscreen
//   const toggleFullscreen = useCallback(() => {
//     if (!document.fullscreenElement) {
//       containerRef.current?.requestFullscreen().catch(() => {});
//     } else {
//       document.exitFullscreen().catch(() => {});
//     }
//   }, []);
//   useEffect(() => {
//     const h = () => setIsFullscreen(!!document.fullscreenElement);
//     document.addEventListener('fullscreenchange', h);
//     return () => document.removeEventListener('fullscreenchange', h);
//   }, []);

//   // Wire video elements to streams
//   useEffect(() => {
//     if (myVideoRef.current && myStream) myVideoRef.current.srcObject = myStream;
//   }, [myStream]);
//   useEffect(() => {
//     if (callVideoRef.current && callStream) callVideoRef.current.srcObject = callStream;
//   }, [callStream]);
//   useEffect(() => {
//     if (remoteCallVideoRef.current && remoteCallStream)
//       remoteCallVideoRef.current.srcObject = remoteCallStream;
//   }, [remoteCallStream]);

//   // Side panel resize
//   const startSideResize = (e: React.MouseEvent) => {
//     e.preventDefault();
//     setIsResizingSide(true);
//     const x0 = e.clientX, w0 = sidePanelWidth;
//     const onMove = (ev: MouseEvent) =>
//       setSidePanelWidth(Math.max(260, Math.min(520, w0 + (x0 - ev.clientX))));
//     const onUp = () => {
//       setIsResizingSide(false);
//       window.removeEventListener('mousemove', onMove);
//       window.removeEventListener('mouseup', onUp);
//     };
//     window.addEventListener('mousemove', onMove);
//     window.addEventListener('mouseup', onUp);
//   };

//   // PiP cam drag
//   const startCamDrag = (e: React.MouseEvent) => {
//     e.preventDefault();
//     camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
//     const onMove = (ev: MouseEvent) => setCamPos({
//       x: camDragStart.current.px + ev.clientX - camDragStart.current.mx,
//       y: camDragStart.current.py + ev.clientY - camDragStart.current.my,
//     });
//     const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
//     window.addEventListener('mousemove', onMove);
//     window.addEventListener('mouseup', onUp);
//   };

//   // ── End session (local button click) ────────────────────────────────────
//   // stopAllTracks() emits 'hang-up' to remote → remote gets 'session-ended' →
//   // handleRemoteSessionEnd() → onEnd(). We also call onEnd() locally.
//   const handleEndSession = useCallback(() => {
//     if (endingSession) return;
//     setEndingSession(true);
//     if (isRecording) stopRecording();
//     stopAllTracks();
//     onEnd();
//   }, [endingSession, isRecording, stopRecording, stopAllTracks, onEnd]);

//   const fmtTime = (s: number) => {
//     const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
//     return h > 0
//       ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
//       : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
//   };

//   const sessionActive = !!(myStream || remoteStream);

//   return (
//     <div
//       ref={containerRef}
//       className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none"
//       style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
//     >
//       {/* ── Top bar ────────────────────────────────────────────────────────── */}
//       <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">
//         <div className="flex items-center gap-4">
//           <button onClick={handleEndSession}
//             className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors">
//             <ChevronLeft className="w-3.5 h-3.5" /> Back
//           </button>
//           <div className="w-px h-4 bg-white/10" />
//           <div className="flex items-center gap-2">
//             <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'Connected'
//               ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
//             <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
//           </div>
//           <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
//             {fmtTime(sessionTime)}
//           </div>
//           {isRecording && (
//             <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
//               <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
//               REC {formatTime(recordingTime)}
//             </div>
//           )}
//         </div>

//         <div className="flex items-center gap-2">
//           <Monitor className="w-3.5 h-3.5 text-white/30" />
//           <span className="text-xs font-mono text-white/40">
//             {remoteId
//               ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}`
//               : 'Host Mode'}
//           </span>
//           {isHost
//             ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">HOST</span>
//             : <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-bold">VIEWER</span>}
//         </div>

//         <div className="flex items-center gap-1">
//           <button
//             onClick={() => setSidePanel(p => p === 'chat' ? null : 'chat')}
//             className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
//             <MessageSquare className="w-4 h-4" />
//             {messages.some(m => m.from === 'them') && (
//               <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
//             )}
//           </button>
//           <button
//             onClick={() => setSidePanel(p => p === 'files' ? null : 'files')}
//             className={`p-2 rounded-lg transition-all ${sidePanel === 'files' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
//             <Files className="w-4 h-4" />
//           </button>
//           <button onClick={toggleFullscreen}
//             className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
//             {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
//           </button>
//           <button onClick={handleEndSession}
//             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all ml-2">
//             <PhoneOff className="w-3.5 h-3.5" /> End Session
//           </button>
//         </div>
//       </div>

//       {/* ── Main workspace ──────────────────────────────────────────────────── */}
//       <div className="flex flex-1 overflow-hidden">

//         {/* Video area */}
//         <div className="flex-1 relative bg-[#050506] overflow-hidden">
//           {sessionActive ? (
//             <>
//               <div className="absolute inset-0">
//                 {/* VIEWER sees remote screen and can send control events */}
//                 {remoteStream && !isHost ? (
//                   <RemoteScreen
//                     stream={remoteStream}
//                     onControlEvent={sendControlEvent}
//                     controlEnabled={controlGranted}
//                   />
//                 ) : myStream ? (
//                   /* HOST sees their own screen preview */
//                   <video
//                     ref={myVideoRef}
//                     autoPlay playsInline muted
//                     className="w-full h-full object-contain bg-black"
//                   />
//                 ) : remoteStream ? (
//                   <RemoteScreen stream={remoteStream} onControlEvent={() => {}} controlEnabled={false} />
//                 ) : null}
//               </div>

//               {/* ── PiP camera window (shown during AV call) ── */}
//               {(callStream || remoteCallStream) && (
//                 <div
//                   className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-move"
//                   style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
//                   onMouseDown={startCamDrag}
//                 >
//                   <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
//                     <GripVertical className="w-3 h-3 text-white/40" />
//                     <span className="text-[9px] text-white/40">
//                       {remoteCallStream && callStream ? 'Split' : remoteCallStream ? 'Remote Cam' : 'Your Cam'}
//                     </span>
//                   </div>

//                   {/* Show both local and remote cameras side by side if both exist */}
//                   <div className="w-full h-full flex">
//                     {callStream && (
//                       <video
//                         ref={callVideoRef}
//                         autoPlay playsInline muted
//                         className={`object-cover bg-black ${remoteCallStream ? 'w-1/2' : 'w-full'} h-full`}
//                       />
//                     )}
//                     {remoteCallStream && (
//                       <video
//                         ref={remoteCallVideoRef}
//                         autoPlay playsInline
//                         className={`object-cover bg-black ${callStream ? 'w-1/2' : 'w-full'} h-full`}
//                       />
//                     )}
//                   </div>

//                   {/* Resize handle */}
//                   <div
//                     className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end"
//                     onMouseDown={e => {
//                       e.stopPropagation(); e.preventDefault();
//                       const sx = e.clientX, sy = e.clientY, sw = camSize.w, sh = camSize.h;
//                       const mv = (ev: MouseEvent) => setCamSize({ w: Math.max(160, sw + ev.clientX - sx), h: Math.max(90, sh + ev.clientY - sy) });
//                       const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
//                       window.addEventListener('mousemove', mv);
//                       window.addEventListener('mouseup', up);
//                     }}>
//                     <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white/30 rounded-br-sm mb-1 mr-1" />
//                   </div>
//                 </div>
//               )}

//               {/* Control active banner — shown on VIEWER when granted control */}
//               {controlGranted && !isHost && (
//                 <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg pointer-events-none">
//                   <MousePointer2 className="w-3.5 h-3.5" /> Remote Control Active
//                 </div>
//               )}
//             </>
//           ) : (
//             /* No active streams yet */
//             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
//               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
//                 <Monitor className="w-8 h-8 text-white/20" />
//               </div>
//               <div className="text-center">
//                 <p className="text-white/40 text-sm font-medium">
//                   {connectionStatus === 'Connected'
//                     ? (isHost ? 'Viewer connected — starting screen share…' : 'Waiting for host to share screen…')
//                     : 'Connecting to signaling server…'}
//                 </p>
//                 <p className="text-white/20 text-xs mt-1">
//                   {isHost ? 'You will be prompted to share your screen' : `Host ID: ${remoteId}`}
//                 </p>
//               </div>
//               {isHost && connectionStatus === 'Connected' && (
//                 <button onClick={startScreenShare}
//                   className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
//                   <Monitor className="w-4 h-4" /> Share My Screen
//                 </button>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Resize handle for side panel */}
//         {sidePanel && (
//           <div
//             className={`w-1 cursor-col-resize bg-white/[0.04] hover:bg-indigo-500/40 transition-colors flex items-center justify-center group ${isResizingSide ? 'bg-indigo-500/40' : ''}`}
//             onMouseDown={startSideResize}>
//             <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400" />
//           </div>
//         )}

//         {/* Side panel */}
//         {sidePanel && (
//           <div className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0"
//             style={{ width: sidePanelWidth }}>
//             <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
//               <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
//                 {([
//                   { id: 'chat'  as SidePanel, icon: MessageSquare, label: 'Chat'  },
//                   { id: 'files' as SidePanel, icon: Files,         label: 'Files' },
//                 ] as const).map(tab => (
//                   <button key={tab.id!} onClick={() => setSidePanel(tab.id)}
//                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
//                     <tab.icon className="w-3.5 h-3.5" />{tab.label}
//                   </button>
//                 ))}
//               </div>
//               <button onClick={() => setSidePanel(null)}
//                 className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5">
//                 <X className="w-3.5 h-3.5" />
//               </button>
//             </div>
//             <div className="flex-1 overflow-hidden">
//               {sidePanel === 'chat' && (
//                 <div className="h-full"><ChatPanel messages={messages} onSend={sendChatMessage} cryptoReady={cryptoReady} /></div>
//               )}
//               {sidePanel === 'files' && (
//                 <div className="p-3 h-full overflow-y-auto">
//                   <FileTransferPanel
//                     onSendFile={sendFile} receivedFiles={receivedFiles}
//                     outgoing={outgoing} incomingFile={incomingFile}
//                     receiveProgress={receiveProgress} onDownload={downloadFile} formatSize={formatSize}
//                   />
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>

//       {/* ── Bottom toolbar ──────────────────────────────────────────────────── */}
//       <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">

//         {/* Left: Screen share controls (HOST) | control status badge (VIEWER) */}
//         <div className="flex items-center gap-2">
//           {isHost ? (
//             <>
//               <TBtn
//                 icon={myStream ? Monitor : MonitorOff}
//                 label={myStream ? 'Sharing' : 'Share Screen'}
//                 active={!!myStream}
//                 color="indigo"
//                 onClick={myStream ? stopScreenShare : startScreenShare}
//               />
//               <TBtn
//                 icon={screenAudioEnabled ? Volume2 : VolumeX}
//                 label="Sys Audio"
//                 active={screenAudioEnabled}
//                 color="blue"
//                 onClick={toggleScreenAudio}
//               />
//               {/* Access Controls button — opens modal where host can grant/revoke */}
//               <TBtn
//                 icon={ShieldCheck}
//                 label="Access"
//                 color="indigo"
//                 onClick={() => setShowAccessControls(true)}
//               />
//             </>
//           ) : (
//             /* VIEWER: shows control status */
//             <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border
//               ${controlGranted
//                 ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
//                 : 'bg-white/[0.04] text-white/35 border-white/[0.06]'}`}>
//               <MousePointer2 className="w-4 h-4" />
//               <span>{controlGranted ? 'Control On' : 'View Only'}</span>
//             </div>
//           )}
//         </div>

//         {/* Center: AV call buttons */}
//         <div className="flex items-center gap-2">
//           {!inCall ? (
//             <>
//               <TBtn icon={Video} label="Video Call" onClick={() => startCall(true)}  color="green" />
//               <TBtn icon={Mic}   label="Audio Call" onClick={() => startCall(false)} color="green" />
//             </>
//           ) : (
//             <>
//               <TBtn icon={micEnabled ? Mic : MicOff}    label={micEnabled ? 'Mute' : 'Unmute'}      active={micEnabled}  color="green" onClick={toggleMic} />
//               <TBtn icon={camEnabled ? Video : VideoOff} label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  color="green" onClick={toggleCam} />
//               <TBtn icon={PhoneOff} label="End Call" danger onClick={endCall} />
//             </>
//           )}
//         </div>

//         {/* Right: Recording + Settings */}
//         <div className="flex items-center gap-2">
//           <TBtn
//             icon={isRecording ? Square : Radio}
//             label={isRecording ? `Stop ${formatTime(recordingTime)}` : 'Record'}
//             active={isRecording}
//             color="red"
//             onClick={() => {
//               if (isRecording) {
//                 stopRecording();
//               } else {
//                 if (!myStream && !remoteStream) {
//                   alert('Start a screen share session before recording.');
//                   return;
//                 }
//                 startRecording(myStream, remoteStream);
//               }
//             }}
//           />
//           <TBtn icon={Settings2} label="Settings" onClick={() => setShowSettings(true)} />
//         </div>
//       </div>

//       {/* ── Recording saved toast ── */}
//       {recordingSavedPath && (
//         <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-lg backdrop-blur">
//           <Radio className="w-3.5 h-3.5" />
//           Saved: <span className="font-mono text-emerald-400 max-w-xs truncate">{recordingSavedPath}</span>
//           <button onClick={() => setRecordingSavedPath(null)} className="ml-1 opacity-50 hover:opacity-100">
//             <X className="w-3.5 h-3.5" />
//           </button>
//         </div>
//       )}

//       {/* ── Settings modal ── */}
//       {showSettings && (
//         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
//           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
//             <div className="flex items-center justify-between mb-5">
//               <h2 className="text-white font-bold text-base flex items-center gap-2">
//                 <Settings2 className="w-4 h-4 text-white/40" /> Session Settings
//               </h2>
//               <button onClick={() => setShowSettings(false)}
//                 className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             <div className="space-y-4">
//               <div>
//                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Video Quality</p>
//                 <div className="flex gap-2">
//                   {(['480p', '720p', '1080p'] as const).map(q => (
//                     <button key={q} onClick={() => setVideoQuality(q)}
//                       className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${videoQuality === q
//                         ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
//                         : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}>
//                       {q}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//               <div>
//                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">System Audio</p>
//                 <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
//                   <span className="text-sm text-white/70">Include system audio in share</span>
//                   <button onClick={toggleScreenAudio}
//                     className={`w-10 h-5 rounded-full transition-all relative ${screenAudioEnabled ? 'bg-indigo-500' : 'bg-white/15'}`}>
//                     <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${screenAudioEnabled ? 'left-5' : 'left-0.5'}`} />
//                   </button>
//                 </div>
//               </div>
//               <div>
//                 <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Recordings</p>
//                 <div className="px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/40 leading-relaxed">
//                   Auto-saved to <span className="font-mono text-white/60">~/Videos/RDA-Recordings/</span>
//                 </div>
//               </div>
//             </div>
//             <button onClick={() => setShowSettings(false)}
//               className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
//               Done
//             </button>
//           </div>
//         </div>
//       )}

//       {/* ── Access Controls modal (HOST only) ── */}
//       {/* Issue #4: Host grants/revokes control. Viewer receives control-grant  */}
//       {/* message via data channel → controlGranted becomes true → RemoteScreen */}
//       {/* starts forwarding mouse/keyboard events via sendControlEvent.         */}
//       {showAccessControls && isHost && (
//         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
//           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
//             <div className="flex items-center justify-between mb-5">
//               <h2 className="text-white font-bold text-base flex items-center gap-2">
//                 <ShieldCheck className="w-4 h-4 text-white/40" /> Access Controls
//               </h2>
//               <button onClick={() => setShowAccessControls(false)}
//                 className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>

//             <div className="space-y-3">
//               <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
//                 <div className="flex items-center gap-3">
//                   <MousePointer2 className="w-5 h-5 text-white/30" />
//                   <div>
//                     <p className="text-sm font-semibold text-white/80">Remote Control</p>
//                     <p className="text-[11px] text-white/30 mt-0.5">Viewer can control your mouse & keyboard</p>
//                   </div>
//                 </div>
//                 <button
//                   onClick={controlGranted ? revokeControl : grantControl}
//                   className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
//                     controlGranted
//                       ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
//                       : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'
//                   }`}>
//                   {controlGranted
//                     ? <><Unlock className="w-3.5 h-3.5" /> Revoke</>
//                     : <><Lock className="w-3.5 h-3.5" /> Grant</>}
//                 </button>
//               </div>

//               <div className={`px-4 py-3 rounded-xl border text-[11px] leading-relaxed ${
//                 controlGranted
//                   ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300/60'
//                   : 'bg-white/[0.03] border-white/[0.06] text-white/35'}`}>
//                 {controlGranted
//                   ? '✅ Viewer has full control. They can move the mouse and type on your machine. Click Revoke to stop.'
//                   : '🔒 Viewer is in view-only mode. Click Grant to allow them to control this machine.'}
//               </div>

//               {!controlGranted && (
//                 <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-amber-400/70 text-[11px]">
//                   <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
//                   <span>Granting control gives the viewer full keyboard and mouse access. Only grant to trusted users.</span>
//                 </div>
//               )}
//             </div>

//             <button onClick={() => setShowAccessControls(false)}
//               className="mt-5 w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 font-semibold text-sm transition-all border border-white/10">
//               Close
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Toolbar Button ─────────────────────────────────────────────────────────
// interface TBtnProps {
//   icon: React.ElementType;
//   label: string;
//   active?: boolean;
//   color?: 'indigo' | 'green' | 'blue' | 'red';
//   danger?: boolean;
//   onClick?: () => void;
// }

// function TBtn({ icon: Icon, label, active, color = 'indigo', danger, onClick }: TBtnProps) {
//   const colorMap = {
//     indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
//     green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
//     blue:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
//     red:    'bg-red-500/15 text-red-300 border-red-500/25',
//   };
//   return (
//     <button
//       onClick={onClick}
//       title={label}
//       className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all min-w-[56px] ${
//         danger ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
//         : active ? colorMap[color]
//         : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
//       }`}>
//       <Icon className="w-4 h-4" />
//       <span className="whitespace-nowrap">{label}</span>
//     </button>
//   );
// }






// frontend/src/pages/SessionPage.tsx
//
// ADDITIONS IN THIS FILE:
//
// [ACCEPT-MODAL] When a viewer joins, the host sees a full-screen modal:
//   "incoming connection request — Accept / Decline". Uses pendingViewer
//   from usePeerConnection. acceptConnection() / rejectConnection() drive it.
//   Viewer sees a "Waiting for host to accept..." overlay via isWaitingForHost.
//
// [QUALITY-BAR] Top bar shows RTT, bitrate, and FPS from connectionQuality.
//   Values come from RTCPeerConnection.getStats() polled every 2s in the hook.
//
// [RECONNECT-OVERLAY] When connectionStatus flips to 'Disconnected' after the
//   session was active, a "Connection lost" overlay appears with options to
//   go back or wait for auto-reconnect.
//
// [SESSION-DB] sessionsApi.create() is called when the host accepts a viewer
//   (or when the viewer receives the first 'incoming-call'). sessionsApi.end()
//   is called on handleEndSession. This populates Recent Sessions on the Home
//   page. Session IDs are stored in sessionDbId state.
//
// [CLIPBOARD] "Sync Clipboard" button in the bottom toolbar sends local
//   clipboard content to the peer via the clipboard DataChannel.

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
  Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
  Radio, Square, MousePointer2, ChevronLeft,
  Maximize2, Minimize2, GripVertical, Circle, X,
  Settings2, ShieldCheck, Lock, Unlock, AlertCircle,
  Clipboard, Wifi, WifiOff, Clock, Activity,
} from 'lucide-react';
import { ChatPanel }         from '../components/ChatPanel';
import { FileTransferPanel } from '../components/FileTransferPanel';
import { RemoteScreen }      from '../components/RemoteScreen';
import { usePeerConnection, type PendingViewer } from '../hooks/usePeerConnection';
import { useRecording }      from '../hooks/useRecording';
import { useFileTransfer }   from '../hooks/useFileTransfer';
import { sessionsApi }       from '../services/api';
import { useAuth }           from '../auth/AuthProvider';

interface Props {
  myId: string;
  remoteId: string;
  isHostInitial: boolean;
  onEnd: () => void;
}

type SidePanel = 'chat' | 'files' | null;

export function SessionPage({ myId, remoteId, onEnd }: Props) {
  const { isAuthenticated } = useAuth();

  const [sidePanel, setSidePanel]           = useState<SidePanel>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState(320);
  const [isResizingSide, setIsResizingSide] = useState(false);
  const [sessionTime, setSessionTime]       = useState(0);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
  const [camSize, setCamSize] = useState({ w: 240, h: 135 });
  const [showSettings, setShowSettings]     = useState(false);
  const [showAccessControls, setShowAccessControls] = useState(false);
  const [videoQuality, setVideoQuality]     = useState<'480p'|'720p'|'1080p'>('720p');
  const [recordingSavedPath, setRecordingSavedPath] = useState<string | null>(null);
  const [endingSession, setEndingSession]   = useState(false);

  // [SESSION-DB] track the DB session ID so we can end it when the session ends
  const [sessionDbId, setSessionDbId]       = useState<string | null>(null);
  const sessionDbIdRef                      = useRef<string | null>(null);
  useEffect(() => { sessionDbIdRef.current = sessionDbId; }, [sessionDbId]);

  // [RECONNECT] track whether a connection was ever established this session
  const [wasConnected, setWasConnected]     = useState(false);

  const fileChunkRef  = useRef<((d: ArrayBuffer | string) => void) | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const myVideoRef    = useRef<HTMLVideoElement | null>(null);
  const callVideoRef  = useRef<HTMLVideoElement | null>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const camDragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Called when remote peer ends the session
  const handleRemoteEnd = useCallback(() => {
    // End DB session if we have one
    if (sessionDbIdRef.current && isAuthenticated) {
      sessionsApi.end(sessionDbIdRef.current).catch(() => {});
    }
    onEnd();
  }, [onEnd, isAuthenticated]);

  // Called when viewer joins and wants to connect (shows accept modal on host)
  const handleConnectionRequest = useCallback((_viewer: PendingViewer) => {
    // The pendingViewer state in the hook already causes the modal to render
    // (no extra state needed here — the modal reads pendingViewer directly)
  }, []);

  const {
    connectionStatus,
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
  } = usePeerConnection(myId, remoteId, (d) => fileChunkRef.current?.(d), handleRemoteEnd, handleConnectionRequest);

  const { startRecording, stopRecording, isRecording, recordingTime, formatTime, savedPath } = useRecording();
  const { sendFile, handleFileChunk, incomingFile, receivedFiles, outgoing, receiveProgress, downloadFile, formatSize } = useFileTransfer(sendFileChunk);
  fileChunkRef.current = handleFileChunk;

  // [SESSION-DB] Create a session record when the connection is established
  useEffect(() => {
    if (connectionStatus === 'Connected' && !wasConnected) {
      setWasConnected(true);
      if (isAuthenticated && !sessionDbId) {
        sessionsApi.create({ hostDisplayId: remoteId || myId })
          .then(session => {
            setSessionDbId(session.id);
            sessionDbIdRef.current = session.id;
          })
          .catch(() => {}); // non-fatal: session DB is optional
      }
    }
  }, [connectionStatus, wasConnected, isAuthenticated, sessionDbId, remoteId, myId]);

  // Recording saved toast
  useEffect(() => {
    if (savedPath) {
      setRecordingSavedPath(savedPath);
      const t = setTimeout(() => setRecordingSavedPath(null), 6000);
      return () => clearTimeout(t);
    }
  }, [savedPath]);

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Viewer connects to host room
  useEffect(() => {
    if (remoteId) connectToPeer(remoteId);
  }, []); // eslint-disable-line

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // Wire video elements
  useEffect(() => { if (myVideoRef.current && myStream) myVideoRef.current.srcObject = myStream; }, [myStream]);
  useEffect(() => { if (callVideoRef.current && callStream) callVideoRef.current.srcObject = callStream; }, [callStream]);
  useEffect(() => { if (remoteCallVideoRef.current && remoteCallStream) remoteCallVideoRef.current.srcObject = remoteCallStream; }, [remoteCallStream]);

  // Side panel resize
  const startSideResize = (e: React.MouseEvent) => {
    e.preventDefault(); setIsResizingSide(true);
    const x0 = e.clientX, w0 = sidePanelWidth;
    const onMove = (ev: MouseEvent) => setSidePanelWidth(Math.max(260, Math.min(520, w0 + (x0 - ev.clientX))));
    const onUp   = () => { setIsResizingSide(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  // PiP cam drag
  const startCamDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
    const onMove = (ev: MouseEvent) => setCamPos({ x: camDragStart.current.px + ev.clientX - camDragStart.current.mx, y: camDragStart.current.py + ev.clientY - camDragStart.current.my });
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };

  // End session
  const handleEndSession = useCallback(() => {
    if (endingSession) return;
    setEndingSession(true);
    if (isRecording) stopRecording();
    // [SESSION-DB] end the DB session record
    if (sessionDbIdRef.current && isAuthenticated) {
      sessionsApi.end(sessionDbIdRef.current).catch(() => {});
    }
    stopAllTracks();
    onEnd();
  }, [endingSession, isRecording, stopRecording, stopAllTracks, onEnd, isAuthenticated]);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const sessionActive = !!(myStream || remoteStream);

  // Quality color thresholds
  const qualityColor = !connectionQuality ? 'text-white/30'
    : connectionQuality.rttMs < 80  ? 'text-emerald-400'
    : connectionQuality.rttMs < 200 ? 'text-amber-400'
    : 'text-red-400';

  return (
    <div ref={containerRef} className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={handleEndSession} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'Connected' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
            <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
          </div>
          <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Clock className="w-3 h-3" />{fmtTime(sessionTime)}
          </div>

          {/* [QUALITY-BAR] RTT, bitrate, FPS from getStats() */}
          {connectionQuality && (
            <div className={`flex items-center gap-2 text-[10px] font-mono ${qualityColor}`}>
              <Activity className="w-3 h-3" />
              <span title="Round-trip time">{connectionQuality.rttMs}ms</span>
              <span className="text-white/15">·</span>
              <span title="Incoming bitrate">{connectionQuality.bitrateKbps}kbps</span>
              {connectionQuality.fps > 0 && (
                <><span className="text-white/15">·</span><span title="Frames per second">{connectionQuality.fps}fps</span></>
              )}
              {connectionQuality.packetLossPct > 0 && (
                <><span className="text-white/15">·</span><span className="text-red-400" title="Packet loss">{connectionQuality.packetLossPct}% loss</span></>
              )}
            </div>
          )}

          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" /> REC {formatTime(recordingTime)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-mono text-white/40">
            {remoteId ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}` : 'Host Mode'}
          </span>
          {isHost
            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">HOST</span>
            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-bold">VIEWER</span>
          }
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setSidePanel(p => p === 'chat'  ? null : 'chat')}  className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat'  ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
            <MessageSquare className="w-4 h-4" />
            {messages.some(m => m.from === 'them') && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />}
          </button>
          <button onClick={() => setSidePanel(p => p === 'files' ? null : 'files')} className={`p-2 rounded-lg transition-all ${sidePanel === 'files' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
            <Files className="w-4 h-4" />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={handleEndSession} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all ml-2">
            <PhoneOff className="w-3.5 h-3.5" /> End
          </button>
        </div>
      </div>

      {/* ── Main workspace ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-[#050506] overflow-hidden">
          {sessionActive ? (
            <>
              <div className="absolute inset-0">
                {remoteStream && !isHost ? (
                  <RemoteScreen stream={remoteStream} onControlEvent={sendControlEvent} controlEnabled={controlGranted} />
                ) : myStream ? (
                  <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
                ) : remoteStream ? (
                  <RemoteScreen stream={remoteStream} onControlEvent={() => {}} controlEnabled={false} />
                ) : null}
              </div>

              {/* AV call PiP */}
              {(callStream || remoteCallStream) && (
                <div
                  className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl cursor-move"
                  style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
                  onMouseDown={startCamDrag}
                >
                  <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
                    <GripVertical className="w-3 h-3 text-white/40" />
                    <span className="text-[9px] text-white/40">{remoteCallStream && callStream ? 'Split' : remoteCallStream ? 'Remote' : 'You'}</span>
                  </div>
                  <div className="w-full h-full flex">
                    {callStream && <video ref={callVideoRef} autoPlay playsInline muted className={`object-cover bg-black ${remoteCallStream ? 'w-1/2' : 'w-full'} h-full`} />}
                    {remoteCallStream && <video ref={remoteCallVideoRef} autoPlay playsInline className={`object-cover bg-black ${callStream ? 'w-1/2' : 'w-full'} h-full`} />}
                  </div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end"
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      const sx = e.clientX, sy = e.clientY, sw = camSize.w, sh = camSize.h;
                      const mv = (ev: MouseEvent) => setCamSize({ w: Math.max(160, sw + ev.clientX - sx), h: Math.max(90, sh + ev.clientY - sy) });
                      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
                    }}>
                    <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white/30 rounded-br-sm mb-1 mr-1" />
                  </div>
                </div>
              )}

              {controlGranted && !isHost && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg pointer-events-none">
                  <MousePointer2 className="w-3.5 h-3.5" /> Remote Control Active
                </div>
              )}
            </>
          ) : (
            /* Waiting / disconnected state */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                {isWaitingForHost
                  ? <Wifi className="w-8 h-8 text-indigo-400 animate-pulse" />
                  : <Monitor className="w-8 h-8 text-white/20" />
                }
              </div>
              <div className="text-center">
                {isWaitingForHost ? (
                  <>
                    <p className="text-white/60 text-sm font-medium">Waiting for host to accept…</p>
                    <p className="text-white/25 text-xs mt-1">The host will receive a connection request</p>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 text-sm font-medium">
                      {connectionStatus === 'Connected'
                        ? (isHost ? 'Waiting for viewer to connect…' : 'Connecting to host…')
                        : 'Connecting to signaling server…'}
                    </p>
                    <p className="text-white/20 text-xs mt-1">
                      {isHost ? 'Share your Room ID so others can connect' : `Host ID: ${remoteId}`}
                    </p>
                  </>
                )}
              </div>
              {isHost && connectionStatus === 'Connected' && !pendingViewer && (
                <button onClick={startScreenShare} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">
                  <Monitor className="w-4 h-4" /> Share My Screen
                </button>
              )}
            </div>
          )}

          {/* [RECONNECT-OVERLAY] shown when connection drops mid-session */}
          {wasConnected && connectionStatus === 'Disconnected' && !pendingViewer && !isWaitingForHost && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-30">
              <div className="bg-[#111113] border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-sm w-full mx-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <WifiOff className="w-7 h-7 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-base">Connection lost</p>
                  <p className="text-white/40 text-sm mt-1">
                    {isHost
                      ? 'The viewer disconnected. Waiting for them to reconnect using your Room ID.'
                      : 'Lost connection to host. They may reconnect shortly.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <button onClick={handleEndSession} className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white/60 font-semibold text-sm border border-white/10 transition-all">
                    Go Back
                  </button>
                  {!isHost && (
                    <button
                      onClick={() => connectToPeer(remoteId)}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel resize handle */}
        {sidePanel && (
          <div className={`w-1 cursor-col-resize bg-white/[0.04] hover:bg-indigo-500/40 transition-colors flex items-center justify-center group ${isResizingSide ? 'bg-indigo-500/40' : ''}`} onMouseDown={startSideResize}>
            <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400" />
          </div>
        )}

        {/* Side panel */}
        {sidePanel && (
          <div className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0" style={{ width: sidePanelWidth }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
                {[{ id: 'chat' as SidePanel, icon: MessageSquare, label: 'Chat' }, { id: 'files' as SidePanel, icon: Files, label: 'Files' }].map(tab => (
                  <button key={tab.id!} onClick={() => setSidePanel(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setSidePanel(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {sidePanel === 'chat' && (
                <div className="h-full bg-[#0d0d0f]">
                  <ChatPanel messages={messages} onSend={sendChatMessage} cryptoReady={cryptoReady} />
                </div>
              )}
              {sidePanel === 'files' && (
                <div className="p-3 h-full overflow-y-auto">
                  <FileTransferPanel onSendFile={sendFile} receivedFiles={receivedFiles} outgoing={outgoing} incomingFile={incomingFile} receiveProgress={receiveProgress} onDownload={downloadFile} formatSize={formatSize} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">
        <div className="flex items-center gap-2">
          {isHost ? (
            <>
              <TBtn icon={myStream ? Monitor : MonitorOff} label={myStream ? 'Sharing' : 'Share Screen'} active={!!myStream} color="indigo" onClick={myStream ? stopScreenShare : startScreenShare} />
              <TBtn icon={screenAudioEnabled ? Volume2 : VolumeX} label="Sys Audio" active={screenAudioEnabled} color="blue" onClick={toggleScreenAudio} />
              <TBtn icon={ShieldCheck} label="Access" color="indigo" onClick={() => setShowAccessControls(true)} />
              {/* [CLIPBOARD] Sync clipboard to remote */}
              <TBtn icon={Clipboard} label="Sync Clip" color="blue" onClick={syncClipboard} />
            </>
          ) : (
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border ${controlGranted ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-white/[0.04] text-white/35 border-white/[0.06]'}`}>
              <MousePointer2 className="w-4 h-4" />
              <span>{controlGranted ? 'Control On' : 'View Only'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!inCall ? (
            <>
              <TBtn icon={Video} label="Video Call"  onClick={() => startCall(true)}  color="green" />
              <TBtn icon={Mic}   label="Audio Call"  onClick={() => startCall(false)} color="green" />
            </>
          ) : (
            <>
              <TBtn icon={micEnabled ? Mic : MicOff}    label={micEnabled ? 'Mute' : 'Unmute'}      active={micEnabled}  color="green" onClick={toggleMic} />
              <TBtn icon={camEnabled ? Video : VideoOff} label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  color="green" onClick={toggleCam} />
              <TBtn icon={PhoneOff} label="End Call" danger onClick={endCall} />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TBtn
            icon={isRecording ? Square : Radio}
            label={isRecording ? `Stop ${formatTime(recordingTime)}` : 'Record'}
            active={isRecording} color="red"
            onClick={() => { if (isRecording) stopRecording(); else startRecording(myStream, remoteStream); }}
          />
          <TBtn icon={Settings2} label="Settings" onClick={() => setShowSettings(true)} />
        </div>
      </div>

      {/* ── Recording saved toast ── */}
      {recordingSavedPath && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-lg backdrop-blur">
          <Radio className="w-3.5 h-3.5" />
          Saved: <span className="font-mono text-emerald-400 max-w-xs truncate">{recordingSavedPath}</span>
          <button onClick={() => setRecordingSavedPath(null)} className="ml-1 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── [ACCEPT-MODAL] Connection request — HOST sees this when viewer joins ── */}
      {pendingViewer && isHost && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#111113] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Monitor className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Incoming Connection</p>
              <p className="text-white/40 text-sm mt-1.5">A viewer wants to connect to your machine and view your screen.</p>
              <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                <p className="text-[11px] font-mono text-white/40">Socket: {pendingViewer.socketId.slice(0,12)}…</p>
              </div>
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-400/70 text-[11px] w-full">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Only accept from people you know and trust. They will see your screen.</span>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => rejectConnection()}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-red-500/15 text-white/50 hover:text-red-400 font-semibold text-sm border border-white/10 hover:border-red-500/25 transition-all"
              >
                Decline
              </button>
              <button
                onClick={() => acceptConnection()}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-500/20"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base flex items-center gap-2"><Settings2 className="w-4 h-4 text-white/40" /> Session Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Video Quality</p>
                <div className="flex gap-2">
                  {(['480p','720p','1080p'] as const).map(q => (
                    <button key={q} onClick={() => setVideoQuality(q)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${videoQuality === q ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">System Audio</p>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-sm text-white/70">Include system audio in share</span>
                  <button onClick={toggleScreenAudio} className={`w-10 h-5 rounded-full transition-all relative ${screenAudioEnabled ? 'bg-indigo-500' : 'bg-white/15'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${screenAudioEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              {/* [QUALITY-BAR] Show live stats in settings */}
              {connectionQuality && (
                <div>
                  <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">Connection Quality</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Round-trip time', value: `${connectionQuality.rttMs} ms` },
                      { label: 'Bitrate', value: `${connectionQuality.bitrateKbps} kbps` },
                      { label: 'Frame rate', value: `${connectionQuality.fps} fps` },
                      { label: 'Packet loss', value: `${connectionQuality.packetLossPct}%` },
                    ].map(s => (
                      <div key={s.label} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                        <p className="text-[10px] text-white/30">{s.label}</p>
                        <p className={`text-sm font-mono font-bold ${qualityColor}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setShowSettings(false)} className="mt-5 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all">Done</button>
          </div>
        </div>
      )}

      {/* ── Access Controls modal (HOST only) ── */}
      {showAccessControls && isHost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-white/40" /> Access Controls</h2>
              <button onClick={() => setShowAccessControls(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>

            {/* [PERMS] Granular permission toggles */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <MousePointer2 className="w-5 h-5 text-white/30" />
                  <div>
                    <p className="text-sm font-semibold text-white/80">Remote Control</p>
                    <p className="text-[11px] text-white/30 mt-0.5">Mouse & keyboard access</p>
                  </div>
                </div>
                <button
                  onClick={controlGranted
                    ? revokeControl
                    : () => grantControl({ mouse: true, keyboard: true, clipboard: controlPerms.clipboard, fileTransfer: controlPerms.fileTransfer })
                  }
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-all ${controlGranted
                    ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25'}`}>
                  {controlGranted ? <><Unlock className="w-3.5 h-3.5" /> Revoke</> : <><Lock className="w-3.5 h-3.5" /> Grant</>}
                </button>
              </div>

              {controlGranted && (
                <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Permission Details</p>
                  {[
                    { key: 'mouse' as const, label: 'Mouse control', sub: 'Move cursor, click, scroll' },
                    { key: 'keyboard' as const, label: 'Keyboard control', sub: 'Type and use shortcuts' },
                    { key: 'clipboard' as const, label: 'Clipboard sync', sub: 'Share clipboard content' },
                    { key: 'fileTransfer' as const, label: 'File transfer', sub: 'Send and receive files' },
                  ].map(perm => (
                    <div key={perm.key} className="flex items-center justify-between">
                      <div>
                        <p className="text-[12px] font-medium text-white/60">{perm.label}</p>
                        <p className="text-[10px] text-white/25">{perm.sub}</p>
                      </div>
                      <button
                        onClick={() => grantControl({ ...controlPerms, [perm.key]: !controlPerms[perm.key] })}
                        className={`w-9 h-5 rounded-full transition-all relative flex-shrink-0 ${controlPerms[perm.key] ? 'bg-indigo-500' : 'bg-white/15'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${controlPerms[perm.key] ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={`px-4 py-3 rounded-xl border text-[11px] leading-relaxed ${controlGranted ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300/60' : 'bg-white/[0.03] border-white/[0.06] text-white/35'}`}>
                {controlGranted
                  ? '✅ Viewer has control. Click Revoke to take it back.'
                  : '🔒 Viewer is in view-only mode. Grant control to allow interaction.'}
              </div>

              {!controlGranted && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-amber-400/70 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Only grant control to trusted users. They can control your mouse and keyboard.</span>
                </div>
              )}
            </div>

            <button onClick={() => setShowAccessControls(false)} className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 font-semibold text-sm transition-all border border-white/10">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Toolbar button ──────────────────────────────────────────────────────────
interface TBtnProps { icon: React.ElementType; label: string; active?: boolean; color?: 'indigo'|'green'|'blue'|'red'; danger?: boolean; onClick?: () => void; }
function TBtn({ icon: Icon, label, active, color = 'indigo', danger, onClick }: TBtnProps) {
  const colorMap = { indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25', green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', blue: 'bg-blue-500/15 text-blue-300 border-blue-500/25', red: 'bg-red-500/15 text-red-300 border-red-500/25' };
  return (
    <button onClick={onClick} title={label} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all min-w-[56px] ${danger ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25' : active ? colorMap[color] : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'}`}>
      <Icon className="w-4 h-4" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
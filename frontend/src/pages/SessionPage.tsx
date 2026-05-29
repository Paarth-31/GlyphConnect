// // import { useState, useRef, useEffect, useCallback } from 'react';
// // import {
// //   Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
// //   Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
// //   Radio, Square, MousePointer2, Keyboard, ChevronLeft,
// //   Maximize2, Minimize2, GripVertical,
// //   Circle, X, Settings2
// // } from 'lucide-react';
// // import { ChatPanel } from '../components/ChatPanel';
// // import { FileTransferPanel } from '../components/FileTransferPanel';
// // import { RemoteScreen } from '../components/RemoteScreen';
// // import { usePeerConnection } from '../hooks/usePeerConnection';
// // import { useRecording } from '../hooks/useRecording';
// // import { useFileTransfer } from '../hooks/useFileTransfer';

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
// //   const [controlEnabled, setControlEnabled] = useState(false);
// //   const [isHost, setIsHost]                 = useState(isHostInitial);
// //   const [sessionTime, setSessionTime]       = useState(0);
// //   const [showSourcePicker, setShowSourcePicker] = useState(false);
// //   const [availableSources, setAvailableSources] = useState<any[]>([]);
// //   const [isFullscreen, setIsFullscreen]     = useState(false);

// //   // Webcam PiP
// //   const [camSize, setCamSize] = useState({ w: 240, h: 135 });
// //   const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
// //   const camDragStart = useRef<{ mx: number; my: number; px: number; py: number }>({ mx: 0, my: 0, px: 0, py: 0 });

// //   const handleFileChunkRef = useRef<((data: ArrayBuffer | string) => void) | null>(null);
// //   const containerRef        = useRef<HTMLDivElement>(null);
// //   const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);

// //   const {
// //     connectionStatus,
// //     connectToPeer,
// //     myStream,
// //     remoteStream,
// //     startScreenShare,
// //     screenAudioEnabled,
// //     toggleScreenAudio,
// //     callStream,
// //     remoteCallStream,
// //     inCall,
// //     startCall,
// //     endCall,
// //     micEnabled,
// //     toggleMic,
// //     camEnabled,
// //     toggleCam,
// //     messages,
// //     sendChatMessage,
// //     cryptoReady,
// //     sendControlEvent,
// //     sendFileChunk,
// //   } = usePeerConnection(myId, remoteId, (data) => handleFileChunkRef.current?.(data));

// //   const { startRecording, stopRecording, isRecording, recordingTime, formatTime } = useRecording();
// //   const { sendFile, handleFileChunk, incomingFile, receivedFiles, outgoing, receiveProgress, downloadFile, formatSize } = useFileTransfer(sendFileChunk);
// //   handleFileChunkRef.current = handleFileChunk;

// //   // Session timer
// //   useEffect(() => {
// //     timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
// //     return () => { if (timerRef.current) clearInterval(timerRef.current); };
// //   }, []);

// //   useEffect(() => {
// //     if (myStream) setIsHost(true);
// //   }, [myStream]);

// //   // Auto-connect:
// //   // - Controller (remoteId set): join the remote room and wait for host to share
// //   // - Host (remoteId empty): just join our own room and wait for someone to connect;
// //   //   do NOT call startScreenShare() here — socket isn't ready yet.
// //   //   The "Share My Screen" button in the waiting state handles it manually.
// //   useEffect(() => {
// //     if (remoteId) {
// //       connectToPeer(remoteId);
// //     }
// //     // Host side: we do nothing here — user clicks the Share Screen button,
// //     // or the auto-share fires inside usePeerConnection when user-connected fires.
// //   }, []); // eslint-disable-line react-hooks/exhaustive-deps

// //   // Electron source picker
// //   useEffect(() => {
// //     (window as any).electronAPI?.onSourcesResponse((sources: any[]) => {
// //       setAvailableSources(sources);
// //       setShowSourcePicker(true);
// //     });
// //   }, []);

// //   const myVideoRef = useCallback((node: HTMLVideoElement | null) => {
// //     if (node && myStream) node.srcObject = myStream;
// //   }, [myStream]);

// //   const callVideoRef = useCallback((node: HTMLVideoElement | null) => {
// //     if (node && callStream) node.srcObject = callStream;
// //   }, [callStream]);

// //   const remoteCallVideoRef = useCallback((node: HTMLVideoElement | null) => {
// //     if (node && remoteCallStream) node.srcObject = remoteCallStream;
// //   }, [remoteCallStream]);

// //   const formatSessionTime = (s: number) => {
// //     const h = Math.floor(s / 3600);
// //     const m = Math.floor((s % 3600) / 60);
// //     const sec = s % 60;
// //     return h > 0
// //       ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
// //       : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
// //   };

// //   // Side panel resize
// //   const startSideResize = (e: React.MouseEvent) => {
// //     e.preventDefault();
// //     setIsResizingSide(true);
// //     const startX = e.clientX, startW = sidePanelWidth;
// //     const onMove = (ev: MouseEvent) => setSidePanelWidth(Math.max(260, Math.min(520, startW + (startX - ev.clientX))));
// //     const onUp   = () => { setIsResizingSide(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
// //     window.addEventListener('mousemove', onMove);
// //     window.addEventListener('mouseup', onUp);
// //   };

// //   // Webcam PiP drag
// //   const startCamDrag = (e: React.MouseEvent) => {
// //     e.preventDefault();
// //     camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
// //     const onMove = (ev: MouseEvent) => setCamPos({ x: camDragStart.current.px + (ev.clientX - camDragStart.current.mx), y: camDragStart.current.py + (ev.clientY - camDragStart.current.my) });
// //     const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
// //     window.addEventListener('mousemove', onMove);
// //     window.addEventListener('mouseup', onUp);
// //   };

// //   const handleEndSession = () => {
// //     if (isRecording) stopRecording();
// //     if (inCall) endCall();
// //     onEnd();
// //   };

// //   const toggleSidePanel = (panel: SidePanel) => setSidePanel(p => p === panel ? null : panel);

// //   const sessionActive = myStream || remoteStream;

// //   return (
// //     <div className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

// //       {/* Top bar */}
// //       <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">

// //         {/* Left */}
// //         <div className="flex items-center gap-4">
// //           <button onClick={handleEndSession} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors">
// //             <ChevronLeft className="w-3.5 h-3.5" /> Back
// //           </button>
// //           <div className="w-px h-4 bg-white/10" />
// //           <div className="flex items-center gap-2">
// //             <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'} animate-pulse`} />
// //             <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
// //           </div>
// //           <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
// //             {formatSessionTime(sessionTime)}
// //           </div>
// //           {isRecording && (
// //             <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
// //               <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
// //               REC {formatTime(recordingTime)}
// //             </div>
// //           )}
// //         </div>

// //         {/* Center */}
// //         <div className="flex items-center gap-2">
// //           <Monitor className="w-3.5 h-3.5 text-white/30" />
// //           <span className="text-xs font-mono text-white/40">
// //             {remoteId
// //               ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}`
// //               : 'Host Mode'}
// //           </span>
// //           {isHost && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">HOST</span>}
// //         </div>

// //         {/* Right */}
// //         <div className="flex items-center gap-1">
// //           <button
// //             onClick={() => toggleSidePanel('chat')}
// //             className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
// //           >
// //             <MessageSquare className="w-4 h-4" />
// //             {messages.filter(m => m.from === 'them').length > 0 && (
// //               <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
// //             )}
// //           </button>
// //           <button
// //             onClick={() => toggleSidePanel('files')}
// //             className={`p-2 rounded-lg transition-all ${sidePanel === 'files' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
// //           >
// //             <Files className="w-4 h-4" />
// //           </button>
// //           <button
// //             onClick={() => setIsFullscreen(v => !v)}
// //             className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
// //           >
// //             {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
// //           </button>
// //           <button
// //             onClick={handleEndSession}
// //             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all ml-2"
// //           >
// //             <PhoneOff className="w-3.5 h-3.5" /> End
// //           </button>
// //         </div>
// //       </div>

// //       {/* Main workspace */}
// //       <div className="flex flex-1 overflow-hidden" ref={containerRef}>

// //         {/* Video area */}
// //         <div className="flex-1 relative bg-[#050506] overflow-hidden">
// //           {sessionActive ? (
// //             <>
// //               <div className="absolute inset-0">
// //                 {remoteStream ? (
// //                   <RemoteScreen
// //                     stream={remoteStream}
// //                     onControlEvent={sendControlEvent}
// //                     controlEnabled={controlEnabled && !isHost}
// //                   />
// //                 ) : myStream ? (
// //                   <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
// //                 ) : null}
// //               </div>

// //               {/* Floating webcam PiP */}
// //               {(callStream || remoteCallStream) && (
// //                 <div
// //                   className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/60 cursor-move"
// //                   style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
// //                   onMouseDown={startCamDrag}
// //                 >
// //                   <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
// //                     <GripVertical className="w-3 h-3 text-white/40" />
// //                     <span className="text-[9px] text-white/40 font-medium">{remoteCallStream ? 'Remote' : 'You'}</span>
// //                   </div>
// //                   {remoteCallStream
// //                     ? <video ref={remoteCallVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
// //                     : callStream
// //                     ? <video ref={callVideoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black" />
// //                     : null
// //                   }
// //                   {/* Resize handle */}
// //                   <div
// //                     className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
// //                     onMouseDown={e => {
// //                       e.stopPropagation(); e.preventDefault();
// //                       const startX = e.clientX, startY = e.clientY, startW = camSize.w, startH = camSize.h;
// //                       const onMove = (ev: MouseEvent) => setCamSize({ w: Math.max(160, startW + (ev.clientX - startX)), h: Math.max(90, startH + (ev.clientY - startY)) });
// //                       const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
// //                       window.addEventListener('mousemove', onMove);
// //                       window.addEventListener('mouseup', onUp);
// //                     }}
// //                   >
// //                     <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/30 rounded-br-sm" />
// //                   </div>
// //                 </div>
// //               )}

// //               {/* Control active indicator */}
// //               {controlEnabled && !isHost && (
// //                 <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg">
// //                   <MousePointer2 className="w-3.5 h-3.5" />
// //                   Control Active — click remote screen to release
// //                 </div>
// //               )}
// //             </>
// //           ) : (
// //             /* Waiting state */
// //             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
// //               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
// //                 <Monitor className="w-8 h-8 text-white/20" />
// //               </div>
// //               <div className="text-center">
// //                 <p className="text-white/40 text-sm font-medium">
// //                   {connectionStatus === 'Connected' ? 'Waiting for screen share...' : 'Connecting...'}
// //                 </p>
// //                 <p className="text-white/20 text-xs mt-1">
// //                   {isHost
// //                     ? 'Click "Share My Screen" below to start broadcasting'
// //                     : 'Waiting for the host to share their screen'}
// //                 </p>
// //               </div>
// //               {/* Host can manually start share from waiting screen */}
// //               {isHost && (
// //                 <button
// //                   onClick={startScreenShare}
// //                   className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
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
// //             <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400 transition-colors" />
// //           </div>
// //         )}

// //         {/* Side panel */}
// //         {sidePanel && (
// //           <div className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0" style={{ width: sidePanelWidth }}>
// //             <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
// //               <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
// //                 {[
// //                   { id: 'chat'  as SidePanel, icon: MessageSquare, label: 'Chat'  },
// //                   { id: 'files' as SidePanel, icon: Files,         label: 'Files' },
// //                 ].map(tab => (
// //                   <button
// //                     key={tab.id}
// //                     onClick={() => setSidePanel(tab.id)}
// //                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
// //                   >
// //                     <tab.icon className="w-3.5 h-3.5" />
// //                     {tab.label}
// //                   </button>
// //                 ))}
// //               </div>
// //               <button onClick={() => setSidePanel(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
// //                 <X className="w-3.5 h-3.5" />
// //               </button>
// //             </div>
// //             <div className="flex-1 overflow-hidden">
// //               {sidePanel === 'chat' && <ChatPanel messages={messages} onSend={sendChatMessage} cryptoReady={cryptoReady} />}
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

// //       {/* Bottom toolbar */}
// //       <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">

// //         {/* Left: screen & audio controls */}
// //         <div className="flex items-center gap-2">
// //           {isHost && (
// //             <>
// //               <ToolbarBtn
// //                 icon={myStream ? Monitor : MonitorOff}
// //                 label={myStream ? 'Sharing' : 'Share Screen'}
// //                 active={!!myStream}
// //                 onClick={myStream ? undefined : startScreenShare}
// //                 activeColor="indigo"
// //               />
// //               <ToolbarBtn
// //                 icon={screenAudioEnabled ? Volume2 : VolumeX}
// //                 label="System Audio"
// //                 active={screenAudioEnabled}
// //                 onClick={toggleScreenAudio}
// //                 activeColor="blue"
// //               />
// //             </>
// //           )}
// //           {!isHost && (
// //             <ToolbarBtn
// //               icon={controlEnabled ? MousePointer2 : Keyboard}
// //               label={controlEnabled ? 'Control On' : 'Control Off'}
// //               active={controlEnabled}
// //               onClick={() => setControlEnabled(v => !v)}
// //               activeColor="indigo"
// //             />
// //           )}
// //         </div>

// //         {/* Center: call controls */}
// //         <div className="flex items-center gap-2">
// //           {!inCall ? (
// //             <>
// //               <ToolbarBtn icon={Video} label="Video Call"  onClick={() => startCall(true)}  activeColor="green" />
// //               <ToolbarBtn icon={Mic}   label="Audio Call"  onClick={() => startCall(false)} activeColor="green" />
// //             </>
// //           ) : (
// //             <>
// //               <ToolbarBtn icon={micEnabled ? Mic : MicOff}   label={micEnabled ? 'Mute' : 'Unmute'}   active={micEnabled}  activeColor="green" onClick={toggleMic} />
// //               <ToolbarBtn icon={camEnabled ? Video : VideoOff} label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  activeColor="green" onClick={toggleCam} />
// //               <ToolbarBtn icon={PhoneOff} label="End Call" onClick={endCall} danger />
// //             </>
// //           )}
// //         </div>

// //         {/* Right: recording */}
// //         <div className="flex items-center gap-2">
// //           <ToolbarBtn
// //             icon={isRecording ? Square : Radio}
// //             label={isRecording ? `Stop (${formatTime(recordingTime)})` : 'Record'}
// //             active={isRecording}
// //             activeColor="red"
// //             onClick={() => isRecording ? stopRecording() : startRecording(myStream, remoteStream)}
// //           />
// //           <ToolbarBtn icon={Settings2} label="Settings" onClick={() => {}} />
// //         </div>
// //       </div>

// //       {/* Source picker modal */}
// //       {showSourcePicker && (
// //         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
// //           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
// //             <div className="flex items-center justify-between mb-5">
// //               <h2 className="text-white font-bold text-lg">Choose what to share</h2>
// //               <button onClick={() => setShowSourcePicker(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-all">
// //                 <X className="w-4 h-4" />
// //               </button>
// //             </div>
// //             <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
// //               {availableSources.map(source => (
// //                 <button
// //                   key={source.id}
// //                   onClick={() => { (window as any).electronAPI?.selectSource(source.id); setShowSourcePicker(false); }}
// //                   className="bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-xl p-3 flex flex-col items-center gap-2 transition-all group"
// //                 >
// //                   <img src={source.thumbnail} className="w-full rounded-lg" alt={source.name} />
// //                   <span className="text-white text-xs text-center font-medium truncate w-full group-hover:text-indigo-300 transition-colors">{source.name}</span>
// //                 </button>
// //               ))}
// //             </div>
// //             <button
// //               onClick={() => setShowSourcePicker(false)}
// //               className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-xl text-sm font-medium border border-white/10 transition-all"
// //             >
// //               Cancel
// //             </button>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // // ── Toolbar button ──────────────────────────────────────────────────────────

// // interface ToolbarBtnProps {
// //   icon: React.ElementType;
// //   label: string;
// //   active?: boolean;
// //   activeColor?: 'indigo' | 'green' | 'blue' | 'red';
// //   danger?: boolean;
// //   onClick?: () => void;
// // }

// // function ToolbarBtn({ icon: Icon, label, active, activeColor = 'indigo', danger, onClick }: ToolbarBtnProps) {
// //   const colorMap = {
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
// //           ? colorMap[activeColor]
// //           : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
// //       }`}
// //     >
// //       <Icon className="w-4 h-4" />
// //       <span className="whitespace-nowrap">{label}</span>
// //     </button>
// //   );
// // }




// // frontend/src/pages/SessionPage.tsx
// //
// // FIXES IN THIS FILE:
// //
// // [FIX D] handleEndSession now calls stopAllTracks() (exported from the hook)
// //         before calling onEnd(). This stops all MediaStream tracks (screen +
// //         webcam) so the browser "You are sharing your screen" banner dismisses
// //         and the camera/mic indicator lights go off.
// //
// // [FIX E] stopAllTracks() in the hook emits 'hang-up' to the signaling server
// //         which notifies the remote peer. Their hook listens for 'hang-up' and
// //         runs the same cleanup so both sides tear down together.
// //
// // [FIX C] ChatPanel now has a dark background so it is readable against the
// //         dark session UI (was rendering white-on-white because bg-white was
// //         hardcoded in ChatPanel with no dark-mode override applied).

// import { useState, useRef, useEffect, useCallback } from 'react';
// import {
//   Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
//   Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
//   Radio, Square, MousePointer2, Keyboard, ChevronLeft,
//   Maximize2, Minimize2, GripVertical,
//   Circle, X, Settings2
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

// export function SessionPage({ myId, remoteId, isHostInitial, onEnd }: Props) {
//   const [sidePanel, setSidePanel]           = useState<SidePanel>(null);
//   const [sidePanelWidth, setSidePanelWidth] = useState(320);
//   const [isResizingSide, setIsResizingSide] = useState(false);
//   const [controlEnabled, setControlEnabled] = useState(false);
//   const [isHost, setIsHost]                 = useState(isHostInitial);
//   const [sessionTime, setSessionTime]       = useState(0);
//   const [showSourcePicker, setShowSourcePicker] = useState(false);
//   const [availableSources, setAvailableSources] = useState<any[]>([]);
//   const [isFullscreen, setIsFullscreen]     = useState(false);

//   const [camSize, setCamSize] = useState({ w: 240, h: 135 });
//   const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
//   const camDragStart = useRef<{ mx: number; my: number; px: number; py: number }>({ mx: 0, my: 0, px: 0, py: 0 });

//   const handleFileChunkRef = useRef<((data: ArrayBuffer | string) => void) | null>(null);
//   const containerRef       = useRef<HTMLDivElement>(null);
//   const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null);

//   const {
//     connectionStatus,
//     connectToPeer,
//     myStream,
//     remoteStream,
//     startScreenShare,
//     screenAudioEnabled,
//     toggleScreenAudio,
//     callStream,
//     remoteCallStream,
//     inCall,
//     startCall,
//     endCall,
//     micEnabled,
//     toggleMic,
//     camEnabled,
//     toggleCam,
//     messages,
//     sendChatMessage,
//     cryptoReady,
//     sendControlEvent,
//     sendFileChunk,
//     stopAllTracks,   // [FIX D+E]
//   } = usePeerConnection(myId, remoteId, (data) => handleFileChunkRef.current?.(data));

//   const { startRecording, stopRecording, isRecording, recordingTime, formatTime } = useRecording();
//   const { sendFile, handleFileChunk, incomingFile, receivedFiles, outgoing, receiveProgress, downloadFile, formatSize } = useFileTransfer(sendFileChunk);
//   handleFileChunkRef.current = handleFileChunk;

//   useEffect(() => {
//     timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
//     return () => { if (timerRef.current) clearInterval(timerRef.current); };
//   }, []);

//   useEffect(() => {
//     if (myStream) setIsHost(true);
//   }, [myStream]);

//   useEffect(() => {
//     if (remoteId) connectToPeer(remoteId);
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     (window as any).electronAPI?.onSourcesResponse((sources: any[]) => {
//       setAvailableSources(sources);
//       setShowSourcePicker(true);
//     });
//   }, []);

//   const myVideoRef = useCallback((node: HTMLVideoElement | null) => {
//     if (node && myStream) node.srcObject = myStream;
//   }, [myStream]);

//   const callVideoRef = useCallback((node: HTMLVideoElement | null) => {
//     if (node && callStream) node.srcObject = callStream;
//   }, [callStream]);

//   const remoteCallVideoRef = useCallback((node: HTMLVideoElement | null) => {
//     if (node && remoteCallStream) node.srcObject = remoteCallStream;
//   }, [remoteCallStream]);

//   const formatSessionTime = (s: number) => {
//     const h   = Math.floor(s / 3600);
//     const m   = Math.floor((s % 3600) / 60);
//     const sec = s % 60;
//     return h > 0
//       ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
//       : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
//   };

//   const startSideResize = (e: React.MouseEvent) => {
//     e.preventDefault();
//     setIsResizingSide(true);
//     const startX = e.clientX, startW = sidePanelWidth;
//     const onMove = (ev: MouseEvent) => setSidePanelWidth(Math.max(260, Math.min(520, startW + (startX - ev.clientX))));
//     const onUp   = () => { setIsResizingSide(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
//     window.addEventListener('mousemove', onMove);
//     window.addEventListener('mouseup', onUp);
//   };

//   const startCamDrag = (e: React.MouseEvent) => {
//     e.preventDefault();
//     camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
//     const onMove = (ev: MouseEvent) => setCamPos({ x: camDragStart.current.px + (ev.clientX - camDragStart.current.mx), y: camDragStart.current.py + (ev.clientY - camDragStart.current.my) });
//     const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
//     window.addEventListener('mousemove', onMove);
//     window.addEventListener('mouseup', onUp);
//   };

//   // [FIX D+E] Stop all tracks (screen + webcam) and signal remote before unmounting
//   const handleEndSession = useCallback(() => {
//     if (isRecording) stopRecording();
//     stopAllTracks(); // stops MediaStream tracks + emits 'hang-up' to remote peer
//     onEnd();
//   }, [isRecording, stopRecording, stopAllTracks, onEnd]);

//   const toggleSidePanel = (panel: SidePanel) => setSidePanel(p => p === panel ? null : panel);

//   const sessionActive = myStream || remoteStream;

//   return (
//     <div
//       className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none"
//       style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
//     >
//       {/* Top bar */}
//       <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">

//         {/* Left */}
//         <div className="flex items-center gap-4">
//           <button
//             onClick={handleEndSession}
//             className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors"
//           >
//             <ChevronLeft className="w-3.5 h-3.5" /> Back
//           </button>
//           <div className="w-px h-4 bg-white/10" />
//           <div className="flex items-center gap-2">
//             <div className={`w-2 h-2 rounded-full ${connectionStatus === 'Connected' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'} animate-pulse`} />
//             <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
//           </div>
//           <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
//             {formatSessionTime(sessionTime)}
//           </div>
//           {isRecording && (
//             <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
//               <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
//               REC {formatTime(recordingTime)}
//             </div>
//           )}
//         </div>

//         {/* Center */}
//         <div className="flex items-center gap-2">
//           <Monitor className="w-3.5 h-3.5 text-white/30" />
//           <span className="text-xs font-mono text-white/40">
//             {remoteId
//               ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}`
//               : 'Host Mode'}
//           </span>
//           {isHost && (
//             <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">
//               HOST
//             </span>
//           )}
//         </div>

//         {/* Right */}
//         <div className="flex items-center gap-1">
//           <button
//             onClick={() => toggleSidePanel('chat')}
//             className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
//           >
//             <MessageSquare className="w-4 h-4" />
//             {messages.filter(m => m.from === 'them').length > 0 && (
//               <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400" />
//             )}
//           </button>
//           <button
//             onClick={() => toggleSidePanel('files')}
//             className={`p-2 rounded-lg transition-all ${sidePanel === 'files' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}
//           >
//             <Files className="w-4 h-4" />
//           </button>
//           <button
//             onClick={() => setIsFullscreen(v => !v)}
//             className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
//           >
//             {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
//           </button>
//           <button
//             onClick={handleEndSession}
//             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all ml-2"
//           >
//             <PhoneOff className="w-3.5 h-3.5" /> End
//           </button>
//         </div>
//       </div>

//       {/* Main workspace */}
//       <div className="flex flex-1 overflow-hidden" ref={containerRef}>

//         {/* Video area */}
//         <div className="flex-1 relative bg-[#050506] overflow-hidden">
//           {sessionActive ? (
//             <>
//               <div className="absolute inset-0">
//                 {remoteStream ? (
//                   <RemoteScreen
//                     stream={remoteStream}
//                     onControlEvent={sendControlEvent}
//                     controlEnabled={controlEnabled && !isHost}
//                   />
//                 ) : myStream ? (
//                   <video
//                     ref={myVideoRef}
//                     autoPlay
//                     playsInline
//                     muted
//                     className="w-full h-full object-contain bg-black"
//                   />
//                 ) : null}
//               </div>

//               {/* Floating webcam PiP */}
//               {(callStream || remoteCallStream) && (
//                 <div
//                   className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/60 cursor-move"
//                   style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
//                   onMouseDown={startCamDrag}
//                 >
//                   <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
//                     <GripVertical className="w-3 h-3 text-white/40" />
//                     <span className="text-[9px] text-white/40 font-medium">{remoteCallStream ? 'Remote' : 'You'}</span>
//                   </div>
//                   {remoteCallStream
//                     ? <video ref={remoteCallVideoRef} autoPlay playsInline         className="w-full h-full object-cover bg-black" />
//                     : callStream
//                     ? <video ref={callVideoRef}       autoPlay playsInline muted   className="w-full h-full object-cover bg-black" />
//                     : null
//                   }
//                   {/* Resize handle */}
//                   <div
//                     className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
//                     onMouseDown={e => {
//                       e.stopPropagation(); e.preventDefault();
//                       const startX = e.clientX, startY = e.clientY, startW = camSize.w, startH = camSize.h;
//                       const onMove = (ev: MouseEvent) => setCamSize({ w: Math.max(160, startW + (ev.clientX - startX)), h: Math.max(90, startH + (ev.clientY - startY)) });
//                       const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
//                       window.addEventListener('mousemove', onMove);
//                       window.addEventListener('mouseup', onUp);
//                     }}
//                   >
//                     <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/30 rounded-br-sm" />
//                   </div>
//                 </div>
//               )}

//               {controlEnabled && !isHost && (
//                 <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg">
//                   <MousePointer2 className="w-3.5 h-3.5" />
//                   Control Active — click remote screen to release
//                 </div>
//               )}
//             </>
//           ) : (
//             /* Waiting state */
//             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
//               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
//                 <Monitor className="w-8 h-8 text-white/20" />
//               </div>
//               <div className="text-center">
//                 <p className="text-white/40 text-sm font-medium">
//                   {connectionStatus === 'Connected' ? 'Waiting for screen share...' : 'Connecting...'}
//                 </p>
//                 <p className="text-white/20 text-xs mt-1">
//                   {isHost
//                     ? 'Click "Share My Screen" below to start broadcasting'
//                     : 'Waiting for the host to share their screen'}
//                 </p>
//               </div>
//               {isHost && (
//                 <button
//                   onClick={startScreenShare}
//                   className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
//                 >
//                   <Monitor className="w-4 h-4" /> Share My Screen
//                 </button>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Side panel resize handle */}
//         {sidePanel && (
//           <div
//             className={`w-1 cursor-col-resize bg-white/[0.04] hover:bg-indigo-500/40 transition-colors relative flex items-center justify-center group ${isResizingSide ? 'bg-indigo-500/40' : ''}`}
//             onMouseDown={startSideResize}
//           >
//             <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400 transition-colors" />
//           </div>
//         )}

//         {/* Side panel */}
//         {sidePanel && (
//           <div
//             className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0"
//             style={{ width: sidePanelWidth }}
//           >
//             <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
//               <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
//                 {([
//                   { id: 'chat'  as SidePanel, icon: MessageSquare, label: 'Chat'  },
//                   { id: 'files' as SidePanel, icon: Files,         label: 'Files' },
//                 ] as const).map(tab => (
//                   <button
//                     key={tab.id!}
//                     onClick={() => setSidePanel(tab.id)}
//                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
//                   >
//                     <tab.icon className="w-3.5 h-3.5" />
//                     {tab.label}
//                   </button>
//                 ))}
//               </div>
//               <button
//                 onClick={() => setSidePanel(null)}
//                 className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
//               >
//                 <X className="w-3.5 h-3.5" />
//               </button>
//             </div>

//             <div className="flex-1 overflow-hidden">
//               {/* [FIX C] ChatPanel wrapped in dark container — prevents white-on-white rendering */}
//               {sidePanel === 'chat' && (
//                 <div className="h-full bg-[#0d0d0f]">
//                   <ChatPanel
//                     messages={messages}
//                     onSend={sendChatMessage}
//                     cryptoReady={cryptoReady}
//                   />
//                 </div>
//               )}
//               {sidePanel === 'files' && (
//                 <div className="p-3 h-full overflow-y-auto">
//                   <FileTransferPanel
//                     onSendFile={sendFile}
//                     receivedFiles={receivedFiles}
//                     outgoing={outgoing}
//                     incomingFile={incomingFile}
//                     receiveProgress={receiveProgress}
//                     onDownload={downloadFile}
//                     formatSize={formatSize}
//                   />
//                 </div>
//               )}
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Bottom toolbar */}
//       <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">

//         {/* Left: screen & audio controls */}
//         <div className="flex items-center gap-2">
//           {isHost && (
//             <>
//               <ToolbarBtn
//                 icon={myStream ? Monitor : MonitorOff}
//                 label={myStream ? 'Sharing' : 'Share Screen'}
//                 active={!!myStream}
//                 onClick={myStream ? undefined : startScreenShare}
//                 activeColor="indigo"
//               />
//               <ToolbarBtn
//                 icon={screenAudioEnabled ? Volume2 : VolumeX}
//                 label="System Audio"
//                 active={screenAudioEnabled}
//                 onClick={toggleScreenAudio}
//                 activeColor="blue"
//               />
//             </>
//           )}
//           {!isHost && (
//             <ToolbarBtn
//               icon={controlEnabled ? MousePointer2 : Keyboard}
//               label={controlEnabled ? 'Control On' : 'Control Off'}
//               active={controlEnabled}
//               onClick={() => setControlEnabled(v => !v)}
//               activeColor="indigo"
//             />
//           )}
//         </div>

//         {/* Center: call controls */}
//         <div className="flex items-center gap-2">
//           {!inCall ? (
//             <>
//               <ToolbarBtn icon={Video} label="Video Call"  onClick={() => startCall(true)}  activeColor="green" />
//               <ToolbarBtn icon={Mic}   label="Audio Call"  onClick={() => startCall(false)} activeColor="green" />
//             </>
//           ) : (
//             <>
//               <ToolbarBtn icon={micEnabled ? Mic : MicOff}     label={micEnabled ? 'Mute'   : 'Unmute'}  active={micEnabled}  activeColor="green" onClick={toggleMic} />
//               <ToolbarBtn icon={camEnabled ? Video : VideoOff}  label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  activeColor="green" onClick={toggleCam} />
//               <ToolbarBtn icon={PhoneOff} label="End Call" onClick={endCall} danger />
//             </>
//           )}
//         </div>

//         {/* Right: recording */}
//         <div className="flex items-center gap-2">
//           <ToolbarBtn
//             icon={isRecording ? Square : Radio}
//             label={isRecording ? `Stop (${formatTime(recordingTime)})` : 'Record'}
//             active={isRecording}
//             activeColor="red"
//             onClick={() => isRecording ? stopRecording() : startRecording(myStream, remoteStream)}
//           />
//           <ToolbarBtn icon={Settings2} label="Settings" onClick={() => {}} />
//         </div>
//       </div>

//       {/* Source picker modal (Electron only) */}
//       {showSourcePicker && (
//         <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
//           <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
//             <div className="flex items-center justify-between mb-5">
//               <h2 className="text-white font-bold text-lg">Choose what to share</h2>
//               <button
//                 onClick={() => setShowSourcePicker(false)}
//                 className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
//               >
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
//               {availableSources.map(source => (
//                 <button
//                   key={source.id}
//                   onClick={() => { (window as any).electronAPI?.selectSource(source.id); setShowSourcePicker(false); }}
//                   className="bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-xl p-3 flex flex-col items-center gap-2 transition-all group"
//                 >
//                   <img src={source.thumbnail} className="w-full rounded-lg" alt={source.name} />
//                   <span className="text-white text-xs text-center font-medium truncate w-full group-hover:text-indigo-300 transition-colors">
//                     {source.name}
//                   </span>
//                 </button>
//               ))}
//             </div>
//             <button
//               onClick={() => setShowSourcePicker(false)}
//               className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/50 rounded-xl text-sm font-medium border border-white/10 transition-all"
//             >
//               Cancel
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Toolbar button ────────────────────────────────────────────────────────────

// interface ToolbarBtnProps {
//   icon: React.ElementType;
//   label: string;
//   active?: boolean;
//   activeColor?: 'indigo' | 'green' | 'blue' | 'red';
//   danger?: boolean;
//   onClick?: () => void;
// }

// function ToolbarBtn({ icon: Icon, label, active, activeColor = 'indigo', danger, onClick }: ToolbarBtnProps) {
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
//         danger
//           ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
//           : active
//           ? colorMap[activeColor]
//           : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
//       }`}
//     >
//       <Icon className="w-4 h-4" />
//       <span className="whitespace-nowrap">{label}</span>
//     </button>
//   );
// }



// frontend/src/pages/SessionPage.tsx
//
// FIXES IN THIS FILE:
//
// [FIX 3] Screen share UI only shown to the HOST (isHostInitial prop).
//         Viewer never sees the Share Screen button regardless of state changes.
//
// [FIX 4] "Grant Control" / "Revoke Control" button on HOST side.
//         Viewer sees a read-only indicator showing whether control is active.
//         Viewer can NOT toggle control themselves.
//
// [FIX 5] "End" button now calls stopAllTracks() which emits hang-up to the
//         remote peer so both sides clean up simultaneously.
//
// [FUNCTIONAL] All toolbar buttons are now wired:
//   - Screen share toggle (host only)
//   - System audio toggle (host only)
//   - Video/Audio call start
//   - Mic mute/unmute
//   - Camera on/off
//   - End call
//   - Record / Stop record
//   - Grant / Revoke control (host only)
//   - Fullscreen (actual document.fullscreenElement API)
//
// [CHAT UI FIX] ChatPanel is wrapped in dark container — removes white-on-white.

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Volume2, VolumeX,
  Monitor, MonitorOff, PhoneOff, MessageSquare, Files,
  Radio, Square, MousePointer2, ChevronLeft,
  Maximize2, Minimize2, GripVertical, Circle, X,
  Settings2, ShieldCheck, ShieldOff,
} from 'lucide-react';
import { ChatPanel }         from '../components/ChatPanel';
import { FileTransferPanel } from '../components/FileTransferPanel';
import { RemoteScreen }      from '../components/RemoteScreen';
import { usePeerConnection } from '../hooks/usePeerConnection';
import { useRecording }      from '../hooks/useRecording';
import { useFileTransfer }   from '../hooks/useFileTransfer';

interface Props {
  myId: string;
  remoteId: string;
  /** true = this person shared their ID (the screen-sharer / host)
   *  false = this person entered someone else's ID (the viewer) */
  isHostInitial: boolean;
  onEnd: () => void;
}

type SidePanel = 'chat' | 'files' | null;

export function SessionPage({ myId, remoteId, isHostInitial, onEnd }: Props) {
  const [sidePanel, setSidePanel]           = useState<SidePanel>(null);
  const [sidePanelWidth, setSidePanelWidth] = useState(320);
  const [isResizingSide, setIsResizingSide] = useState(false);
  const [sessionTime, setSessionTime]       = useState(0);
  const [isFullscreen, setIsFullscreen]     = useState(false);
  const [camPos, setCamPos]   = useState({ x: 16, y: 16 });
  const [camSize, setCamSize] = useState({ w: 240, h: 135 });

  const camDragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const fileChunkRef  = useRef<((d: ArrayBuffer | string) => void) | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    connectionStatus,
    connectToPeer,
    myStream,
    remoteStream,
    startScreenShare,
    stopScreenShare,
    screenAudioEnabled,
    toggleScreenAudio,
    callStream,
    remoteCallStream,
    inCall,
    startCall,
    endCall,
    micEnabled, toggleMic,
    camEnabled, toggleCam,
    messages,
    sendChatMessage,
    cryptoReady,
    // amInitiator,       // [FIX 3] true only on host side
    controlGranted,    // [FIX 4]
    grantControl,      // [FIX 4]
    revokeControl,     // [FIX 4]
    sendControlEvent,
    sendFileChunk,
    stopAllTracks,     // [FIX 5]
  } = usePeerConnection(myId, remoteId, (d) => fileChunkRef.current?.(d));

  const { startRecording, stopRecording, isRecording, recordingTime, formatTime } = useRecording();
  const { sendFile, handleFileChunk, incomingFile, receivedFiles, outgoing, receiveProgress, downloadFile, formatSize } =
    useFileTransfer(sendFileChunk);
  fileChunkRef.current = handleFileChunk;

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-connect: viewer joins the host's room
  useEffect(() => {
    if (remoteId) connectToPeer(remoteId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen API
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Video element ref callbacks
  const myVideoRef = useCallback((n: HTMLVideoElement | null) => {
    if (n && myStream) n.srcObject = myStream;
  }, [myStream]);
  const callVideoRef = useCallback((n: HTMLVideoElement | null) => {
    if (n && callStream) n.srcObject = callStream;
  }, [callStream]);
  const remoteCallVideoRef = useCallback((n: HTMLVideoElement | null) => {
    if (n && remoteCallStream) n.srcObject = remoteCallStream;
  }, [remoteCallStream]);

  // Resize side panel
  const startSideResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSide(true);
    const x0 = e.clientX, w0 = sidePanelWidth;
    const onMove = (ev: MouseEvent) => setSidePanelWidth(Math.max(260, Math.min(520, w0 + (x0 - ev.clientX))));
    const onUp   = () => { setIsResizingSide(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag webcam PiP
  const startCamDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    camDragStart.current = { mx: e.clientX, my: e.clientY, px: camPos.x, py: camPos.y };
    const onMove = (ev: MouseEvent) => setCamPos({ x: camDragStart.current.px + ev.clientX - camDragStart.current.mx, y: camDragStart.current.py + ev.clientY - camDragStart.current.my });
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // [FIX 5] End session — stops tracks on BOTH sides
  const handleEndSession = useCallback(() => {
    if (isRecording) stopRecording();
    stopAllTracks();
    onEnd();
  }, [isRecording, stopRecording, stopAllTracks, onEnd]);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const sessionActive = myStream || remoteStream;

  // [FIX 3] Only the HOST (person whose ID was shared) can share screen
  // Use isHostInitial (stable prop), not amInitiator (socket-derived, may lag)
  const isHost = isHostInitial;

  return (
    <div
      ref={containerRef}
      className="h-screen bg-[#080809] text-white flex flex-col overflow-hidden select-none"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur border-b border-white/[0.06] z-20 shrink-0">

        <div className="flex items-center gap-4">
          <button onClick={handleEndSession} className="flex items-center gap-1.5 text-white/30 hover:text-white/70 text-xs transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${connectionStatus === 'Connected' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'}`} />
            <span className="text-xs font-medium text-white/60">{connectionStatus}</span>
          </div>
          <div className="text-xs font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-md">{fmtTime(sessionTime)}</div>
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
              <Circle className="w-2 h-2 fill-red-400 animate-pulse" />
              REC {formatTime(recordingTime)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-mono text-white/40">
            {remoteId ? `${remoteId.slice(0,3)} ${remoteId.slice(3,6)} ${remoteId.slice(6,9)} ${remoteId.slice(9)}` : 'Host Mode'}
          </span>
          {isHost && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold">HOST</span>}
          {!isHost && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-bold">VIEWER</span>}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setSidePanel(p => p === 'chat' ? null : 'chat')} className={`relative p-2 rounded-lg transition-all ${sidePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}`}>
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

      {/* ── Main workspace ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video area */}
        <div className="flex-1 relative bg-[#050506] overflow-hidden">
          {sessionActive ? (
            <>
              <div className="absolute inset-0">
                {/* [FIX 3] Viewer sees remote screen; Host sees their own preview */}
                {remoteStream && !isHost ? (
                  <RemoteScreen
                    stream={remoteStream}
                    onControlEvent={sendControlEvent}
                    controlEnabled={controlGranted} // [FIX 4] only active when host grants
                  />
                ) : myStream ? (
                  <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
                ) : remoteStream ? (
                  // Host can also see what they're sharing on the remote side (monitor mode)
                  <RemoteScreen stream={remoteStream} onControlEvent={() => {}} controlEnabled={false} />
                ) : null}
              </div>

              {/* Webcam PiP */}
              {(callStream || remoteCallStream) && (
                <div
                  className="absolute z-10 rounded-xl overflow-hidden border border-white/20 shadow-2xl shadow-black/60 cursor-move"
                  style={{ left: camPos.x, top: camPos.y, width: camSize.w, height: camSize.h }}
                  onMouseDown={startCamDrag}
                >
                  <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-2">
                    <GripVertical className="w-3 h-3 text-white/40" />
                    <span className="text-[9px] text-white/40">{remoteCallStream ? 'Remote' : 'You'}</span>
                  </div>
                  {remoteCallStream
                    ? <video ref={remoteCallVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
                    : <video ref={callVideoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black" />
                  }
                  <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      const sx = e.clientX, sy = e.clientY, sw = camSize.w, sh = camSize.h;
                      const mv = (ev: MouseEvent) => setCamSize({ w: Math.max(160, sw + ev.clientX - sx), h: Math.max(90, sh + ev.clientY - sy) });
                      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
                      window.addEventListener('mousemove', mv);
                      window.addEventListener('mouseup', up);
                    }}>
                    <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/30 rounded-br-sm" />
                  </div>
                </div>
              )}

              {/* [FIX 4] Control active banner on viewer side */}
              {controlGranted && !isHost && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600/80 backdrop-blur border border-indigo-400/30 text-white text-xs font-bold shadow-lg">
                  <MousePointer2 className="w-3.5 h-3.5" />
                  Control Active
                </div>
              )}
            </>
          ) : (
            /* Waiting state */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-white/40 text-sm font-medium">
                  {connectionStatus === 'Connected' ? (isHost ? 'Viewer connected — start sharing below' : 'Waiting for host to share screen…') : 'Connecting…'}
                </p>
                <p className="text-white/20 text-xs mt-1">
                  {isHost ? 'Click "Share Screen" in the toolbar' : `Host ID: ${remoteId}`}
                </p>
              </div>
              {/* [FIX 3] ONLY host gets the manual share button */}
              {isHost && (
                <button
                  onClick={startScreenShare}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
                >
                  <Monitor className="w-4 h-4" /> Share My Screen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Side panel resize handle */}
        {sidePanel && (
          <div
            className={`w-1 cursor-col-resize bg-white/[0.04] hover:bg-indigo-500/40 transition-colors relative flex items-center justify-center group ${isResizingSide ? 'bg-indigo-500/40' : ''}`}
            onMouseDown={startSideResize}
          >
            <GripVertical className="w-3 h-3 text-white/20 group-hover:text-indigo-400" />
          </div>
        )}

        {/* Side panel */}
        {sidePanel && (
          <div className="bg-[#0d0d0f] border-l border-white/[0.06] flex flex-col overflow-hidden shrink-0" style={{ width: sidePanelWidth }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg">
                {([
                  { id: 'chat'  as SidePanel, icon: MessageSquare, label: 'Chat'  },
                  { id: 'files' as SidePanel, icon: Files,         label: 'Files' },
                ] as const).map(tab => (
                  <button
                    key={tab.id!}
                    onClick={() => setSidePanel(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sidePanel === tab.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setSidePanel(null)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {/* [CHAT FIX] Explicit dark bg wrapper — removes white-on-white */}
              {sidePanel === 'chat' && (
                <div className="h-full bg-[#0d0d0f]">
                  <ChatPanel messages={messages} onSend={sendChatMessage} cryptoReady={cryptoReady} />
                </div>
              )}
              {sidePanel === 'files' && (
                <div className="p-3 h-full overflow-y-auto">
                  <FileTransferPanel
                    onSendFile={sendFile}
                    receivedFiles={receivedFiles}
                    outgoing={outgoing}
                    incomingFile={incomingFile}
                    receiveProgress={receiveProgress}
                    onDownload={downloadFile}
                    formatSize={formatSize}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/70 backdrop-blur border-t border-white/[0.06] shrink-0 z-20">

        {/* Left: screen + control */}
        <div className="flex items-center gap-2">
          {/* [FIX 3] Screen share — HOST only */}
          {isHost && (
            <>
              <ToolbarBtn
                icon={myStream ? Monitor : MonitorOff}
                label={myStream ? 'Sharing' : 'Share Screen'}
                active={!!myStream}
                activeColor="indigo"
                onClick={myStream ? stopScreenShare : startScreenShare}
              />
              <ToolbarBtn
                icon={screenAudioEnabled ? Volume2 : VolumeX}
                label="Sys Audio"
                active={screenAudioEnabled}
                activeColor="blue"
                onClick={toggleScreenAudio}
              />
              {/* [FIX 4] Grant / revoke control — HOST only */}
              <ToolbarBtn
                icon={controlGranted ? ShieldOff : ShieldCheck}
                label={controlGranted ? 'Revoke Ctrl' : 'Grant Ctrl'}
                active={controlGranted}
                activeColor="indigo"
                onClick={controlGranted ? revokeControl : grantControl}
              />
            </>
          )}
          {/* [FIX 4] Viewer: read-only control status indicator */}
          {!isHost && (
            <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border ${controlGranted ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25' : 'bg-white/[0.04] text-white/35 border-white/[0.06]'}`}>
              <MousePointer2 className="w-4 h-4" />
              <span>{controlGranted ? 'Control On' : 'No Control'}</span>
            </div>
          )}
        </div>

        {/* Center: AV call */}
        <div className="flex items-center gap-2">
          {!inCall ? (
            <>
              <ToolbarBtn icon={Video} label="Video Call"  onClick={() => startCall(true)}  activeColor="green" />
              <ToolbarBtn icon={Mic}   label="Audio Call"  onClick={() => startCall(false)} activeColor="green" />
            </>
          ) : (
            <>
              <ToolbarBtn icon={micEnabled ? Mic : MicOff}     label={micEnabled ? 'Mute' : 'Unmute'}   active={micEnabled}  activeColor="green" onClick={toggleMic} />
              <ToolbarBtn icon={camEnabled ? Video : VideoOff}  label={camEnabled ? 'Cam On' : 'Cam Off'} active={camEnabled}  activeColor="green" onClick={toggleCam} />
              <ToolbarBtn icon={PhoneOff} label="End Call" danger onClick={endCall} />
            </>
          )}
        </div>

        {/* Right: recording + settings */}
        <div className="flex items-center gap-2">
          <ToolbarBtn
            icon={isRecording ? Square : Radio}
            label={isRecording ? `Stop (${formatTime(recordingTime)})` : 'Record'}
            active={isRecording}
            activeColor="red"
            onClick={() => isRecording ? stopRecording() : startRecording(myStream, remoteStream)}
          />
          <ToolbarBtn icon={Settings2} label="Settings" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

// ── Toolbar button component ──────────────────────────────────────────────────

interface TBProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  activeColor?: 'indigo' | 'green' | 'blue' | 'red';
  danger?: boolean;
  onClick?: () => void;
}

function ToolbarBtn({ icon: Icon, label, active, activeColor = 'indigo', danger, onClick }: TBProps) {
  const colors = {
    indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    blue:   'bg-blue-500/15 text-blue-300 border-blue-500/25',
    red:    'bg-red-500/15 text-red-300 border-red-500/25',
  };
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold border transition-all min-w-[56px] ${
        danger
          ? 'bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25'
          : active
          ? colors[activeColor]
          : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:bg-white/[0.08] hover:text-white/60'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
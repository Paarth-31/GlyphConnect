import { useRef } from 'react';
import type { ReceivedFile, OutgoingTransfer, TransferringFile } from '../hooks/useFileTransfer';

interface Props {
  onSendFile: (file: File) => void;
  receivedFiles: ReceivedFile[];
  outgoing: OutgoingTransfer | null;
  incomingFile: TransferringFile | null;
  receiveProgress: number;
  onDownload: (file: ReceivedFile) => void;
  formatSize: (bytes: number) => string;
}

export const FileTransferPanel = ({
  onSendFile,
  receivedFiles,
  outgoing,
  incomingFile,
  receiveProgress,
  onDownload,
  formatSize,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSendFile(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3 bg-black/20 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-white text-sm font-semibold">File Transfer</span>

        {}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!!outgoing && !outgoing.done}
          className="flex items-center gap-2 bg-blue-600/80 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
        >
          📎 Send file
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {}
      {outgoing && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="truncate max-w-[70%]">
              ↑ {outgoing.name}
            </span>
            <span>{outgoing.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${outgoing.progress}%` }}
            />
          </div>
          {outgoing.done && (
            <span className="text-green-400 text-xs">✓ Sent successfully</span>
          )}
        </div>
      )}

      {}
      {incomingFile && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="truncate max-w-[70%]">
              ↓ {incomingFile.name} ({formatSize(incomingFile.size)})
            </span>
            <span>{receiveProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-200"
              style={{ width: `${receiveProgress}%` }}
            />
          </div>
        </div>
      )}

      {}
      {receivedFiles.length > 0 && (
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
          <span className="text-gray-500 text-xs">Received files</span>
          {receivedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-white text-xs truncate">{file.name}</span>
                <span className="text-gray-500 text-xs">{formatSize(file.size)}</span>
              </div>
              <button
                onClick={() => onDownload(file)}
                className="text-blue-400 hover:text-blue-300 text-xs font-semibold ml-3 shrink-0"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}

      {receivedFiles.length === 0 && !incomingFile && !outgoing && (
        <p className="text-gray-600 text-xs text-center py-2">
          No files transferred yet
        </p>
      )}
    </div>
  );
};
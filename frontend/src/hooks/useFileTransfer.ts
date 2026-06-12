import { useState, useCallback, useRef } from 'react';

export interface TransferringFile {
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  receivedChunks: ArrayBuffer[];
  receivedCount: number;
}

export interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  timestamp: Date;
}

export interface OutgoingTransfer {
  name: string;
  progress: number;
  done: boolean;
}

const CHUNK_SIZE = 16 * 1024;

export const useFileTransfer = (
  sendFileChunk: (data: string | ArrayBuffer) => void
) => {
  const [incomingFile, setIncomingFile] = useState<TransferringFile | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingTransfer | null>(null);
  const [receiveProgress, setReceiveProgress] = useState(0);
  const incomingRef = useRef<TransferringFile | null>(null);

  const handleFileChunk = useCallback((data: ArrayBuffer | string) => {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);

      if (msg.type === 'file-meta') {
        const newFile: TransferringFile = {
          name: msg.name,
          size: msg.size,
          mimeType: msg.mimeType,
          totalChunks: msg.totalChunks,
          receivedChunks: [],
          receivedCount: 0,
        };
        incomingRef.current = newFile;
        setIncomingFile(newFile);
        setReceiveProgress(0);
      }

      if (msg.type === 'file-complete') {
        const file = incomingRef.current;
        if (!file) return;
        const blob = new Blob(file.receivedChunks, { type: file.mimeType });
        const url = URL.createObjectURL(blob);
        const received: ReceivedFile = {
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          url,
          timestamp: new Date(),
        };
        setReceivedFiles(prev => [...prev, received]);
        setIncomingFile(null);
        setReceiveProgress(100);
        incomingRef.current = null;
      }
      return;
    }

    if (incomingRef.current) {
      incomingRef.current.receivedChunks.push(data);
      incomingRef.current.receivedCount++;
      const progress = Math.round(
        (incomingRef.current.receivedCount / incomingRef.current.totalChunks) * 100
      );
      setReceiveProgress(progress);
      setIncomingFile({ ...incomingRef.current });
    }
  }, []);

  const sendFile = useCallback(async (file: File) => {
    if (!file) return;
    setOutgoing({ name: file.name, progress: 0, done: false });

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      sendFileChunk(JSON.stringify({
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        totalChunks,
      }));

      const arrayBuffer = await file.arrayBuffer();
      let chunkIndex = 0;

      const sendNext = () => {
        return new Promise<void>((resolve) => {
          const pump = () => {
            if (chunkIndex >= totalChunks) {
              sendFileChunk(JSON.stringify({ type: 'file-complete' }));
              setOutgoing({ name: file.name, progress: 100, done: true });
              resolve();
              return;
            }
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            sendFileChunk(arrayBuffer.slice(start, end));
            chunkIndex++;
            setOutgoing({
              name: file.name,
              progress: Math.round((chunkIndex / totalChunks) * 100),
              done: false,
            });
            setTimeout(pump, 0);
          };
          pump();
        });
      };

      await sendNext();
    } catch (err) {
      console.error('File send failed:', err);
      setOutgoing(null);
    }
  }, [sendFileChunk]);

  const downloadFile = useCallback((file: ReceivedFile) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
  }, []);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    sendFile,
    handleFileChunk,
    incomingFile,
    receivedFiles,
    outgoing,
    receiveProgress,
    downloadFile,
    formatSize,
  };
};
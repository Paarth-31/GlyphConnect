import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Film, Play, Download, Trash2, Clock,
  Calendar, HardDrive, Search, Loader2, FolderOpen, RefreshCw
} from 'lucide-react';
import { recordingsApi, type RecordingFile } from '../services/api';

interface Props {
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return iso;
  }
}

function totalDuration(recordings: RecordingFile[]): string {
  const total = recordings.reduce((sum, r) => sum + (r.duration ?? 0), 0);
  return formatDuration(total);
}

function totalSize(recordings: RecordingFile[]): string {
  return formatBytes(recordings.reduce((sum, r) => sum + (r.size ?? 0), 0));
}

export function RecordingsPage({ onBack }: Props) {
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    recordingsApi.list()
      .then(setRecordings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = recordings.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (rec: RecordingFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${rec.name}"? This cannot be undone.`)) return;
    setDeleting(rec.id);
    const ok = await recordingsApi.delete(rec.path);
    if (ok) {
      setRecordings(rs => rs.filter(r => r.id !== rec.id));
      if (selected === rec.id) setSelected(null);
    }
    setDeleting(null);
  };

  const isElectron = !!(window as any).electronAPI;

  return (
    <div
      className="min-h-screen bg-[#0a0a0b] text-white flex flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-black/40">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-sm">Saved Recordings</span>
            {!loading && (
              <span className="text-[11px] text-white/25 font-mono ml-1">
                {recordings.length} file{recordings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 text-xs transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      <main className="flex-1 px-8 py-6 max-w-4xl mx-auto w-full">

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recordings..."
            className="w-full bg-[#111113] border border-white/[0.07] rounded-xl pl-10 pr-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 transition-all"
          />
        </div>

        {/* Stats bar */}
        {!loading && recordings.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { icon: Film,      label: 'Total recordings', value: recordings.length.toString(), color: 'text-rose-400' },
              { icon: HardDrive, label: 'Storage used',     value: totalSize(recordings),        color: 'text-amber-400' },
              { icon: Clock,     label: 'Total duration',   value: totalDuration(recordings),    color: 'text-blue-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111113] border border-white/[0.07] rounded-xl p-4 flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className="text-white font-bold text-lg">{stat.value}</p>
                  <p className="text-[11px] text-white/30">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading recordings...</span>
          </div>
        )}

        {/* Not in Electron */}
        {!loading && !isElectron && (
          <div className="flex flex-col items-center py-20 gap-3 text-white/20">
            <Film className="w-10 h-10 opacity-30" />
            <p className="text-sm">Recordings are only available in the desktop app</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && isElectron && recordings.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3 text-white/20">
            <FolderOpen className="w-10 h-10 opacity-30" />
            <p className="text-sm">No recordings yet</p>
            <p className="text-[11px]">Start a session and hit Record to save your first one</p>
          </div>
        )}

        {/* No search results */}
        {!loading && isElectron && recordings.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-2 text-white/20">
            <Film className="w-8 h-8 opacity-30" />
            <p className="text-sm">No recordings match "{search}"</p>
          </div>
        )}

        {/* Recordings list */}
        {!loading && isElectron && (
          <div className="flex flex-col gap-2">
            {filtered.map(rec => (
              <div
                key={rec.id}
                onClick={() => setSelected(s => s === rec.id ? null : rec.id)}
                className={`bg-[#111113] border rounded-xl p-4 cursor-pointer transition-all ${
                  selected === rec.id
                    ? 'border-indigo-500/40 bg-indigo-500/5'
                    : 'border-white/[0.07] hover:border-white/[0.15]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                    <Film className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white/90 text-sm truncate">{rec.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] text-white/30">
                        <Calendar className="w-3 h-3" /> {formatDate(rec.createdAt)}
                      </span>
                      {rec.duration > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-white/30">
                          <Clock className="w-3 h-3" /> {formatDuration(rec.duration)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-white/30">
                        <HardDrive className="w-3 h-3" /> {formatBytes(rec.size)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => recordingsApi.play(rec.path)}
                      title="Play"
                      className="p-2 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/10 transition-all"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => recordingsApi.export(rec.path)}
                      title="Export / Save as"
                      className="p-2 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => handleDelete(rec, e)}
                      disabled={deleting === rec.id}
                      title="Delete"
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      {deleting === rec.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
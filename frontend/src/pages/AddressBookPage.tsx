import { useState, useEffect, useCallback } from 'react';
import { favouritesApi, type Favourite } from '../services/api';
import {
  ChevronLeft, Book, Monitor, Star, Search, Plus,
  ArrowRight,Trash2, Edit3, Check, X,
  Loader2, AlertCircle, Clock,
} from 'lucide-react';

interface Props {
  onBack:    () => void;
  onConnect: (id: string) => void;
}

const LS_KEY = 'rda_address_book';

interface LocalContact { id: string; remote_id: string; label: string | null; created_at: string; last_used_at: string | null; use_count: number; }

function lsLoad(): LocalContact[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function lsSave(contacts: LocalContact[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(contacts));
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(dateStr).toLocaleDateString();
}

export function AddressBookPage({ onBack, onConnect }: Props) {
  const [contacts, setContacts]       = useState<(Favourite | LocalContact)[]>([]);
  const [loading, setLoading]         = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [useLocal, setUseLocal]       = useState(false); 
  const [search, setSearch]           = useState('');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editLabel, setEditLabel]     = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [newId, setNewId]             = useState('');
  const [newLabel, setNewLabel]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [addError, setAddError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setGlobalError(null);
    try {
      const data = await favouritesApi.list();
      setContacts(data);
      setUseLocal(false);
    } catch (err: any) {
      setUseLocal(true);
      setContacts(lsLoad());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contacts.filter(c =>
    (c.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
    c.remote_id.includes(search)
  );

  const validateId = (id: string): string | null => {
    const clean = id.trim().replace(/\s/g, '');
    if (!clean)           return 'Remote ID is required.';
    if (!/^\d{11}$/.test(clean)) return 'Remote ID must be exactly 11 digits.';
    if (contacts.some(c => c.remote_id === clean)) return 'Already in address book.';
    return null;
  };

  const addContact = async () => {
    setAddError(null);
    const clean = newId.trim().replace(/\s/g, '');
    const err = validateId(clean);
    if (err) { setAddError(err); return; }

    setSaving(true);
    if (useLocal) {
      const entry: LocalContact = {
        id: crypto.randomUUID(),
        remote_id: clean,
        label: newLabel.trim() || null,
        created_at: new Date().toISOString(),
        last_used_at: null,
        use_count: 0,
      };
      const updated = [entry, ...(lsLoad())];
      lsSave(updated);
      setContacts(updated);
      setNewId(''); setNewLabel(''); setShowAdd(false);
    } else {
      try {
        await favouritesApi.upsert(clean, newLabel.trim() || undefined);
        setNewId(''); setNewLabel(''); setShowAdd(false);
        await load();
      } catch (e: any) {
        setAddError(e.message ?? 'Failed to add contact.');
      }
    }
    setSaving(false);
  };

  const saveEdit = async (c: Favourite | LocalContact) => {
    if (useLocal) {
      const updated = lsLoad().map(x => x.id === c.id ? { ...x, label: editLabel.trim() || null } : x);
      lsSave(updated); setContacts(updated);
    } else {
      try {
        await favouritesApi.upsert((c as Favourite).remote_id, editLabel.trim() || undefined);
        await load();
      } catch (e: any) { setGlobalError(e.message); }
    }
    setEditingId(null);
  };

  const deleteContact = async (c: Favourite | LocalContact) => {
    setContacts(prev => prev.filter(x => x.id !== c.id));
    if (useLocal) {
      lsSave(lsLoad().filter(x => x.id !== c.id));
    } else {
      try { await favouritesApi.delete(c.id); }
      catch (e: any) { setGlobalError(e.message); await load(); }
    }
  };

  const handleConnect = (c: Favourite | LocalContact) => {
    if (useLocal) {
      const updated = lsLoad().map(x => x.id === c.id
        ? { ...x, last_used_at: new Date().toISOString(), use_count: (x.use_count || 0) + 1 }
        : x);
      lsSave(updated);
    } else {
      favouritesApi.bump(c.remote_id).catch(() => {});
    }
    onConnect(c.remote_id);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-black/40 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Book className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">Address Book</span>
            {!loading && (
              <span className="text-[11px] text-white/25 font-mono ml-1">
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </span>
            )}
            {useLocal && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-semibold">
                Local
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(v => !v); setAddError(null); setNewId(''); setNewLabel(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold border border-indigo-500/20 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </header>

      <main className="flex-1 px-6 py-5 max-w-3xl mx-auto w-full">

        {}
        {showAdd && (
          <div className="bg-[#111113] border border-indigo-500/20 rounded-xl p-4 mb-5">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">New Contact</p>
            <div className="flex gap-3 flex-wrap">
              <input
                value={newId}
                onChange={e => { setNewId(e.target.value.replace(/\D/g, '')); setAddError(null); }}
                onKeyDown={e => e.key === 'Enter' && addContact()}
                placeholder="11-digit Remote ID"
                maxLength={11}
                className="flex-1 min-w-[160px] bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
              />
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addContact()}
                placeholder="Label (optional)"
                className="flex-1 min-w-[140px] bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
              />
              <button onClick={addContact} disabled={saving || !newId.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold transition-all flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
              <button onClick={() => setShowAdd(false)}
                className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            {addError && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {addError}
              </p>
            )}
          </div>
        )}

        {}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by label or ID…"
            className="w-full bg-[#111113] border border-white/[0.07] rounded-xl pl-10 pr-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 transition-all"
          />
        </div>

        {}
        {globalError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {globalError}
            <button onClick={() => setGlobalError(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-white/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading contacts…</span>
          </div>
        )}

        {}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3 text-white/20">
            <Book className="w-12 h-12 opacity-25" />
            <p className="text-sm">{search ? 'No contacts match your search' : 'No contacts saved yet'}</p>
            {!search && (
              <button onClick={() => setShowAdd(true)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" /> Add your first contact
              </button>
            )}
          </div>
        )}

        {}
        <div className="flex flex-col gap-2">
          {filtered.map(c => (
            <div key={c.id}
              className="group bg-[#111113] hover:bg-[#161618] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 transition-all">
              <div className="flex items-center gap-4">
                {}
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white/25" />
                  </div>
                  <Star className="absolute -top-1 -right-1 w-3 h-3 text-amber-400 fill-amber-400" />
                </div>

                {}
                <div className="flex-1 min-w-0">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(c); if (e.key === 'Escape') setEditingId(null); }}
                        className="bg-black/50 border border-indigo-500/40 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(c)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-white/30 hover:bg-white/10 rounded">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-semibold text-sm text-white/80 truncate">
                      {c.label || `${c.remote_id.slice(0,3)} ${c.remote_id.slice(3,6)} ${c.remote_id.slice(6,9)} ${c.remote_id.slice(9)}`}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-[11px] text-white/25">
                      {c.remote_id.slice(0,3)}-{c.remote_id.slice(3,6)}-{c.remote_id.slice(6,9)}-{c.remote_id.slice(9)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-white/25">
                      <Clock className="w-3 h-3" />{timeAgo(c.last_used_at)}
                    </span>
                    <span className="text-[11px] text-white/20">
                      {c.use_count} session{c.use_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(c.id); setEditLabel(c.label ?? ''); }}
                    title="Rename"
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/10 transition-all">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteContact(c)}
                    title="Remove"
                    className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {}
                <button
                  onClick={() => handleConnect(c)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition-all ml-1 shrink-0">
                  Connect <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// frontend/src/pages/AddressBookPage.tsx
//
// [FIX 5] Address book — fully working addContact and deleteContact:
//   - addContact: calls favouritesApi.upsert(remoteId, label). On success the
//     list is refreshed so the new entry appears immediately.
//   - deleteContact: calls favouritesApi.delete(id). On success the entry is
//     removed from local state immediately (optimistic) and the list refreshed.
//   - saveEdit: calls favouritesApi.upsert(remoteId, newLabel) to rename.
//   - Inline error messages are shown for every API failure.
//   - Validation: remote ID must be exactly 11 digits (matches the app ID format).

import { useState, useEffect } from 'react';
import { favouritesApi, type Favourite } from '../services/api';
import {
  ChevronLeft, Book, Monitor, Star, Search, Plus,
  ArrowRight, Wifi, Trash2, Edit3, Check, X, Loader2, AlertCircle
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onConnect: (id: string) => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never used';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

export function AddressBookPage({ onBack, onConnect }: Props) {
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editLabel, setEditLabel]   = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRemoteId, setNewRemoteId] = useState('');
  const [newLabel, setNewLabel]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [addError, setAddError]     = useState<string | null>(null);

  // ── Load contacts from API ────────────────────────────────────────────────
  const load = () => {
    setLoading(true);
    setError(null);
    favouritesApi.list()
      .then(setFavourites)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = favourites.filter(f =>
    (f.label ?? '').toLowerCase().includes(search.toLowerCase()) ||
    f.remote_id.includes(search)
  );

  // ── [FIX 5] addContact: validates ID, calls API, refreshes list ───────────
  const addContact = async () => {
    setAddError(null);
    const id = newRemoteId.trim().replace(/\s/g, '');

    if (!id) {
      setAddError('Remote ID is required.');
      return;
    }
    if (!/^\d{11}$/.test(id)) {
      setAddError('Remote ID must be exactly 11 digits.');
      return;
    }
    if (favourites.some(f => f.remote_id === id)) {
      setAddError('This ID is already in your address book.');
      return;
    }

    setSaving(true);
    try {
      await favouritesApi.upsert(id, newLabel.trim() || undefined);
      setNewRemoteId('');
      setNewLabel('');
      setShowAddForm(false);
      load(); // Refresh to show the new entry
    } catch (e: any) {
      setAddError(e.message ?? 'Failed to add contact.');
    } finally {
      setSaving(false);
    }
  };

  // ── [FIX 5] saveEdit: renames a contact via API ────────────────────────────
  const saveEdit = async (fav: Favourite) => {
    try {
      await favouritesApi.upsert(fav.remote_id, editLabel.trim() || undefined);
      setEditingId(null);
      load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to rename contact.');
    }
  };

  // ── [FIX 5] deleteContact: removes via API with optimistic local update ───
  const deleteContact = async (fav: Favourite) => {
    // Optimistic removal so the UI feels instant
    setFavourites(fs => fs.filter(f => f.id !== fav.id));
    try {
      await favouritesApi.delete(fav.id);
    } catch (e: any) {
      // Rollback on failure
      setError(e.message ?? 'Failed to delete contact.');
      load();
    }
  };

  const handleConnect = (remoteId: string) => {
    // Bump use_count in background (fire-and-forget)
    // [FIX 5] Use bump() on connect — increments use_count + last_used_at
    favouritesApi.bump(remoteId).catch(() => {});
    onConnect(remoteId);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-black/40">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Book className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-sm">Address Book</span>
            {!loading && (
              <span className="text-[11px] text-white/25 font-mono ml-1">{favourites.length} saved</span>
            )}
          </div>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setAddError(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold border border-indigo-500/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </header>

      <main className="flex-1 px-8 py-6 max-w-3xl mx-auto w-full">

        {/* ── [FIX 5] Add contact form with validation ──────────────────── */}
        {showAddForm && (
          <div className="bg-[#111113] border border-indigo-500/20 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold mb-3 text-white/70">Add new contact</p>
            <div className="flex gap-3 flex-wrap">
              <input
                placeholder="Remote ID (11 digits)"
                value={newRemoteId}
                onChange={e => { setNewRemoteId(e.target.value.replace(/\s/g, '')); setAddError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') addContact(); }}
                maxLength={11}
                className="flex-1 min-w-[160px] bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40"
              />
              <input
                placeholder="Label (optional)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addContact(); }}
                className="flex-1 min-w-[140px] bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40"
              />
              <button
                onClick={addContact}
                disabled={saving || !newRemoteId.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Add
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {addError && (
              <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{addError}
              </p>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by label or ID..."
            className="w-full bg-[#111113] border border-white/[0.07] rounded-xl pl-10 pr-4 py-3 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/40 transition-all"
          />
        </div>

        {/* Global error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
            <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-red-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-white/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        )}

        {!loading && !filtered.length && (
          <div className="flex flex-col items-center py-16 gap-2 text-white/20">
            <Book className="w-10 h-10 opacity-30" />
            <p className="text-sm">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
            {!search && (
              <p className="text-[11px]">Click "Add Contact" above to save a remote ID</p>
            )}
          </div>
        )}

        {/* Contact list */}
        <div className="flex flex-col gap-2">
          {filtered.map(fav => (
            <div
              key={fav.id}
              className="group bg-[#111113] hover:bg-[#161618] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-white/25" />
                  </div>
                  <Star className="absolute -top-1 -right-1 w-3 h-3 text-amber-400 fill-amber-400" />
                </div>

                <div className="flex-1 min-w-0">
                  {editingId === fav.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(fav);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="bg-black/50 border border-indigo-500/40 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveEdit(fav)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-all">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-white/30 hover:bg-white/10 rounded transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-semibold text-sm text-white/80">
                      {fav.label || `${fav.remote_id.slice(0,3)} ${fav.remote_id.slice(3,6)} ${fav.remote_id.slice(6,9)} ${fav.remote_id.slice(9)}`}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-[11px] text-white/25">
                      {fav.remote_id.slice(0,3)} {fav.remote_id.slice(3,6)} {fav.remote_id.slice(6,9)} {fav.remote_id.slice(9)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-white/25">
                      <Wifi className="w-3 h-3" />{timeAgo(fav.last_used_at)}
                    </span>
                    <span className="text-[11px] text-white/20">
                      {fav.use_count} session{fav.use_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingId(fav.id); setEditLabel(fav.label ?? ''); }}
                    title="Rename"
                    className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/10 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {/* [FIX 5] deleteContact wired to real API call */}
                  <button
                    onClick={() => deleteContact(fav)}
                    title="Remove from address book"
                    className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => handleConnect(fav.remote_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition-all ml-1"
                >
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

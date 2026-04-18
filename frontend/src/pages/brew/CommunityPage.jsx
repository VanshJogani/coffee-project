import React, { useEffect, useState } from "react";
import { fetchBrewNotes, createBrewNote, deleteBrewNote, fetchBrewLogs, fetchProducts } from "../../api/client";

// ─── Shared brew log card ─────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }
function fmtTime(sec) { return sec ? `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}` : null; }
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Stars({ value }) {
  return (
    <span className="text-xs">
      {[1,2,3,4,5].map(n => (
        <span key={n} className={n <= value ? "text-luxury-gold" : "text-luxury-clay/20"}>★</span>
      ))}
    </span>
  );
}

function SharedBrewCard({ log }) {
  const ratio = log.coffeeGrams && log.waterGrams
    ? (log.waterGrams / log.coffeeGrams).toFixed(1) : null;
  return (
    <div className="bg-luxury-stone/30 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {log.brewerName && <span className="text-xs font-semibold text-luxury-umber">{log.brewerName}</span>}
          {ratio && <span className="text-[11px] text-luxury-clay">1:{ratio}</span>}
          {log.brewTimeSec && <span className="text-[11px] text-luxury-clay">{fmtTime(log.brewTimeSec)}</span>}
        </div>
        {log.rating > 0 && <Stars value={log.rating} />}
      </div>
      {log.notes && <p className="text-xs text-luxury-clay leading-relaxed">{log.notes}</p>}
      <div className="text-[10px] text-luxury-clay/50">{fmtDate(log.createdAt)}</div>
    </div>
  );
}

// ─── Discussion note card ─────────────────────────────────────────────────────
function NoteCard({ note, onDelete, canDelete }) {
  return (
    <div className="bg-white border border-luxury-clay/10 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-luxury-umber/10 flex items-center justify-center text-xs font-bold text-luxury-umber">
            {note.authorName?.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-luxury-umber">{note.authorName}</span>
          <span className="text-[10px] text-luxury-clay/50">{fmtDate(note.createdAt)}</span>
        </div>
        {canDelete && (
          <button type="button" onClick={() => onDelete(note.id)}
            className="text-red-300 hover:text-red-500 text-xs shrink-0 transition-colors">✕</button>
        )}
      </div>
      <p className="text-sm text-luxury-clay leading-relaxed mt-2">{note.body}</p>
      {note.brewerName && (
        <div className="mt-2 text-[10px] text-luxury-clay/60">
          Brew: {note.brewerName}
          {note.brewRating > 0 && <span className="ml-1">— {note.brewRating}★</span>}
        </div>
      )}
    </div>
  );
}

// ─── Bean Community Page ──────────────────────────────────────────────────────
export function BeanCommunityPage({ product, onBack }) {
  const [notes, setNotes] = useState([]);
  const [sharedLogs, setSharedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("communityName") || "");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [n, l] = await Promise.all([
        fetchBrewNotes(product.id),
        fetchBrewLogs({ productId: product.id, isPublic: 1 }),
      ]);
      setNotes(n);
      setSharedLogs(l);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [product.id]);

  const handlePost = async () => {
    setPostError("");
    if (!authorName.trim()) { setPostError("Please enter your name."); return; }
    if (body.trim().length < 3) { setPostError("Note is too short."); return; }
    setPosting(true);
    try {
      localStorage.setItem("communityName", authorName.trim());
      await createBrewNote({ productId: product.id, authorName: authorName.trim(), body: body.trim() });
      setBody("");
      await loadData();
    } catch { setPostError("Failed to post. Try again."); }
    finally { setPosting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this note?")) return;
    await deleteBrewNote(id);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button type="button" onClick={onBack}
        className="flex items-center gap-2 text-sm text-luxury-clay hover:text-luxury-umber transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search
      </button>

      {/* Bean info strip */}
      <div className="premium-card p-5 flex items-start gap-4">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-luxury-gold/10 border border-luxury-gold/20 flex items-center justify-center text-2xl shrink-0">☕</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold">{product.roaster}</div>
          <div className="font-bold text-luxury-umber text-lg leading-snug">{product.name}</div>
          {product.tastingNotes && (
            <div className="text-xs text-luxury-clay mt-1 line-clamp-2">{product.tastingNotes}</div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-luxury-clay text-sm">Loading community data…</div>
      ) : (
        <>
          {/* Shared brew logs */}
          {sharedLogs.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">
                Shared Brews ({sharedLogs.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sharedLogs.map(l => <SharedBrewCard key={l.id} log={l} />)}
              </div>
            </section>
          )}

          {/* Discussion thread */}
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-luxury-gold mb-3">
              Discussion ({notes.length})
            </h3>

            {/* Post form */}
            <div className="premium-card p-4 space-y-3 mb-4">
              <input type="text" value={authorName} onChange={e => setAuthorName(e.target.value)}
                placeholder="Your name *"
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold" />
              <textarea rows={3} value={body} onChange={e => setBody(e.target.value)}
                placeholder="Share your experience brewing this bean…"
                className="w-full rounded-lg border border-luxury-clay/40 px-3 py-2 text-sm focus:outline-none focus:border-luxury-gold resize-none" />
              {postError && <p className="text-xs text-red-500">{postError}</p>}
              <button type="button" onClick={handlePost} disabled={posting}
                className="w-full py-2.5 bg-luxury-umber text-white text-sm font-bold rounded-xl hover:bg-luxury-dark transition-colors disabled:opacity-50">
                {posting ? "Posting…" : "Post Note"}
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="py-8 text-center text-luxury-clay/60 text-sm">
                No discussion yet — be the first to share a note!
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map(n => (
                  <NoteCard key={n.id} note={n} onDelete={handleDelete} canDelete={true} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Community Search Page ────────────────────────────────────────────────────
function CommunityPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const data = await fetchProducts({ search, limit: 20, category: "Coffee" });
        setResults(data.data || []);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  if (selectedProduct) {
    return <BeanCommunityPage product={selectedProduct} onBack={() => setSelectedProduct(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-luxury-umber">Community</h2>
        <p className="text-sm text-luxury-clay mt-0.5">Find a bean and explore brew notes from the community</p>
      </div>

      <div className="relative">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search beans — Blue Tokai, Araku, natural, light roast…"
          className="w-full rounded-xl border border-luxury-clay/40 px-4 py-3 text-sm focus:outline-none focus:border-luxury-gold pr-10" />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-luxury-clay/60 text-xs">…</div>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => setSelectedProduct(p)}
              className="w-full premium-card p-4 flex items-center gap-4 text-left hover:bg-luxury-stone/20 transition-colors">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-luxury-gold/10 flex items-center justify-center text-xl shrink-0">☕</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-luxury-gold">{p.roaster}</div>
                <div className="font-semibold text-sm text-luxury-umber">{p.name}</div>
                {p.tastingNotes && (
                  <div className="text-[11px] text-luxury-clay truncate mt-0.5">{p.tastingNotes}</div>
                )}
              </div>
              <svg className="w-4 h-4 text-luxury-clay/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {search.trim() && !searching && results.length === 0 && (
        <div className="text-center py-12 text-luxury-clay/60 text-sm">No beans found for "{search}".</div>
      )}

      {!search.trim() && (
        <div className="py-16 text-center">
          <div className="text-5xl mb-4">🌐</div>
          <div className="font-bold text-luxury-umber mb-1">Community brew notes</div>
          <div className="text-sm text-luxury-clay">Search for any bean in the catalog to see and share brew experiences.</div>
        </div>
      )}
    </div>
  );
}

export default CommunityPage;

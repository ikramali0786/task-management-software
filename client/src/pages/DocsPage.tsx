import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText, Plus, ChevronRight, ChevronDown, Trash2, Eye, Pencil,
  Loader2, Check, BookText, Clock, Search, X, Share2, Link2, LayoutTemplate, GripVertical,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getSocket } from '@/lib/socket';
import { docService, type DocNode, type DocFull, type DocSearchResult } from '@/services/docService';
import { DOC_TEMPLATES, type DocTemplate } from '@/lib/docTemplates';
import { formatRelative, cn } from '@/lib/utils';

const EMOJIS = ['📄', '📝', '📚', '📋', '📌', '🗂️', '🧭', '💡', '🚀', '🎯', '🛠️', '🐛', '✅', '⭐', '🔒', '📊', '🧪', '🎨', '🤝', '🔔'];

// Markdown → styled elements (no typography plugin needed).
const md = {
  h1: (p: any) => <h1 className="mb-3 mt-6 text-2xl font-bold text-slate-900 first:mt-0 dark:text-slate-100" {...p} />,
  h2: (p: any) => <h2 className="mb-2 mt-6 text-xl font-bold text-slate-900 first:mt-0 dark:text-slate-100" {...p} />,
  h3: (p: any) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900 dark:text-slate-100" {...p} />,
  p: (p: any) => <p className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300" {...p} />,
  ul: (p: any) => <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-700 dark:text-slate-300" {...p} />,
  ol: (p: any) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-slate-700 dark:text-slate-300" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...p} />,
  a: (p: any) => <a className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400" target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p: any) => <blockquote className="mb-3 border-l-2 border-brand-300 pl-3 italic text-slate-500" {...p} />,
  code: ({ inline, ...p }: any) => inline
    ? <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-brand-600 dark:bg-slate-800 dark:text-brand-400" {...p} />
    : <code className="font-mono text-sm" {...p} />,
  pre: (p: any) => <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100 dark:bg-slate-800" {...p} />,
  hr: () => <hr className="my-4 border-slate-200 dark:border-slate-700" />,
  table: (p: any) => <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
  th: (p: any) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold dark:border-slate-700 dark:bg-slate-800" {...p} />,
  td: (p: any) => <td className="border border-slate-200 px-2 py-1 dark:border-slate-700" {...p} />,
  input: (p: any) => <input className="mr-1 accent-brand-500" disabled {...p} />,
};

export const DocsPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { showConfirm, addToast } = useUIStore();
  const { can } = usePermissions();
  const { docId } = useParams();
  const navigate = useNavigate();

  const currentMember = activeTeam?.members.find((m: any) => (m.user?._id || m.user) === user?._id);
  const canEdit = can('commentOnTasks') && !currentMember?.isGuest;

  const [docs, setDocs] = useState<DocNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [active, setActive] = useState<DocFull | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('preview');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [iconPicker, setIconPicker] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [newMenu, setNewMenu] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [drag, setDrag] = useState<{ id: string; over: string | null; zone: 'before' | 'inside' | 'after' | null }>({ id: '', over: null, zone: null });

  const skipSaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const activeIdRef = useRef<string | null>(null); activeIdRef.current = active?._id ?? null;

  // ── Load the tree ──────────────────────────────────────────────────────────
  const loadTree = async (teamId: string) => {
    try { setDocs(await docService.list(teamId)); } catch { /* surfaced as empty */ }
  };
  useEffect(() => {
    if (!activeTeam) { setTreeLoading(false); return; }
    let active = true; setTreeLoading(true);
    docService.list(activeTeam._id).then((d) => { if (active) setDocs(d); }).catch(() => {}).finally(() => { if (active) setTreeLoading(false); });
    return () => { active = false; };
  }, [activeTeam?._id]);

  // ── Load the open doc when the route id changes ────────────────────────────
  useEffect(() => {
    if (!docId) { setActive(null); return; }
    let alive = true; setDocLoading(true); dirtyRef.current = false;
    docService.get(docId)
      .then((d) => { if (!alive) return; skipSaveRef.current = true; setActive(d); setTitle(d.title); setIcon(d.icon || '📄'); setContent(d.content || ''); setMode(d.content ? 'preview' : 'write'); })
      .catch(() => { if (alive) { setActive(null); navigate('/app/docs', { replace: true }); } })
      .finally(() => { if (alive) setDocLoading(false); });
    return () => { alive = false; };
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick the first doc if none is open.
  useEffect(() => {
    if (!treeLoading && !docId && docs.length) navigate(`/app/docs/${docs[0]._id}`, { replace: true });
  }, [treeLoading, docId, docs, navigate]);

  // ── Autosave (debounced) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !canEdit) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    dirtyRef.current = true; setSaving('saving');
    const id = active._id;
    const h = setTimeout(async () => {
      try {
        await docService.update(id, { title, icon, content });
        dirtyRef.current = false; setSaving('saved'); setTimeout(() => setSaving((s) => (s === 'saved' ? 'idle' : s)), 1200);
        setDocs((ds) => ds.map((d) => (d._id === id ? { ...d, title: title || 'Untitled', icon, updatedAt: new Date().toISOString() } : d)));
      } catch { setSaving('idle'); }
    }, 700);
    return () => clearTimeout(h);
  }, [title, icon, content, active?._id, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live updates ───────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket(); if (!socket || !activeTeam) return;
    const onChange = (p: { teamId: string; docId?: string }) => {
      if (p.teamId !== activeTeam._id) return;
      loadTree(activeTeam._id);
      // Refresh the open doc only if a teammate changed it and we're not mid-edit.
      if (p.docId && p.docId === activeIdRef.current && !dirtyRef.current) {
        docService.get(p.docId).then((d) => { skipSaveRef.current = true; setActive(d); setTitle(d.title); setIcon(d.icon || '📄'); setContent(d.content || ''); }).catch(() => {});
      }
    };
    socket.on('doc:changed', onChange);
    return () => { socket.off('doc:changed', onChange); };
  }, [activeTeam?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search (debounced) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTeam) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const h = setTimeout(() => {
      docService.search(activeTeam._id, q).then(setResults).catch(() => setResults([])).finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(h);
  }, [query, activeTeam?._id]);

  // ── Tree helpers ───────────────────────────────────────────────────────────
  const childrenOf = useMemo(() => {
    const m = new Map<string, DocNode[]>();
    for (const d of docs) { const p = d.parent || 'root'; if (!m.has(p)) m.set(p, []); m.get(p)!.push(d); }
    for (const arr of m.values()) arr.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
    return m;
  }, [docs]);

  const breadcrumb = useMemo(() => {
    if (!active) return [] as DocNode[];
    const byId = new Map(docs.map((d) => [d._id, d]));
    const chain: DocNode[] = []; let cur: DocNode | undefined = byId.get(active._id);
    while (cur) { chain.unshift(cur); cur = cur.parent ? byId.get(cur.parent) : undefined; }
    return chain;
  }, [active, docs]);

  const createDoc = async (parent: string | null, tpl?: DocTemplate) => {
    if (!activeTeam || !canEdit) return;
    setNewMenu(false);
    try {
      const d = await docService.create(activeTeam._id, tpl ? { parent, title: tpl.title, icon: tpl.icon, content: tpl.content } : { parent });
      setDocs((ds) => [...ds, d]);
      if (parent) setExpanded((e) => new Set(e).add(parent));
      navigate(`/app/docs/${d._id}`);
    } catch { addToast({ type: 'error', title: 'Could not create page' }); }
  };

  // ── Drag to reorder / move (native HTML5 DnD) ──────────────────────────────
  const isAncestor = (ancestorId: string, nodeId: string) => {
    const byId = new Map(docs.map((d) => [d._id, d]));
    let cur = byId.get(nodeId);
    while (cur?.parent) { if (cur.parent === ancestorId) return true; cur = byId.get(cur.parent); }
    return false;
  };
  const onDropNode = async (target: DocNode, zone: 'before' | 'inside' | 'after') => {
    const id = drag.id; setDrag({ id: '', over: null, zone: null });
    if (!id || !canEdit || id === target._id || isAncestor(id, target._id)) return;
    let parent: string | null; let position: number;
    if (zone === 'inside') {
      parent = target._id;
      const kids = childrenOf.get(target._id) || [];
      position = kids.length ? kids[kids.length - 1].position + 1 : 0;
      setExpanded((e) => new Set(e).add(target._id));
    } else {
      parent = target.parent;
      const sibs = (childrenOf.get(target.parent || 'root') || []).filter((s) => s._id !== id);
      const ti = sibs.findIndex((s) => s._id === target._id);
      const at = zone === 'before' ? ti : ti + 1;
      const prev = sibs[at - 1]; const next = sibs[at];
      position = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1 : next ? next.position - 1 : 0;
    }
    setDocs((ds) => ds.map((d) => (d._id === id ? { ...d, parent, position } : d)));
    try { await docService.update(id, { parent, position }); } catch { if (activeTeam) loadTree(activeTeam._id); }
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const shareUrl = active?.publicToken ? `${window.location.origin}/d/${active.publicToken}` : '';
  const toggleShare = async () => {
    if (!active) return; setShareBusy(true);
    try {
      const r = active.isPublic ? await docService.disableShare(active._id) : await docService.enableShare(active._id);
      setActive((a) => (a ? { ...a, isPublic: r.isPublic, publicToken: r.publicToken } : a));
    } catch { addToast({ type: 'error', title: 'Could not update sharing' }); }
    finally { setShareBusy(false); }
  };
  const copyText = (text: string, title: string) => { navigator.clipboard.writeText(text).then(() => addToast({ type: 'success', title })).catch(() => {}); };

  const deleteDoc = async (id: string) => {
    if (!canEdit) return;
    const hasKids = (childrenOf.get(id)?.length ?? 0) > 0;
    const ok = await showConfirm({ title: 'Delete this page?', message: hasKids ? 'This page and all of its sub-pages will be deleted for the whole team.' : 'This page will be deleted for the whole team.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await docService.remove(id);
      const next = activeTeam ? await docService.list(activeTeam._id) : [];
      setDocs(next);
      if (activeIdRef.current === id || !next.find((d) => d._id === activeIdRef.current)) {
        navigate(next.length ? `/app/docs/${next[0]._id}` : '/app/docs', { replace: true });
        if (!next.length) setActive(null);
      }
    } catch { addToast({ type: 'error', title: 'Could not delete page' }); }
  };

  if (!activeTeam) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-slate-500">Select a team to open Docs.</div>;

  const renderNode = (nodeDoc: DocNode, depth: number): JSX.Element => {
    const kids = childrenOf.get(nodeDoc._id) || [];
    const isOpen = expanded.has(nodeDoc._id);
    const isActive = active?._id === nodeDoc._id;
    const isOver = drag.over === nodeDoc._id;
    return (
      <div key={nodeDoc._id}>
        <div
          draggable={canEdit}
          onDragStart={(e) => { if (!canEdit) return; setDrag({ id: nodeDoc._id, over: null, zone: null }); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { if (!canEdit || !drag.id || drag.id === nodeDoc._id) return; e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const y = e.clientY - r.top; const zone = y < r.height * 0.28 ? 'before' : y > r.height * 0.72 ? 'after' : 'inside'; if (drag.over !== nodeDoc._id || drag.zone !== zone) setDrag((d) => ({ ...d, over: nodeDoc._id, zone })); }}
          onDragLeave={() => { if (drag.over === nodeDoc._id) setDrag((d) => ({ ...d, over: null, zone: null })); }}
          onDrop={(e) => { e.preventDefault(); if (drag.zone) onDropNode(nodeDoc, drag.zone); }}
          onDragEnd={() => setDrag({ id: '', over: null, zone: null })}
          className={cn('group relative flex items-center gap-1 rounded-lg pr-1 transition-colors', isActive ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800', isOver && drag.zone === 'inside' && 'ring-2 ring-inset ring-brand-400')}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          {isOver && drag.zone === 'before' && <div className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-brand-400" />}
          {isOver && drag.zone === 'after' && <div className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded bg-brand-400" />}
          <button onClick={() => setExpanded((e) => { const n = new Set(e); n.has(nodeDoc._id) ? n.delete(nodeDoc._id) : n.add(nodeDoc._id); return n; })} className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200', !kids.length && 'invisible')} aria-label={isOpen ? 'Collapse' : 'Expand'}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => navigate(`/app/docs/${nodeDoc._id}`)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left">
            <span className="shrink-0 text-sm leading-none">{nodeDoc.icon || '📄'}</span>
            <span className={cn('truncate text-sm', isActive ? 'font-medium text-brand-700 dark:text-brand-300' : 'text-slate-600 dark:text-slate-300')}>{nodeDoc.title || 'Untitled'}</span>
          </button>
          {canEdit && (
            <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
              <button onClick={() => createDoc(nodeDoc._id)} title="Add sub-page" className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"><Plus className="h-3.5 w-3.5" /></button>
              <button onClick={() => deleteDoc(nodeDoc._id)} title="Delete" className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
              <GripVertical className="h-3.5 w-3.5 cursor-grab text-slate-300 dark:text-slate-600" />
            </div>
          )}
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf.get('root') || [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-white dark:bg-slate-950">
      {/* Tree sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><BookText className="h-4 w-4 text-brand-500" /> Docs</span>
          {canEdit && (
            <div className="relative">
              <button onClick={() => setNewMenu((v) => !v)} title="New page" className="flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400"><Plus className="h-3.5 w-3.5" /> New</button>
              {newMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setNewMenu(false)} />
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><LayoutTemplate className="h-3 w-3" /> Templates</div>
                    {DOC_TEMPLATES.map((t) => (
                      <button key={t.id} onClick={() => createDoc(null, t)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">
                        <span className="text-base leading-none">{t.icon}</span> {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {/* Search */}
        <div className="relative border-b border-slate-100 px-2 py-2 dark:border-slate-800">
          <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-7 text-sm outline-none focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800" />
          {query && <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {query.trim() ? (
            searching ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
            ) : results.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">No pages match “{query.trim()}”.</p>
            ) : results.map((r) => (
              <button key={r._id} onClick={() => navigate(`/app/docs/${r._id}`)} className={cn('mb-0.5 flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition-colors', active?._id === r._id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
                <span className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200"><span className="shrink-0 leading-none">{r.icon || '📄'}</span><span className="truncate">{r.title || 'Untitled'}</span></span>
                {r.snippet && <span className="mt-0.5 line-clamp-2 pl-5 text-[11px] text-slate-400">{r.snippet}</span>}
              </button>
            ))
          ) : treeLoading ? (
            <div className="space-y-1.5">{[1, 2, 3, 4].map((i) => <div key={i} className="h-7 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
          ) : roots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
              <FileText className="h-7 w-7 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400">No pages yet</p>
              {canEdit && <button onClick={() => createDoc(null)} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Create the first page</button>}
            </div>
          ) : roots.map((r) => renderNode(r, 0))}
        </div>
      </aside>

      {/* Editor / viewer */}
      <main className="flex min-w-0 flex-1 flex-col">
        {docLoading ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : !active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-2xl bg-slate-100 p-5 dark:bg-slate-800"><BookText className="h-8 w-8 text-slate-400" /></div>
            <p className="text-sm font-medium text-slate-500">{canEdit ? 'Create a page to start your team wiki' : 'No pages yet'}</p>
            {canEdit && <button onClick={() => createDoc(null)} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">New page</button>}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-2.5 dark:border-slate-800">
              <nav className="flex min-w-0 items-center gap-1 text-xs text-slate-400">
                {breadcrumb.map((b, i) => (
                  <span key={b._id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3" />}
                    <button onClick={() => navigate(`/app/docs/${b._id}`)} className={cn('truncate hover:text-slate-600 dark:hover:text-slate-300', b._id === active._id && 'font-medium text-slate-600 dark:text-slate-300')}>{b.icon} {b.title || 'Untitled'}</button>
                  </span>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-2">
                {saving === 'saving' ? <span className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
                  : saving === 'saved' ? <span className="flex items-center gap-1 text-xs text-slate-400"><Check className="h-3 w-3 text-emerald-500" /> Saved</span> : null}
                {canEdit && (
                  <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    <button onClick={() => setMode('write')} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium', mode === 'write' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}><Pencil className="h-3 w-3" /> Write</button>
                    <button onClick={() => setMode('preview')} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium', mode === 'preview' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}><Eye className="h-3 w-3" /> Preview</button>
                  </div>
                )}
                {!canEdit && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800"><Eye className="h-3 w-3" /> View only</span>}
                {canEdit && <button onClick={() => setShareOpen(true)} title="Share page" className={cn('rounded-lg p-1.5 transition-colors', active.isPublic ? 'text-brand-500 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}><Share2 className="h-4 w-4" /></button>}
                {canEdit && <button onClick={() => deleteDoc(active._id)} title="Delete page" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>

            {/* Title + icon */}
            <div className="px-5 pt-6 sm:px-10">
              <div className="mx-auto max-w-3xl">
                <div className="mb-2 flex items-start gap-3">
                  <div className="relative">
                    <button onClick={() => canEdit && setIconPicker((v) => !v)} className="text-4xl leading-none transition-transform hover:scale-110" title={canEdit ? 'Change icon' : undefined}>{icon}</button>
                    {iconPicker && canEdit && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setIconPicker(false)} />
                        <div className="absolute left-0 top-full z-30 mt-1 grid w-56 grid-cols-7 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                          {EMOJIS.map((e) => <button key={e} onClick={() => { setIcon(e); setIconPicker(false); }} className="rounded-md p-1 text-xl hover:bg-slate-100 dark:hover:bg-slate-700">{e}</button>)}
                        </div>
                      </>
                    )}
                  </div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    readOnly={!canEdit}
                    placeholder="Untitled"
                    className="mt-1 w-full bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
                  />
                </div>
                {active.updatedBy && (
                  <div className="mb-4 flex items-center gap-1.5 pl-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" /> Edited {formatRelative(active.updatedAt)}{active.updatedBy.name ? ` by ${active.updatedBy.name}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-16 sm:px-10">
              <div className="mx-auto max-w-3xl">
                {canEdit && mode === 'write' ? (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={"Write in Markdown…\n\n# Heading\n- bullet\n**bold**, `code`, [links](https://) and tables all work."}
                    className="min-h-[50vh] w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-300 dark:text-slate-200"
                  />
                ) : content.trim() ? (
                  <div className="text-[15px]"><ReactMarkdown remarkPlugins={[remarkGfm]} components={md as any}>{content}</ReactMarkdown></div>
                ) : (
                  <p className="text-sm text-slate-400">{canEdit ? 'This page is empty. Switch to Write to add content.' : 'This page is empty.'}</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Share dialog */}
      {shareOpen && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShareOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
              <span className="flex items-center gap-2 truncate text-base font-semibold text-slate-800 dark:text-slate-100"><Share2 className="h-5 w-5 text-brand-500" /> Share “{title || 'Untitled'}”</span>
              <button onClick={() => setShareOpen(false)} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Public read-only link</div>
                  <div className="text-xs text-slate-400">Anyone with the link can read this page — no account needed.</div>
                </div>
                <button onClick={toggleShare} disabled={shareBusy} role="switch" aria-checked={!!active.isPublic} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', active.isPublic ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600', shareBusy && 'opacity-60')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform', active.isPublic ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
              {active.isPublic && shareUrl ? (
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" />
                  <button onClick={() => copyText(shareUrl, 'Link copied')} className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600"><Link2 className="h-3.5 w-3.5" /> Copy</button>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-400 dark:bg-slate-800">Turn on the public link to get a shareable, read-only URL for this page.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

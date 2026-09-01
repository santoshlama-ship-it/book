'use client';

import { type FormEvent, type PointerEvent as ReactPointerEvent, type WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, FileText, Layers3, Link2, MessageCircle, Palette, Pencil, Plus, RotateCcw, Save, Search, Send, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Cover = {
  grade: string;
  subject: string;
  status: string;
  version: string;
  image: string;
  palette: { name: string; hex: string }[];
  concept: string;
  inspiration: string;
  details?: {
    typography: string;
    illustration: string;
    consistency: string;
    specifications: string;
    delivered: string;
    usage: string;
    approval: string;
  };
};

type Comment = { id: number; name: string; text: string; time: string; done?: boolean };

const initialComments: Record<number, Comment[]> = {};
const covers: Cover[] = [];
const blankCover: Cover = {
  grade: '', subject: '', status: 'Brief ready', version: 'V1', image: '', palette: [], concept: '', inspiration: '',
  details: { typography: '', illustration: '', consistency: '', specifications: '', delivered: '', usage: '', approval: '' },
};

const documentation = [
  { title: 'Visual System' },
  { title: 'Consistency Across the Series' },
  { title: 'Cover Specifications' },
  { title: 'Files Delivered' },
  { title: 'Usage Guidelines' },
  { title: 'Approval Record' },
];
const detailKeys = ['typography', 'consistency', 'specifications', 'delivered', 'usage', 'approval'] as const;

const statusClass: Record<string, string> = {
  'Client review': 'bg-blue-50 text-blue-700', 'In design': 'bg-violet-50 text-violet-700', Approved: 'bg-emerald-50 text-emerald-700',
  'Needs changes': 'bg-amber-50 text-amber-700', 'Brief ready': 'bg-stone-100 text-stone-600',
};

function driveFileId(link: string) {
  const pathMatch = link.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  const queryMatch = link.match(/[?&]id=([^&]+)/);
  return pathMatch?.[1] || queryMatch?.[1] || '';
}

function displayImageUrl(link: string) {
  if (!link) return '';
  const id = driveFileId(link);
  return id ? `https://lh3.googleusercontent.com/d/${id}=w2000` : link;
}

function CoverImage({ link, alt, className }: { link: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [link]);
  if (!link || failed) return <div className={`${className} grid place-items-center bg-black/5 p-4 text-center text-xs text-black/40`}><span><FileText className="mx-auto mb-2 size-5" />{failed ? 'Image unavailable. Check the Drive sharing permission and file link.' : 'No image link added'}</span></div>;
  return <img src={displayImageUrl(link)} alt={alt} className={className} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

export default function Home() {
  const [mode, setMode] = useState<'review' | 'designer'>('review');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [designs, setDesigns] = useState<Cover[]>(covers);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [draft, setDraft] = useState<Cover>(blankCover);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<Record<number, Comment[]>>(initialComments);
  const [commenterName, setCommenterName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const visible = useMemo(() => designs.filter((cover) => `${cover.grade} ${cover.subject}`.toLowerCase().includes(query.toLowerCase())), [designs, query]);
  const galleryGroups = [
    { name: 'Foundation Series', grades: 'Grades 1–3', description: 'A shared playful visual system with friendly characters, bright colours and simple learning cues.', accent: '#d8ef83', items: visible.filter((cover) => Number(cover.grade.replace('Grade ', '')) <= 3) },
    { name: 'Upper Series', grades: 'Grades 4–7', description: 'A more mature visual system with richer detail, structured layouts and subject-led imagery.', accent: '#f1c870', items: visible.filter((cover) => Number(cover.grade.replace('Grade ', '')) >= 4) },
  ];
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', close);
    document.body.style.overflow = selected === null ? '' : 'hidden';
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [selected]);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setDragging(false); }, [selected]);
  useEffect(() => { if (zoom === 1) setPan({ x: 0, y: 0 }); }, [zoom]);
  useEffect(() => {
    const loadState = async () => {
      const localDesigns = localStorage.getItem('coverdesk-designs-production');
      const localComments = localStorage.getItem('coverdesk-comments-production');
      try {
        const response = await fetch('/api/state', { cache: 'no-store' });
        if (!response.ok) throw new Error('Database unavailable');
        const data = await response.json() as { designs?: Cover[]; comments?: Record<number, Comment[]> };
        const nextDesigns = data.designs?.length ? data.designs : localDesigns ? JSON.parse(localDesigns) as Cover[] : [];
        const nextComments = Object.keys(data.comments || {}).length ? data.comments! : localComments ? JSON.parse(localComments) as Record<number, Comment[]> : {};
        setDesigns(nextDesigns);
        setComments(nextComments);
        if (nextDesigns[0]) { setDraft(nextDesigns[0]); setEditingIndex(0); }
      } catch {
        if (localDesigns) {
          const parsed = JSON.parse(localDesigns) as Cover[];
          setDesigns(parsed);
          if (parsed[0]) { setDraft(parsed[0]); setEditingIndex(0); }
        }
        if (localComments) setComments(JSON.parse(localComments));
      }
    };
    void loadState();
  }, []);
  const active = selected === null ? null : designs[selected];
  const move = (direction: number) => setSelected((current) => current === null ? 0 : (current + direction + designs.length) % designs.length);
  const changeZoom = (amount: number) => setZoom((current) => Math.min(3, Math.max(1, Number((current + amount).toFixed(2)))));
  const zoomWithWheel = (event: WheelEvent<HTMLElement>) => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.15 : -0.15);
  };
  const startPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (zoom <= 1 || (event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };
  const movePan = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragging) return;
    setPan({ x: dragStart.current.panX + event.clientX - dragStart.current.pointerX, y: dragStart.current.panY + event.clientY - dragStart.current.pointerY });
  };
  const stopPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };
  const selectDesign = (index: number) => { setEditingIndex(index); setDraft(designs[index]); setSaved(false); };
  const newDesign = () => { setEditingIndex(-1); setDraft(blankCover); setSaved(false); setMode('designer'); };
  const setDetail = (key: keyof NonNullable<Cover['details']>, value: string) => setDraft((current) => ({ ...current, details: { typography: '', illustration: '', consistency: '', specifications: '', delivered: '', usage: '', approval: '', ...current.details, [key]: value } }));
  const saveDesign = async () => {
    const next = editingIndex === -1 ? [...designs, draft] : designs.map((cover, index) => index === editingIndex ? draft : cover);
    setDesigns(next);
    localStorage.setItem('coverdesk-designs-production', JSON.stringify(next));
    if (editingIndex === -1) setEditingIndex(next.length - 1);
    const response = await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designs: next }) });
    setSaved(response.ok);
  };
  const deleteDesign = async (index: number) => {
    const cover = designs[index];
    if (!window.confirm(`Delete ${cover.grade} ${cover.subject}? Its comments will also be deleted.`)) return;
    const nextDesigns = designs.filter((_, coverIndex) => coverIndex !== index);
    const nextComments = Object.fromEntries(Object.entries(comments).flatMap(([key, value]) => {
      const commentIndex = Number(key);
      if (commentIndex === index) return [];
      return [[commentIndex > index ? commentIndex - 1 : commentIndex, value]];
    })) as Record<number, Comment[]>;
    setDesigns(nextDesigns);
    setComments(nextComments);
    localStorage.setItem('coverdesk-designs-production', JSON.stringify(nextDesigns));
    localStorage.setItem('coverdesk-comments-production', JSON.stringify(nextComments));
    if (nextDesigns.length === 0) { setEditingIndex(-1); setDraft(blankCover); }
    else {
      const nextIndex = editingIndex === index ? Math.min(index, nextDesigns.length - 1) : editingIndex > index ? editingIndex - 1 : editingIndex;
      setEditingIndex(nextIndex);
      setDraft(nextDesigns[Math.max(0, nextIndex)] || nextDesigns[0]);
    }
    await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ designs: nextDesigns, comments: nextComments }) });
  };
  const submitComment = (event: FormEvent) => {
    event.preventDefault();
    if (selected === null || !commenterName.trim() || !commentText.trim()) return;
    const comment = { id: Date.now(), name: commenterName.trim(), text: commentText.trim(), time: 'Just now', done: false };
    const next = { ...comments, [selected]: [...(comments[selected] || []), comment] };
    setComments(next);
    localStorage.setItem('coverdesk-comments-production', JSON.stringify(next));
    void fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comments: next }) });
    setCommentText('');
  };
  const deleteComment = async (commentId: number) => {
    if (selected === null || !window.confirm('Delete this comment?')) return;
    const next = { ...comments, [selected]: (comments[selected] || []).filter((comment) => comment.id !== commentId) };
    setComments(next);
    localStorage.setItem('coverdesk-comments-production', JSON.stringify(next));
    await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comments: next }) });
  };
  const toggleCommentDone = async (commentId: number) => {
    if (selected === null) return;
    const next = { ...comments, [selected]: (comments[selected] || []).map((comment) => comment.id === commentId ? { ...comment, done: !comment.done } : comment) };
    setComments(next);
    localStorage.setItem('coverdesk-comments-production', JSON.stringify(next));
    await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comments: next }) });
  };
  const renderCoverCard = (cover: Cover) => {
    const index = designs.indexOf(cover);
    const commentCount = (comments[index] || []).filter((comment) => !comment.done).length;
    return <button key={`${cover.grade}-${cover.subject}`} onClick={() => setSelected(index)} className="group overflow-hidden rounded-[24px] border border-white/80 bg-white/70 text-left shadow-[0_12px_35px_rgba(30,34,24,.08),inset_0_1px_0_rgba(255,255,255,.9)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_50px_rgba(30,34,24,.14)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d5ff3d]">
      <div className="aspect-[3/4] overflow-hidden bg-[#e8e8e3] p-3"><CoverImage link={cover.image} alt={`${cover.grade} ${cover.subject} book cover`} className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.015]" /></div>
      <div className="p-4"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium text-black/45">{cover.grade}</span><Badge className={statusClass[cover.status]}>{cover.status}</Badge></div><h3 className="text-lg font-semibold tracking-tight">{cover.subject}</h3><div className="mt-3 flex items-center justify-between border-t border-black/7 pt-3 text-xs text-black/45"><span>{cover.version}</span><span className="flex items-center gap-1.5"><span className={`flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-white transition ${commentCount > 0 ? 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,.14),0_5px_14px_rgba(239,68,68,.25)]' : 'bg-[#1b2a21]'}`} aria-label={`${commentCount} comment notification${commentCount === 1 ? '' : 's'}`}><MessageCircle className="size-3" />{commentCount}</span><span className="hidden font-medium text-[#42604d] 2xl:inline">View <ChevronRight className="inline size-3.5" /></span></span></div></div>
    </button>;
  };
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0%,#f1ffac_0,transparent_25%),radial-gradient(circle_at_92%_18%,#fff2a8_0,transparent_24%),linear-gradient(145deg,#fbfaf5,#f2f1e9)] text-[#171914]">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/55 shadow-[0_8px_30px_rgba(35,38,28,.05)] backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-9">
          <div className="flex items-center gap-3"><span className="neon-glow grid size-11 place-items-center overflow-hidden rounded-full bg-[#78d11f]"><img src="/coverdesk-logo.png" alt="Coverdesk logo" className="size-full rounded-full object-cover" /></span><div><p className="font-extrabold tracking-tight">Coverdesk</p><p className="text-[11px] font-medium text-black/40">Grade-book cover documentation</p></div></div>
          <div className="glass-surface flex items-center gap-1 rounded-2xl p-1"><Button onClick={() => { setMode('review'); setSelected(null); }} variant={mode === 'review' ? 'default' : 'ghost'} className={mode === 'review' ? 'neon-glow' : ''} size="sm"><Eye />Client review</Button><Button onClick={() => { setMode('designer'); setSelected(null); }} variant={mode === 'designer' ? 'default' : 'ghost'} className={mode === 'designer' ? 'neon-glow' : ''} size="sm"><Pencil />Designer</Button></div>
        </div>
      </header>

      {mode === 'designer' && <div className="mx-auto max-w-[1600px] px-5 py-8 md:px-9 md:py-10">
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#63766a]">Designer workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] md:text-4xl">Build the cover documentation</h1><p className="mt-2 text-sm text-black/50">Create a cover, add the artwork and complete every description the client needs to review.</p></div><div className="flex items-center gap-3">{saved && <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check className="size-4" />Draft saved</span>}<Button variant="outline" onClick={newDesign}><Plus />New cover</Button><Button onClick={saveDesign} disabled={!draft.grade.trim() || !draft.subject.trim()}><Save />Save design</Button></div></div>
        <div className="grid gap-5 xl:grid-cols-[230px_minmax(280px,.8fr)_minmax(380px,1.2fr)]">
          <aside className="rounded-2xl border border-black/8 bg-white p-3 xl:sticky xl:top-24 xl:h-[calc(100vh-120px)] xl:overflow-y-auto"><div className="flex items-center justify-between px-2 pb-3 pt-1"><p className="text-xs font-semibold uppercase tracking-[.14em] text-black/40">Covers</p><Button onClick={newDesign} variant="ghost" size="icon-sm" aria-label="Create new cover"><Plus /></Button></div>{designs.length === 0 && <button onClick={newDesign} className="w-full rounded-xl border border-dashed border-black/10 px-3 py-8 text-center text-sm text-black/45"><Plus className="mx-auto mb-2 size-5" />Create your first cover</button>}{designs.map((cover, index) => <div key={`${cover.grade}-${cover.subject}`} className={`group mb-1 flex items-center rounded-xl transition ${editingIndex === index ? 'bg-[#eaf1e2]' : 'hover:bg-black/[.035]'}`}><button onClick={() => selectDesign(index)} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"><CoverImage link={cover.image} alt="" className="h-14 w-10 shrink-0 rounded object-contain" /><div className="min-w-0"><p className="text-xs text-black/40">{cover.grade}</p><p className="truncate text-sm font-semibold">{cover.subject}</p><p className="mt-0.5 text-[10px] text-black/35">{cover.version} · {cover.status}</p></div></button><Button onClick={() => void deleteDesign(index)} variant="ghost" size="icon-sm" className="mr-1 shrink-0 text-black/35 opacity-70 hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label={`Delete ${cover.grade} ${cover.subject}`}><Trash2 /></Button></div>)}</aside>

          <section className="rounded-2xl border border-black/8 bg-[#202821] p-5 xl:sticky xl:top-24 xl:flex xl:h-[calc(100vh-120px)] xl:flex-col"><div className="mb-4 flex items-center justify-between text-white"><div><p className="text-xs text-white/45">Live cover preview</p><p className="mt-1 font-semibold">{draft.grade || 'New cover'}{draft.subject ? ` · ${draft.subject}` : ''}</p></div><Palette className="size-5 text-[#d8ef83]" /></div><div className="flex min-h-[400px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/20 p-4">{draft.image ? <CoverImage link={draft.image} alt="Cover preview" className="max-h-full max-w-full rounded-md object-contain shadow-2xl" /> : <div className="text-center text-white/35"><Link2 className="mx-auto mb-3 size-8" /><p className="text-sm">Paste a Google Drive image link</p></div>}</div><div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-white/55"><Link2 className="mt-0.5 size-4 shrink-0" />Use a direct JPG/PNG file link—not a folder link—and set access to “Anyone with the link.”</div></section>

          <section className="rounded-2xl border border-black/8 bg-white p-5 md:p-7 xl:h-[calc(100vh-120px)] xl:overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-semibold text-black/60">Grade</label><Input value={draft.grade} onChange={(event) => { setSaved(false); setDraft({ ...draft, grade: event.target.value }); }} className="mt-2" /></div><div><label className="text-xs font-semibold text-black/60">Subject</label><Input value={draft.subject} onChange={(event) => { setSaved(false); setDraft({ ...draft, subject: event.target.value }); }} className="mt-2" /></div><div><label className="text-xs font-semibold text-black/60">Version</label><Input value={draft.version} onChange={(event) => { setSaved(false); setDraft({ ...draft, version: event.target.value }); }} className="mt-2" /></div><div><label className="text-xs font-semibold text-black/60">Status</label><select value={draft.status} onChange={(event) => { setSaved(false); setDraft({ ...draft, status: event.target.value }); }} className="mt-2 h-8 w-full rounded-lg border bg-white px-2.5 text-sm">{Object.keys(statusClass).map((status) => <option key={status}>{status}</option>)}</select></div></div>
            <div className="mt-5"><label className="text-xs font-semibold text-black/60">Google Drive image link</label><Input value={draft.image} onChange={(event) => { setSaved(false); setDraft({ ...draft, image: event.target.value }); }} className="mt-2" placeholder="https://drive.google.com/file/d/.../view" /><p className="mt-2 text-xs leading-5 text-black/40">Paste the sharing link for a JPG or PNG stored in Google Drive. Coverdesk stores only this link.</p></div>
            <div className="mt-7 border-t border-black/8 pt-6"><h2 className="font-semibold">Design concept</h2><label className="mt-4 block text-xs font-semibold text-black/60">Main concept</label><Textarea value={draft.concept} onChange={(event) => { setSaved(false); setDraft({ ...draft, concept: event.target.value }); }} className="mt-2 min-h-24" /><label className="mt-4 block text-xs font-semibold text-black/60">Theme and inspiration</label><Textarea value={draft.inspiration} onChange={(event) => { setSaved(false); setDraft({ ...draft, inspiration: event.target.value }); }} className="mt-2 min-h-20" /></div>
            <div className="mt-7 border-t border-black/8 pt-6"><h2 className="font-semibold">Visual system</h2><label className="mt-4 block text-xs font-semibold text-black/60">Fonts and typography</label><Textarea value={draft.details?.typography || ''} onChange={(event) => { setSaved(false); setDetail('typography', event.target.value); }} className="mt-2" placeholder="Font family, weights, title hierarchy…" /><label className="mt-4 block text-xs font-semibold text-black/60">Illustration, character and icon style</label><Textarea value={draft.details?.illustration || ''} onChange={(event) => { setSaved(false); setDetail('illustration', event.target.value); }} className="mt-2" placeholder="Illustration technique, character rules, shapes…" /><label className="mt-4 block text-xs font-semibold text-black/60">Series consistency</label><Textarea value={draft.details?.consistency || ''} onChange={(event) => { setSaved(false); setDetail('consistency', event.target.value); }} className="mt-2" placeholder="Shared elements and grade differentiation…" /></div>
            <div className="mt-7 border-t border-black/8 pt-6"><h2 className="font-semibold">Production and handoff</h2>{([['specifications', 'Cover specifications', 'Dimensions, bleed, safe margin, spine, CMYK, DPI…'], ['delivered', 'Files delivered', 'Source file, print PDF, previews, fonts, links…'], ['usage', 'Usage guidelines', 'Editable and protected elements, future-cover rules…'], ['approval', 'Approval notes', 'Version, date, client feedback and revisions…']] as const).map(([key, label, placeholder]) => <div key={key}><label className="mt-4 block text-xs font-semibold text-black/60">{label}</label><Textarea value={draft.details?.[key] || ''} onChange={(event) => { setSaved(false); setDetail(key, event.target.value); }} className="mt-2" placeholder={placeholder} /></div>)}</div>
            <Button onClick={saveDesign} size="lg" className="mt-7 w-full"><Save />Save and update client review</Button>
          </section>
        </div>
      </div>}

      <div className={`mx-auto max-w-[1500px] px-5 py-9 md:px-9 md:py-12 ${mode === 'review' ? '' : 'hidden'}`}>
        <div className="mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-[#63766a]">Cover library</p><h1 className="max-w-2xl text-4xl font-semibold tracking-[-.045em] md:text-5xl">Every cover, with its design story.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/52">Select a cover to review the artwork, visual system, specifications, delivery files and approval record.</p></div>
          <div className="relative w-full md:w-72"><Search className="absolute left-3 top-2.5 size-4 text-black/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search grade or subject" className="h-10 bg-white pl-9" /></div>
        </div>

        <div className="space-y-12" aria-label="Book cover gallery">
          {galleryGroups.map((group) => <section key={group.name} className="glass-surface rounded-[30px] p-4 md:p-6">
            <div className="mb-6 flex flex-col gap-4 border-b border-black/8 pb-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl text-[#26372c]" style={{ backgroundColor: group.accent }}><Layers3 className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight">{group.name}</h2><Badge variant="outline" className="bg-white">{group.grades}</Badge></div><p className="mt-1 max-w-2xl text-sm leading-5 text-black/50">{group.description}</p></div></div>
              <p className="shrink-0 text-xs font-medium text-black/40">{group.items.length} cover{group.items.length === 1 ? '' : 's'} shown</p>
            </div>
            {group.items.length > 0 ? <div className="space-y-9">
              {[...new Set(group.items.map((cover) => cover.subject.trim() || 'Untitled subject'))].sort((a, b) => a.localeCompare(b)).map((subject) => {
                const subjectCovers = group.items.filter((cover) => (cover.subject.trim() || 'Untitled subject') === subject);
                return <section key={subject} className="rounded-[24px] border border-black/7 bg-white/42 p-4 md:p-5">
                  <div className="mb-5 flex items-center justify-between border-b border-black/7 pb-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#718278]">Subject</p><h3 className="mt-1 text-xl font-semibold tracking-tight">{subject}</h3></div><Badge variant="outline" className="bg-white/80">{subjectCovers.length} grade{subjectCovers.length === 1 ? '' : 's'}</Badge></div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{subjectCovers.map(renderCoverCard)}</div>
                </section>;
              })}
            </div> : <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-5 py-10 text-center text-sm text-black/40">{query ? 'No covers in this group match your search.' : 'No covers added yet.'}</div>}
          </section>)}
        </div>
      </div>

      {mode === 'review' && active && <div className="fixed inset-0 z-50 bg-[#111812]/70 p-2 backdrop-blur-sm md:p-5" role="dialog" aria-modal="true" aria-label={`${active.grade} ${active.subject} documentation`}>
        <div className="mx-auto grid h-full max-w-[1800px] overflow-hidden rounded-[24px] bg-white shadow-2xl lg:grid-cols-[minmax(0,4fr)_minmax(330px,1fr)]">
          <section onWheel={zoomWithWheel} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} className={`relative flex min-h-0 touch-none items-center justify-center overflow-hidden bg-[#202821] p-5 md:p-10 ${zoom > 1 ? dragging ? 'cursor-grabbing' : 'cursor-grab' : ''}`}>
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/75 backdrop-blur-md"><FileText className="size-3.5" />{active.grade} · {active.subject}</div>
            <div className={`flex h-full w-full select-none items-center justify-center ease-out ${dragging ? '' : 'transition-transform duration-150'}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}><CoverImage link={active.image} alt={`${active.grade} ${active.subject} full cover`} className="pointer-events-none max-h-full max-w-full rounded-lg object-contain shadow-[0_30px_80px_rgba(0,0,0,.38)]" /></div>
            <div className="pointer-events-none absolute right-5 top-5 z-10 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/65 backdrop-blur-md">Scroll to zoom{zoom > 1 ? ' · Drag to move' : ''}</div>
            <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/35 p-1 text-white shadow-lg backdrop-blur-md">
              <Button onClick={() => changeZoom(-0.2)} disabled={zoom <= 1} variant="ghost" size="icon-sm" className="rounded-full text-white hover:bg-white/15 hover:text-white" aria-label="Zoom out"><ZoomOut /></Button>
              <button onClick={() => setZoom(1)} className="min-w-14 rounded-full px-2 py-1 text-xs font-semibold hover:bg-white/10" aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
              <Button onClick={() => changeZoom(0.2)} disabled={zoom >= 3} variant="ghost" size="icon-sm" className="rounded-full text-white hover:bg-white/15 hover:text-white" aria-label="Zoom in"><ZoomIn /></Button>
              {zoom !== 1 && <Button onClick={() => setZoom(1)} variant="ghost" size="icon-sm" className="rounded-full text-white hover:bg-white/15 hover:text-white" aria-label="Reset zoom"><RotateCcw /></Button>}
            </div>
            <Button onClick={() => move(-1)} variant="ghost" size="icon-lg" className="absolute left-3 top-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Previous cover"><ChevronLeft /></Button>
            <Button onClick={() => move(1)} variant="ghost" size="icon-lg" className="absolute right-3 top-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Next cover"><ChevronRight /></Button>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-black/8 bg-[#fbfbf8]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/8 bg-[#fbfbf8]/95 px-6 py-4 backdrop-blur"><div className="flex gap-2"><Badge className={statusClass[active.status]}>{active.status}</Badge><Badge variant="outline">{active.version}</Badge></div><Button onClick={() => setSelected(null)} variant="ghost" size="icon" aria-label="Close documentation"><X /></Button></div>
            <div className="p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#66796d]">{active.grade}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">{active.subject}</h2>
              {(active.concept?.trim() || active.inspiration?.trim() || active.details?.illustration?.trim()) && <section className="mt-8"><h3 className="text-base font-semibold">Design Concept</h3>{active.concept?.trim() && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-black/60">{active.concept}</p>}{active.inspiration?.trim() && <div className="mt-5 rounded-xl bg-[#f0f3ed] p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#63766a]">Theme and inspiration</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-black/60">{active.inspiration}</p></div>}{active.details?.illustration?.trim() && <div className="mt-4 rounded-xl bg-[#f0f3ed] p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#63766a]">Illustration system</p><p className="mt-2 whitespace-pre-line text-sm leading-6 text-black/60">{active.details.illustration}</p></div>}</section>}
              <section className="mt-8 border-t border-black/8 pt-7"><h3 className="text-base font-semibold">Colour Palette</h3><div className="mt-4 space-y-3">{active.palette.map((colour) => <div key={colour.hex} className="flex items-center gap-3"><span className="size-9 rounded-lg border border-black/8" style={{ backgroundColor: colour.hex }} /><div><p className="text-sm font-medium">{colour.name}</p><p className="font-mono text-xs text-black/45">{colour.hex}</p></div></div>)}</div></section>
              {documentation.map((section, sectionIndex) => {
                const detail = active.details?.[detailKeys[sectionIndex]];
                if (!detail?.trim()) return null;
                return <section key={section.title} className="mt-8 border-t border-black/8 pt-7"><div className="flex items-baseline gap-3"><span className="text-xs font-semibold text-[#718278]">0{sectionIndex + 1}</span><h3 className="text-base font-semibold">{section.title}</h3></div><p className="mt-4 whitespace-pre-line rounded-xl bg-[#f0f3ed] p-4 text-sm leading-6 text-black/62">{detail}</p></section>;
              })}
              <div className="mt-9 rounded-2xl bg-[#eef3e9] p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#5f7466]">Approval</p><p className="mt-2 text-sm font-medium">Designer: __________________</p><p className="mt-2 text-sm font-medium">Client: ____________________</p><p className="mt-2 text-sm text-black/50">Date: ______________________</p></div>
              <section className="mt-9 border-t border-black/8 pt-8">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#66796d]">Discussion</p><h3 className="mt-1 text-lg font-semibold">Comments</h3></div><span className="grid size-9 place-items-center rounded-full bg-[#1b2a21] text-sm font-semibold text-white">{selected !== null ? (comments[selected]?.length || 0) : 0}</span></div>
                <div className="mt-5 space-y-4">{(selected !== null ? (comments[selected] || []) : []).map((comment: Comment) => <article key={comment.id} className={`group rounded-2xl border p-4 transition ${comment.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-black/7 bg-white'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${comment.done ? 'bg-emerald-500 text-white' : 'bg-[#dce9cf] text-[#334d3c]'}`}>{comment.done ? <Check className="size-4" /> : comment.name.charAt(0).toUpperCase()}</span><p className="text-sm font-semibold">{comment.name}</p></div><div className="flex items-center gap-1"><time className="text-[10px] text-black/35">{comment.time}</time><Button onClick={() => void deleteComment(comment.id)} variant="ghost" size="icon-sm" className="text-black/30 hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label={`Delete comment by ${comment.name}`}><Trash2 /></Button></div></div><p className={`mt-3 text-sm leading-5 ${comment.done ? 'text-black/45 line-through decoration-black/20' : 'text-black/60'}`}>{comment.text}</p><Button onClick={() => void toggleCommentDone(comment.id)} variant={comment.done ? 'outline' : 'default'} size="sm" className={`mt-4 ${comment.done ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}><Check />{comment.done ? 'Done · Reopen' : 'Mark done'}</Button></article>)}</div>
                <form onSubmit={submitComment} className="mt-5 rounded-2xl border border-black/8 bg-white p-4">
                  <label htmlFor="comment-name" className="text-xs font-semibold text-black/65">Your name</label><Input id="comment-name" value={commenterName} onChange={(event) => setCommenterName(event.target.value)} className="mt-2" placeholder="Enter your name first" required />
                  <label htmlFor="comment-text" className="mt-4 block text-xs font-semibold text-black/65">Comment</label><Textarea id="comment-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={!commenterName.trim()} className="mt-2 min-h-24 resize-none" placeholder={commenterName.trim() ? 'Write your feedback…' : 'Enter your name to enable comments'} required />
                  <Button type="submit" disabled={!commenterName.trim() || !commentText.trim()} className="mt-3 w-full"><Send />Post comment</Button>
                </form>
              </section>
            </div>
          </aside>
        </div>
      </div>}
    </main>
  );
}

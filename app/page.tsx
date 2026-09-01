'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Bell, BookOpen, CheckCircle2, ChevronRight, ClipboardCheck, FileText, Filter, Grid2X2, Layers3, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const initialProjects = [
  { grade: 'Grade 1', subject: 'English', code: 'ENG–01', color: '#ed6a5a', status: 'Client review', version: 'v3', progress: 82, due: 'Sep 04', files: 6 },
  { grade: 'Grade 2', subject: 'Mathematics', code: 'MAT–02', color: '#3b82c4', status: 'In design', version: 'v2', progress: 58, due: 'Sep 07', files: 4 },
  { grade: 'Grade 3', subject: 'Science', code: 'SCI–03', color: '#51a46d', status: 'Approved', version: 'v4', progress: 100, due: 'Aug 29', files: 9 },
  { grade: 'Grade 4', subject: 'Social Studies', code: 'SOC–04', color: '#d69b2d', status: 'Needs changes', version: 'v2', progress: 66, due: 'Sep 03', files: 5 },
  { grade: 'Grade 5', subject: 'Computer', code: 'COM–05', color: '#8267bd', status: 'Brief ready', version: 'v1', progress: 24, due: 'Sep 12', files: 3 },
];

const statusStyle: Record<string, string> = {
  'Client review': 'bg-blue-50 text-blue-700 border-blue-100', 'In design': 'bg-violet-50 text-violet-700 border-violet-100',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-100', 'Needs changes': 'bg-amber-50 text-amber-700 border-amber-100',
  'Brief ready': 'bg-stone-100 text-stone-600 border-stone-200',
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('All projects');
  const [statusFilter, setStatusFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialProjects);
  useEffect(() => {
    const saved = localStorage.getItem('coverdesk-projects');
    if (saved) setItems(JSON.parse(saved));
  }, []);
  useEffect(() => { localStorage.setItem('coverdesk-projects', JSON.stringify(items)); }, [items]);
  const filtered = useMemo(() => items.filter((p) => `${p.grade} ${p.subject} ${p.code}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === 'All' || p.status === statusFilter)), [items, query, statusFilter]);
  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const grade = String(data.get('grade'));
    const subject = String(data.get('subject'));
    const due = String(data.get('due')) || 'Not set';
    const code = `${subject.slice(0, 3).toUpperCase()}–${String(items.length + 1).padStart(2, '0')}`;
    setItems((current) => [{ grade, subject, code, due, color: '#e56f51', status: 'Brief ready', version: 'v1', progress: 10, files: 0 }, ...current]);
    setOpen(false);
  }
  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#18211b]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#dfe4dd] bg-[#17271f] text-white lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6"><div className="grid size-10 place-items-center rounded-xl bg-[#d7ef83] text-[#17271f]"><BookOpen className="size-5" /></div><div><p className="text-lg font-semibold tracking-tight">Coverdesk</p><p className="text-xs text-white/50">Publishing workspace</p></div></div>
        <nav className="flex-1 px-3 py-6" aria-label="Main navigation">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-white/35">Workspace</p>
          {([['All projects', Grid2X2], ['Approvals', ClipboardCheck], ['Deliverables', Archive], ['Asset licenses', ShieldCheck], ['Templates', Layers3]] as const).map(([label, Icon]) => <button key={label} onClick={() => setActive(label)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active === label ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}><Icon className="size-4" />{label}{label === 'Approvals' && <span className="ml-auto rounded-full bg-[#d7ef83] px-2 py-0.5 text-[10px] font-bold text-[#17271f]">2</span>}</button>)}
        </nav>
        <div className="m-3 rounded-2xl bg-white/[.07] p-4"><div className="mb-3 flex items-center gap-2 text-xs text-white/70"><Sparkles className="size-4 text-[#d7ef83]" />Production health</div><div className="mb-2 flex items-end justify-between"><span className="text-2xl font-semibold">76%</span><span className="text-xs text-white/40">18 of 24</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 rounded-full bg-[#d7ef83]" /></div></div>
        <button className="m-3 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/55 hover:bg-white/5"><Settings className="size-4" />Workspace settings</button>
      </aside>
      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-[#dfe4dd] bg-[#f6f7f4]/90 px-5 backdrop-blur-xl md:px-8"><div className="flex items-center gap-3 lg:hidden"><div className="grid size-9 place-items-center rounded-xl bg-[#17271f] text-[#d7ef83]"><BookOpen className="size-4" /></div><span className="font-semibold">Coverdesk</span></div><div className="hidden md:block"><p className="text-xs font-medium text-[#728077]">Tuesday, 1 September</p><p className="text-sm font-semibold">Good morning, Designer</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Notifications"><Bell /></Button><div className="grid size-9 place-items-center rounded-xl bg-[#f0c95e] text-sm font-bold">CD</div></div></header>
        <div className="mx-auto max-w-[1480px] px-5 py-7 md:px-8 md:py-9">
          <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#79847d]">Academic series · 2026</p><h1 className="text-3xl font-semibold tracking-[-.04em] md:text-4xl">Book cover production</h1><p className="mt-2 max-w-xl text-sm text-[#6f7972]">Track every brief, revision, approval, license and print-ready file in one place.</p></div><Button onClick={() => setOpen(true)} size="lg" className="bg-[#17271f] px-4 text-white hover:bg-[#294234]"><Plus />New cover project</Button></div>
          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {([['24', 'Total covers', 'Across 8 grades', BookOpen, '#e9f1dc'], ['09', 'In production', '3 due this week', Layers3, '#e2edf7'], ['02', 'Awaiting approval', 'Client action needed', ClipboardCheck, '#fbebcf'], ['13', 'Print ready', 'All checks passed', CheckCircle2, '#ddf1e4']] as const).map(([value, label, note, Icon, color]) => <article key={label} className="rounded-2xl border border-[#dfe4dd] bg-white p-5"><div className="mb-5 flex items-start justify-between"><span className="text-3xl font-semibold tracking-tight">{value}</span><span className="grid size-9 place-items-center rounded-xl" style={{ background: color }}><Icon className="size-4" /></span></div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-[#7b867e]">{note}</p></article>)}
          </div>
          <section className="overflow-hidden rounded-2xl border border-[#dfe4dd] bg-white">
            <div className="flex flex-col gap-4 border-b border-[#e5e8e3] p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold">Active cover projects</h2><p className="mt-1 text-xs text-[#7b867e]">{filtered.length} projects shown</p></div><div className="flex gap-2"><div className="relative flex-1 md:w-64"><Search className="absolute left-2.5 top-2.5 size-4 text-[#829087]" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search grade or subject" className="pl-9" /></div><Button onClick={() => setStatusFilter((current) => current === 'All' ? 'Client review' : current === 'Client review' ? 'Approved' : 'All')} variant="outline"><Filter />{statusFilter === 'All' ? 'Filter' : statusFilter}</Button></div></div>
            <div className="divide-y divide-[#edf0eb]">
              {filtered.map((p) => <article key={p.code} className="group grid gap-4 px-5 py-5 transition hover:bg-[#fafbf8] md:grid-cols-[minmax(220px,1.7fr)_minmax(150px,1fr)_110px_90px_34px] md:items-center">
                <div className="flex items-center gap-4"><div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-[5px] shadow-[0_4px_12px_rgba(20,31,24,.14)]" style={{ background: p.color }}><div className="absolute inset-x-1.5 top-2 h-px bg-white/50" /><div className="absolute left-1.5 top-4 text-[6px] font-bold uppercase tracking-wider text-white">{p.subject}</div><div className="absolute bottom-1.5 right-1.5 text-[13px] font-bold text-white">{p.grade.replace('Grade ', '')}</div></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{p.subject}</h3><Badge variant="outline" className={statusStyle[p.status]}>{p.status}</Badge></div><p className="mt-1 text-xs text-[#7a867e]">{p.grade} · {p.code} · {p.version}</p></div></div>
                <div><div className="mb-2 flex justify-between text-xs"><span className="font-medium">Production</span><span className="tabular-nums text-[#748078]">{p.progress}%</span></div><Progress value={p.progress} className="[&_[data-slot=progress-indicator]]:bg-[#557b63]" /></div>
                <div><p className="text-[10px] uppercase tracking-wider text-[#8a948d]">Due date</p><p className="mt-1 text-sm font-medium">{p.due}</p></div><div className="flex items-center gap-2 text-sm text-[#69756d]"><FileText className="size-4" />{p.files} files</div><Button variant="ghost" size="icon" aria-label={`Open ${p.subject} project`}><ChevronRight /></Button>
              </article>)}
              {filtered.length === 0 && <div className="px-5 py-14 text-center"><Search className="mx-auto mb-3 size-6 text-[#9da69f]" /><p className="font-medium">No matching projects</p><p className="mt-1 text-sm text-[#7b867e]">Try another grade, subject, or project code.</p></div>}
            </div><div className="flex items-center justify-between border-t border-[#e5e8e3] bg-[#fafbf8] px-5 py-3"><p className="text-xs text-[#7b867e]">Last updated 12 minutes ago</p><Button variant="ghost" size="sm">View all projects <ChevronRight /></Button></div>
          </section>
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-[#dfe4dd] bg-[#17271f] p-6 text-white"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#d7ef83]">Next approval</p><h2 className="mt-2 text-xl font-semibold">Grade 1 English · Version 3</h2><p className="mt-1 text-sm text-white/55">Sent to Bright Future Publications</p></div><Button variant="ghost" size="icon" className="text-white/60 hover:bg-white/10 hover:text-white"><MoreHorizontal /></Button></div><div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex gap-6"><div><p className="text-[10px] uppercase tracking-wider text-white/40">Sent</p><p className="mt-1 text-sm">31 Aug, 4:20 PM</p></div><div><p className="text-[10px] uppercase tracking-wider text-white/40">Deadline</p><p className="mt-1 text-sm">04 Sep</p></div></div><Button className="bg-[#d7ef83] text-[#17271f] hover:bg-[#e5f6ab]">Open approval page <ChevronRight /></Button></div></section>
            <section className="rounded-2xl border border-[#dfe4dd] bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#7d8981]">Print checklist</p><h2 className="mt-2 text-xl font-semibold">Ready for handoff</h2></div><div className="grid size-11 place-items-center rounded-full bg-[#edf4e3] text-[#557b63]"><CheckCircle2 className="size-5" /></div></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs">{['CMYK color', '300 DPI images', '3 mm bleed', 'Fonts outlined'].map((item) => <div key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#5c8b6b]" />{item}</div>)}</div></section>
          </div>
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create a cover project</DialogTitle><DialogDescription>Add the essential details now. Specifications, versions and files can follow.</DialogDescription></DialogHeader>
          <form id="new-project" onSubmit={addProject} className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="grade">Grade</Label><select id="grade" name="grade" className="h-9 rounded-lg border bg-white px-3 text-sm" defaultValue="Grade 1">{Array.from({ length: 10 }, (_, i) => <option key={i}>Grade {i + 1}</option>)}</select></div>
            <div className="grid gap-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" required placeholder="e.g. English" /></div>
            <div className="grid gap-2"><Label htmlFor="due">Due date</Label><Input id="due" name="due" type="date" /></div>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="new-project" type="submit">Create project</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

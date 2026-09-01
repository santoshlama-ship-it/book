'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, FileText, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Cover = {
  grade: string;
  subject: string;
  status: string;
  version: string;
  image: string;
  palette: { name: string; hex: string }[];
  concept: string;
  inspiration: string;
};

const covers: Cover[] = [
  { grade: 'Grade 1', subject: 'English', status: 'Client review', version: 'V3', image: '/covers/grade-1-english.png', concept: 'A joyful first step into language, built around discovery, storytelling and confident self-expression.', inspiration: 'Playful letter forms and a storybook journey make English feel welcoming to early learners.', palette: [{ name: 'Coral', hex: '#ED6A5A' }, { name: 'Sun', hex: '#F4C95D' }, { name: 'Sky', hex: '#65B5D2' }] },
  { grade: 'Grade 2', subject: 'Mathematics', status: 'In design', version: 'V2', image: '/covers/grade-2-mathematics.png', concept: 'Numbers become a friendly visual world of patterns, shapes and everyday problem-solving.', inspiration: 'Clear geometry and lively movement turn an abstract subject into something students can explore.', palette: [{ name: 'Blue', hex: '#397FC2' }, { name: 'Mint', hex: '#75C6A7' }, { name: 'Cream', hex: '#FFF1CF' }] },
  { grade: 'Grade 3', subject: 'Science', status: 'Approved', version: 'V4', image: '/covers/grade-3-science.png', concept: 'A curious journey through nature, observation and simple experiments.', inspiration: 'The illustration balances wonder with clarity, helping students see science in the world around them.', palette: [{ name: 'Leaf', hex: '#4F9F68' }, { name: 'Aqua', hex: '#54B9B5' }, { name: 'Lemon', hex: '#E7D866' }] },
  { grade: 'Grade 4', subject: 'Social Studies', status: 'Needs changes', version: 'V2', image: '/covers/grade-4-social-studies.png', concept: 'Community, culture and place come together in an inclusive visual journey.', inspiration: 'Layered geographic and human elements help students connect their local world with wider society.', palette: [{ name: 'Ochre', hex: '#D39832' }, { name: 'Terracotta', hex: '#BB6549' }, { name: 'Indigo', hex: '#536A9C' }] },
  { grade: 'Grade 5', subject: 'Computer', status: 'Brief ready', version: 'V1', image: '/covers/grade-5-computer.png', concept: 'Digital creativity is presented as an imaginative space for making, thinking and solving.', inspiration: 'Friendly technology imagery avoids complexity while signalling a more mature learning level.', palette: [{ name: 'Violet', hex: '#7760B5' }, { name: 'Cyan', hex: '#45BFD0' }, { name: 'Navy', hex: '#24365C' }] },
];

const documentation = [
  { title: 'Visual System', items: ['Colour palette with print and screen colour codes', 'Fonts and typography hierarchy', 'Illustration and character style', 'Icons, shapes and background elements'] },
  { title: 'Consistency Across the Series', items: ['Shared series elements across every book', 'Grade and subject differentiation rules', 'Logo, title and publisher placement rules'] },
  { title: 'Cover Specifications', items: ['Final size: 210 × 297 mm', 'Bleed: 3 mm · Safe margin: 8 mm', 'CMYK colour mode · 300 DPI resolution', 'Front cover, spine and back-cover measurements'] },
  { title: 'Files Delivered', items: ['Editable source files', 'Print-ready PDF files', 'Preview JPG and PNG files', 'Font and linked-image information'] },
  { title: 'Usage Guidelines', items: ['Client-editable text fields', 'Protected series elements', 'Correct and incorrect cover usage', 'Instructions for future covers'] },
  { title: 'Approval Record', items: ['Final version number and approval date', 'Client feedback and requested revisions', 'Designer and client approval fields'] },
];

const statusClass: Record<string, string> = {
  'Client review': 'bg-blue-50 text-blue-700', 'In design': 'bg-violet-50 text-violet-700', Approved: 'bg-emerald-50 text-emerald-700',
  'Needs changes': 'bg-amber-50 text-amber-700', 'Brief ready': 'bg-stone-100 text-stone-600',
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const visible = useMemo(() => covers.filter((cover) => `${cover.grade} ${cover.subject}`.toLowerCase().includes(query.toLowerCase())), [query]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', close);
    document.body.style.overflow = selected === null ? '' : 'hidden';
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [selected]);
  const active = selected === null ? null : covers[selected];
  const move = (direction: number) => setSelected((current) => current === null ? 0 : (current + direction + covers.length) % covers.length);

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#1d241f]">
      <header className="sticky top-0 z-30 border-b border-black/8 bg-[#f5f4f0]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 md:px-9">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#1b2a21] text-[#d8ef83]"><BookOpen className="size-5" /></span><div><p className="font-semibold tracking-tight">Coverdesk</p><p className="text-[11px] text-black/45">Grade-book cover documentation</p></div></div>
          <Badge variant="outline" className="hidden border-black/10 bg-white px-3 py-1 text-black/55 sm:inline-flex">Academic Series · 2026</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-9 md:px-9 md:py-12">
        <div className="mb-9 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-[#63766a]">Cover library</p><h1 className="max-w-2xl text-4xl font-semibold tracking-[-.045em] md:text-5xl">Every cover, with its design story.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-black/52">Select a cover to review the artwork, visual system, specifications, delivery files and approval record.</p></div>
          <div className="relative w-full md:w-72"><Search className="absolute left-3 top-2.5 size-4 text-black/35" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search grade or subject" className="h-10 bg-white pl-9" /></div>
        </div>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Book cover gallery">
          {visible.map((cover) => {
            const index = covers.indexOf(cover);
            return <button key={`${cover.grade}-${cover.subject}`} onClick={() => setSelected(index)} className="group overflow-hidden rounded-[22px] border border-black/8 bg-white text-left shadow-[0_8px_28px_rgba(30,40,33,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(30,40,33,.12)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#476b56]">
              <div className="aspect-[3/4] overflow-hidden bg-[#e8e8e3]"><img src={cover.image} alt={`${cover.grade} ${cover.subject} book cover`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /></div>
              <div className="p-4"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium text-black/45">{cover.grade}</span><Badge className={statusClass[cover.status]}>{cover.status}</Badge></div><h2 className="text-lg font-semibold tracking-tight">{cover.subject}</h2><div className="mt-3 flex items-center justify-between border-t border-black/7 pt-3 text-xs text-black/45"><span>{cover.version}</span><span className="flex items-center gap-1 font-medium text-[#42604d]">View concept <ChevronRight className="size-3.5" /></span></div></div>
            </button>;
          })}
        </section>
      </div>

      {active && <div className="fixed inset-0 z-50 bg-[#111812]/70 p-2 backdrop-blur-sm md:p-5" role="dialog" aria-modal="true" aria-label={`${active.grade} ${active.subject} documentation`}>
        <div className="mx-auto grid h-full max-w-[1800px] overflow-hidden rounded-[24px] bg-white shadow-2xl lg:grid-cols-[minmax(0,4fr)_minmax(330px,1fr)]">
          <section className="relative flex min-h-0 items-center justify-center overflow-hidden bg-[#202821] p-5 md:p-10">
            <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-xs text-white/75 backdrop-blur-md"><FileText className="size-3.5" />{active.grade} · {active.subject}</div>
            <img src={active.image} alt={`${active.grade} ${active.subject} full cover`} className="max-h-full max-w-full rounded-lg object-contain shadow-[0_30px_80px_rgba(0,0,0,.38)]" />
            <Button onClick={() => move(-1)} variant="ghost" size="icon-lg" className="absolute left-3 top-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Previous cover"><ChevronLeft /></Button>
            <Button onClick={() => move(1)} variant="ghost" size="icon-lg" className="absolute right-3 top-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white" aria-label="Next cover"><ChevronRight /></Button>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-black/8 bg-[#fbfbf8]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/8 bg-[#fbfbf8]/95 px-6 py-4 backdrop-blur"><div className="flex gap-2"><Badge className={statusClass[active.status]}>{active.status}</Badge><Badge variant="outline">{active.version}</Badge></div><Button onClick={() => setSelected(null)} variant="ghost" size="icon" aria-label="Close documentation"><X /></Button></div>
            <div className="p-6 md:p-7">
              <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#66796d]">{active.grade}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">{active.subject}</h2>
              <section className="mt-8"><h3 className="text-base font-semibold">Design Concept</h3><p className="mt-3 text-sm leading-6 text-black/60">{active.concept}</p><ul className="mt-4 space-y-2 text-sm leading-5 text-black/58"><li>• Main theme: {active.inspiration}</li><li>• The friendly visual language suits the students’ age and learning stage.</li><li>• Grade, subject and palette create a distinct identity within the shared series.</li></ul></section>
              <section className="mt-8 border-t border-black/8 pt-7"><h3 className="text-base font-semibold">Colour Palette</h3><div className="mt-4 space-y-3">{active.palette.map((colour) => <div key={colour.hex} className="flex items-center gap-3"><span className="size-9 rounded-lg border border-black/8" style={{ backgroundColor: colour.hex }} /><div><p className="text-sm font-medium">{colour.name}</p><p className="font-mono text-xs text-black/45">{colour.hex}</p></div></div>)}</div></section>
              {documentation.map((section, sectionIndex) => <section key={section.title} className="mt-8 border-t border-black/8 pt-7"><div className="flex items-baseline gap-3"><span className="text-xs font-semibold text-[#718278]">0{sectionIndex + 1}</span><h3 className="text-base font-semibold">{section.title}</h3></div><ul className="mt-4 space-y-3">{section.items.map((item) => <li key={item} className="flex gap-2.5 text-sm leading-5 text-black/58"><Check className="mt-0.5 size-4 shrink-0 text-[#5b7c66]" />{item}</li>)}</ul></section>)}
              <div className="mt-9 rounded-2xl bg-[#eef3e9] p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#5f7466]">Approval</p><p className="mt-2 text-sm font-medium">Designer: __________________</p><p className="mt-2 text-sm font-medium">Client: ____________________</p><p className="mt-2 text-sm text-black/50">Date: ______________________</p></div>
            </div>
          </aside>
        </div>
      </div>}
    </main>
  );
}

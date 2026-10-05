'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookCheck,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Layers3,
  Lock,
  Search,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PdfPage from './pdf-page';

type Product = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  version: string;
  status: string;
  pageCount: number;
  coverImage: string;
  coverStatus: string;
  completion: number;
  qcPassed: number;
  attention: boolean;
  updatedAt: string;
  pdf: string;
};

const statusClass: Record<string, string> = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Ready for Review': 'border-amber-200 bg-amber-50 text-amber-700',
  'Changes Needed': 'border-orange-200 bg-orange-50 text-orange-700',
  Redo: 'border-red-200 bg-red-50 text-red-700',
  'On Hold': 'border-slate-200 bg-slate-100 text-slate-600',
};

function coverUrl(link: string) {
  const match =
    link.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    link.match(/[?&]id=([^&]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}=w1200` : link;
}

export default function ExecutiveDashboardClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [actualPages, setActualPages] = useState(1);
  const [executiveNote, setExecutiveNote] = useState('');
  const [decisionSaving, setDecisionSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/executive', { cache: 'no-store' });
        const data = (await response.json()) as {
          products?: Product[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || 'Unable to load dashboard');
        setProducts(data.products || []);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Unable to load dashboard',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const matchesQuery =
          `${product.title} ${product.grade} ${product.subject}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesFilter =
          filter === 'All'
            ? true
            : filter === 'Attention'
              ? product.attention
              : product.status === filter;
        return matchesQuery && matchesFilter;
      }),
    [products, query, filter],
  );
  const approved = products.filter(
    (product) => product.status === 'Approved',
  ).length;
  const ready = products.filter(
    (product) => product.status === 'Ready for Review',
  ).length;
  const attention = products.filter((product) => product.attention).length;
  const average = products.length
    ? Math.round(
        products.reduce((sum, product) => sum + product.completion, 0) /
          products.length,
      )
    : 0;
  const logout = async () => {
    await fetch('/api/access', { method: 'DELETE' });
    location.reload();
  };
  const openProduct = (product: Product) => {
    setSelected(product);
    setExecutiveNote('');
    setPage(1);
    setActualPages(product.pageCount);
  };
  const decide = async (action: 'approved' | 'returned') => {
    if (
      !selected ||
      decisionSaving ||
      (action === 'returned' && !executiveNote.trim())
    )
      return;
    setDecisionSaving(true);
    try {
      const response = await fetch('/api/executive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: selected.id,
          action,
          note: executiveNote,
        }),
      });
      const data = (await response.json()) as {
        status?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || 'Unable to save decision');
      const status =
        data.status || (action === 'approved' ? 'Approved' : 'Changes Needed');
      setProducts((items) =>
        items.map((product) =>
          product.id === selected.id
            ? {
                ...product,
                status,
                attention: action === 'returned',
                completion: action === 'approved' ? 100 : product.completion,
              }
            : product,
        ),
      );
      setSelected((product) => (product ? { ...product, status } : null));
      setExecutiveNote('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to save decision',
      );
    } finally {
      setDecisionSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f4ef] text-[#162019]">
      <header className="sticky top-0 z-40 border-b border-black/7 bg-[#17251d]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#d9ff62] text-[#17251d]">
              <Layers3 className="size-5" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">
                Publishing Command Center
              </p>
              <p className="text-xs text-white/45">
                Executive product overview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/docs/Coverdesk_Project_Logic_and_Workflow.pdf"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#d9ff62] px-4 text-sm font-semibold text-[#17251d] transition hover:bg-white"
            >
              <Download className="size-4" />
              Project workflow PDF
            </a>
            <Button
              onClick={logout}
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Lock />
              Lock dashboard
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1540px] px-6 py-8">
        <section className="overflow-hidden rounded-[30px] bg-[#17251d] px-7 py-8 text-white shadow-[0_24px_80px_rgba(23,37,29,.18)] md:px-10">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d9ff62]">
                Executive overview
              </p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-.045em] md:text-5xl">
                Finished products first. Decisions at a glance.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
                A clean view of publishing progress, ready products and items
                that need leadership attention.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[620px]">
              {[
                {
                  label: 'Total books',
                  value: products.length,
                  Icon: BookOpen,
                },
                { label: 'Approved', value: approved, Icon: CheckCircle2 },
                { label: 'Ready', value: ready, Icon: BookCheck },
                { label: 'Attention', value: attention, Icon: AlertTriangle },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[.06] p-4"
                >
                  <Icon className="size-4 text-[#d9ff62]" />
                  <p className="mt-5 text-3xl font-semibold">
                    {String(value).padStart(2, '0')}
                  </p>
                  <p className="mt-1 text-xs text-white/45">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex items-center gap-4 border-t border-white/10 pt-5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#d9ff62]"
                style={{ width: `${average}%` }}
              />
            </div>
            <p className="text-sm font-semibold">
              {average}% overall completion
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          {[
            [
              'Cover approved',
              products.filter((product) => product.coverStatus === 'Approved')
                .length,
            ],
            ['PDF uploaded', products.length],
            [
              'In review',
              products.filter(
                (product) =>
                  !['Approved', 'Changes Needed', 'Redo'].includes(
                    product.status,
                  ),
              ).length,
            ],
            [
              'Corrections',
              products.filter((product) =>
                ['Changes Needed', 'Redo'].includes(product.status),
              ).length,
            ],
            ['Print ready', approved],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className="relative rounded-2xl border border-black/7 bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-black/38">
                Stage {index + 1}
              </p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-black/50">{label}</p>
            </div>
          ))}
        </section>

        <div className="mt-9 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#66796d]">
              Product library
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-[-.035em]">
              All publishing work
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-white pl-10 sm:w-64"
                placeholder="Search book, grade or subject"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-9 rounded-lg border border-black/10 bg-white px-3 text-sm"
            >
              {[
                'All',
                'Attention',
                'Ready for Review',
                'Approved',
                'Changes Needed',
                'Redo',
                'On Hold',
              ].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl bg-white p-16 text-center text-black/40">
            Loading executive overview…
          </div>
        ) : error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-black/10 bg-white/60 p-16 text-center text-black/40">
            No products match this view.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <article
                key={product.id}
                className={`overflow-hidden rounded-[24px] border bg-white shadow-[0_12px_35px_rgba(30,40,33,.07)] ${product.attention ? 'border-orange-200' : 'border-black/7'}`}
              >
                <div className="relative aspect-[16/8] overflow-hidden bg-[#e7e9e3]">
                  {product.coverImage ? (
                    <img
                      src={coverUrl(product.coverImage)}
                      alt={`${product.title} cover`}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-black/35">
                      <BookOpen className="mb-2 size-8" />
                      Cover pending
                    </div>
                  )}
                  {product.attention && (
                    <Badge className="absolute right-3 top-3 border-orange-200 bg-orange-50 text-orange-700">
                      <AlertTriangle />
                      Attention
                    </Badge>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-black/40">
                        {product.grade} · {product.subject} · {product.version}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">
                        {product.title}
                      </h3>
                    </div>
                    <Badge
                      className={
                        statusClass[product.status] ||
                        statusClass['Ready for Review']
                      }
                    >
                      {product.status}
                    </Badge>
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs text-black/45">
                      <span>Production progress</span>
                      <span>{product.completion}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/[.06]">
                      <div
                        className="h-full rounded-full bg-[#81bd32]"
                        style={{ width: `${product.completion}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-black/7 border-y border-black/7 py-3 text-center">
                    <div>
                      <p className="font-semibold">{product.pageCount}</p>
                      <p className="text-[10px] text-black/40">Pages</p>
                    </div>
                    <div>
                      <p className="font-semibold">{product.qcPassed}/3</p>
                      <p className="text-[10px] text-black/40">QC passed</p>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {new Date(product.updatedAt).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' },
                        )}
                      </p>
                      <p className="text-[10px] text-black/40">Updated</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => openProduct(product)}
                    className="mt-5 w-full"
                  >
                    <Eye />
                    View ready product
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-[#111a15]/95 p-3 md:p-5">
          <div className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-[24px] bg-[#1b261f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
              <div>
                <p className="text-xs text-white/45">
                  {selected.grade} · {selected.subject} · {selected.version}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{selected.title}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={statusClass[selected.status]}>
                  {selected.status}
                </Badge>
                <a
                  href={selected.pdf}
                  download
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  <Download className="size-4" />
                  Download PDF
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelected(null)}
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  <X />
                </Button>
              </div>
            </div>
            <PdfPage
              url={selected.pdf}
              page={page}
              onPageCount={(count) => {
                setActualPages(count);
              }}
              fullscreen
              fitPage
            >
              {null}
            </PdfPage>
            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-3 text-sm text-white lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Input
                  value={executiveNote}
                  onChange={(event) => setExecutiveNote(event.target.value)}
                  placeholder="Short executive note (required when returning)"
                  className="border-white/15 bg-white/10 text-white placeholder:text-white/35"
                />
                <Button
                  onClick={() => void decide('approved')}
                  disabled={decisionSaving}
                  className="bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  <CheckCircle2 />
                  Approve final
                </Button>
                <Button
                  onClick={() => void decide('returned')}
                  disabled={decisionSaving || !executiveNote.trim()}
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  <AlertTriangle />
                  Return to team
                </Button>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft />
                </Button>
                <span>Page</span>
                <Input
                  type="number"
                  min={1}
                  max={actualPages}
                  value={page}
                  onChange={(event) =>
                    setPage(
                      Math.min(
                        actualPages,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    )
                  }
                  className="h-9 w-20 border-white/15 bg-white/10 text-center text-white"
                />
                <span>of {actualPages}</span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= actualPages}
                  onClick={() =>
                    setPage((value) => Math.min(actualPages, value + 1))
                  }
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

'use client';

import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Lock,
  CloudOff,
  RefreshCw,
  MapPin,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  MessageCircle,
  Pencil,
  Highlighter,
  Square,
  Undo2,
  Redo2,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import PdfPage from './pdf-page';
import { parsePdfLink } from '@/lib/pdf-link';
import {
  QC_LEVELS,
  emptyQc,
  getQc,
  reviewQc,
  type QcReview,
} from '@/lib/book-qc';

type Point = { x: number; y: number };
type AnnotationMark = {
  id: string;
  tool: 'pen' | 'highlight' | 'rectangle';
  points: Point[];
  color: string;
  width: number;
};
type Annotation = Point[] | AnnotationMark;
type Book = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  version: string;
  status: string;
  pdf: string;
  coverId?: string;
  uploader?: string;
  pageCount: number;
  annotations?: Record<string, Annotation[]>;
  qc?: QcReview[];
};
type BookComment = {
  id: number;
  page: number;
  text: string;
  time: string;
  done?: boolean;
  pin?: Point;
};
type ApprovedCover = {
  id: string;
  grade: string;
  subject: string;
  version: string;
  image: string;
};
const statuses = [
  'Ready for Review',
  'Changes Needed',
  'Redo',
  'On Hold',
] as const;
const blankBook: Book = {
  id: '',
  title: '',
  grade: '',
  subject: '',
  version: 'V1',
  status: 'Ready for Review',
  pdf: '',
  pageCount: 1,
  annotations: {},
};
const statusClass: Record<string, string> = {
  'Ready for Review': 'border-amber-200 bg-amber-50 text-amber-700',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Changes Needed': 'border-orange-200 bg-orange-50 text-orange-700',
  Redo: 'border-red-200 bg-red-50 text-red-700',
  'On Hold': 'border-slate-200 bg-slate-100 text-slate-600',
};

function driveImageUrl(link: string) {
  const match =
    link.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    link.match(/[?&]id=([^&]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}=w1600` : link;
}

function normaliseMark(annotation: Annotation, index: number): AnnotationMark {
  if (Array.isArray(annotation))
    return {
      id: `legacy-${index}`,
      tool: 'pen',
      points: annotation,
      color: '#ef4444',
      width: 2,
    };
  return annotation;
}

function ApprovedCoverImage({
  cover,
  contain = false,
}: {
  cover: ApprovedCover;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [cover.image]);
  if (!cover.image || failed)
    return (
      <div className="grid h-full w-full place-items-center bg-[#e8e8e3] p-4 text-center text-xs text-black/40">
        <span>
          <FileText className="mx-auto mb-2 size-5" />
          Image unavailable. Set the Drive file to “Anyone with the link”.
        </span>
      </div>
    );
  return (
    <img
      src={driveImageUrl(cover.image)}
      alt={`${cover.grade} ${cover.subject} approved cover`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`}
    />
  );
}

export default function BookReviewClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [comments, setComments] = useState<Record<string, BookComment[]>>({});
  const [approvedCovers, setApprovedCovers] = useState<ApprovedCover[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Book>(blankBook);
  const [page, setPage] = useState(1);
  const [actualPages, setActualPages] = useState<number | null>(null);
  const [focusedComment, setFocusedComment] = useState<number | null>(null);
  const strokeRef = useRef<Point[]>([]);
  const saveQueue = useRef(Promise.resolve(true));
  const [comment, setComment] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [annotationTool, setAnnotationTool] = useState<
    'pen' | 'highlight' | 'rectangle' | 'eraser'
  >('pen');
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [annotationWidth, setAnnotationWidth] = useState(2);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [redoMarks, setRedoMarks] = useState<Record<string, Annotation[]>>({});
  const [pinning, setPinning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [commentPanel, setCommentPanel] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () =>
      setFullscreen(
        Boolean(
          viewerRef.current && document.fullscreenElement === viewerRef.current,
        ),
      );
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const toggleFullscreen = async () => {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(false);
    } else {
      setFullscreen(true);
      try {
        await viewerRef.current?.requestFullscreen();
      } catch {
        /* Use the expanded in-page view if unsupported. */
      }
    }
  };
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [pendingPin, setPendingPin] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<
    'saved' | 'saving' | 'offline' | 'error'
  >('saved');
  const [qcSaving, setQcSaving] = useState(false);
  const [reviewer, setReviewer] = useState('');
  const [qcNote, setQcNote] = useState('');
  const [error, setError] = useState('');
  const active = books.find((book) => book.id === selected) || null;
  const coverForBook = (book: Book) =>
    approvedCovers.find((cover) => cover.id === book.coverId) ||
    (!book.coverId
      ? approvedCovers.find(
          (cover) =>
            cover.grade === book.grade &&
            cover.subject === book.subject &&
            cover.version === book.version,
        )
      : undefined);
  const activeCover = active ? coverForBook(active) : undefined;
  const activeComments = active ? comments[active.id] || [] : [];
  const unresolved = (book: Book) =>
    (comments[book.id] || []).filter((item) => !item.done).length;
  const grouped = useMemo(
    () =>
      Object.entries(
        books.reduce<Record<string, Book[]>>((result, book) => {
          (result[book.subject || 'Other'] ||= []).push(book);
          return result;
        }, {}),
      ),
    [books],
  );

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/books', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as {
            books: Book[];
            comments: Record<string, BookComment[]>;
            approvedCovers: ApprovedCover[];
          };
          setBooks(data.books);
          setComments(data.comments);
          setApprovedCovers(data.approvedCovers || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const save = (nextBooks = books, nextComments = comments) => {
    const snapshot = JSON.stringify({
      books: nextBooks,
      comments: nextComments,
    });
    localStorage.setItem('bookdesk-pending-save', snapshot);
    setSaveState(navigator.onLine ? 'saving' : 'offline');
    const operation = saveQueue.current.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (!navigator.onLine) {
            setSaveState('offline');
            return false;
          }
          const response = await fetch('/api/books', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: snapshot,
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            if (response.status < 500) {
              setError(
                response.status === 401
                  ? 'Your session expired. Unlock the book workspace again to save.'
                  : data?.error || 'Unable to save.',
              );
              setSaveState('error');
              return false;
            }
            throw new Error(data?.error || 'Server save failed');
          }
          localStorage.removeItem('bookdesk-pending-save');
          setError('');
          setSaveState('saved');
          return true;
        } catch {
          if (attempt < 2)
            await new Promise((resolve) =>
              setTimeout(resolve, 500 * (attempt + 1)),
            );
        }
      }
      setError(
        'Unable to save. Your changes are kept locally and will retry when the connection returns.',
      );
      setSaveState(navigator.onLine ? 'error' : 'offline');
      return false;
    });
    saveQueue.current = operation;
    return operation;
  };
  useEffect(() => {
    const retryPending = () => {
      const pending = localStorage.getItem('bookdesk-pending-save');
      if (!pending) {
        setSaveState('saved');
        return;
      }
      try {
        const parsed = JSON.parse(pending) as {
          books: Book[];
          comments: Record<string, BookComment[]>;
        };
        void save(parsed.books, parsed.comments);
      } catch {
        localStorage.removeItem('bookdesk-pending-save');
      }
    };
    const offline = () => setSaveState('offline');
    window.addEventListener('online', retryPending);
    window.addEventListener('offline', offline);
    retryPending();
    return () => {
      window.removeEventListener('online', retryPending);
      window.removeEventListener('offline', offline);
    };
  }, []);
  const logout = async () => {
    await fetch('/api/access', { method: 'DELETE' });
    location.reload();
  };
  const openBook = (book: Book) => {
    setZoom(100);
    setSelected(book.id);
    setActualPages(null);
    setCurrentStroke([]);
    strokeRef.current = [];
    setComment('');
    setPage(1);
    setEditing(false);
    setDrawing(false);
    setPinning(false);
    setCommentPanel(false);
    setPendingPin(null);
  };
  const newBook = () => {
    const cached = localStorage.getItem('bookdesk-form-draft');
    try {
      setDraft(
        cached ? { ...blankBook, ...(JSON.parse(cached) as Book) } : blankBook,
      );
    } catch {
      setDraft(blankBook);
    }
    setEditing(true);
    setSelected(null);
  };
  useEffect(() => {
    if (!editing) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      localStorage.setItem('bookdesk-form-draft', JSON.stringify(draft));
      setSaveState('saved');
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, editing]);
  const bookForCover = (cover: ApprovedCover) =>
    books.find(
      (book) =>
        book.coverId === cover.id ||
        (!book.coverId &&
          book.grade === cover.grade &&
          book.subject === cover.subject &&
          book.version === cover.version),
    );
  const openCover = (cover: ApprovedCover) => {
    const existing = bookForCover(cover);
    if (existing) {
      openBook(existing);
      return;
    }
    setDraft({
      ...blankBook,
      coverId: cover.id,
      title: `${cover.subject} — ${cover.grade}`,
      grade: cover.grade,
      subject: cover.subject,
      version: cover.version,
    });
    setSelected(null);
    setError('');
    setEditing(true);
  };
  const saveBook = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    let pdf: string;
    try {
      pdf = parsePdfLink(draft.pdf).url;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Enter a valid PDF file link.',
      );
      return;
    }
    const book = {
      ...draft,
      ...(draft.id && books.find((item) => item.id === draft.id)?.pdf !== pdf
        ? { qc: emptyQc(), status: 'Ready for Review' }
        : {}),
      pdf,
      id: draft.id || crypto.randomUUID(),
      pageCount: Math.max(1, Number(draft.pageCount) || 1),
    };
    const next = draft.id
      ? books.map((item) => (item.id === draft.id ? book : item))
      : [...books, book];
    setSaving(true);
    try {
      if (!(await save(next, comments))) return;
      setBooks(next);
      setDraft(book);
      localStorage.removeItem('bookdesk-form-draft');
      openBook(book);
    } catch {
      setError('Unable to save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };
  const deleteBook = async (book: Book) => {
    if (!confirm(`Delete ${book.title}?`)) return;
    const nextBooks = books.filter((item) => item.id !== book.id);
    const nextComments = { ...comments };
    delete nextComments[book.id];
    setBooks(nextBooks);
    setComments(nextComments);
    setSelected(null);
    await save(nextBooks, nextComments);
  };
  const setStatus = async (status: string) => {
    if (!active) return;
    const next = books.map((book) =>
      book.id === active.id
        ? {
            ...book,
            status,
            ...(getQc(book.qc).every((item) => item.status === 'approved')
              ? { qc: emptyQc() }
              : {}),
          }
        : book,
    );
    setBooks(next);
    await save(next, comments);
  };
  const decideQc = async (level: number, approved: boolean) => {
    if (!active || qcSaving) return;
    try {
      if (approved && unresolved(active))
        throw new Error(
          'Resolve the open page feedback before approving this level.',
        );
      const qc = reviewQc(active.qc, level, approved, reviewer, qcNote);
      const status = qc.every((item) => item.status === 'approved')
        ? 'Approved'
        : approved
          ? 'Ready for Review'
          : 'Changes Needed';
      const next = books.map((book) =>
        book.id === active.id ? { ...book, qc, status } : book,
      );
      setQcSaving(true);
      if (await save(next, comments)) {
        setBooks(next);
        setQcNote('');
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to save QC review.',
      );
    } finally {
      setQcSaving(false);
    }
  };
  const postComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !comment.trim()) return;
    const item = {
      id: Date.now(),
      page,
      text: comment.trim(),
      time: 'Just now',
      done: false,
      ...(pendingPin ? { pin: pendingPin } : {}),
    };
    const nextComments = {
      ...comments,
      [active.id]: [...activeComments, item],
    };
    const nextBooks = books.map((book) =>
      book.id === active.id
        ? {
            ...book,
            status: 'Changes Needed',
            ...(getQc(book.qc).every((item) => item.status === 'approved')
              ? { qc: emptyQc() }
              : {}),
          }
        : book,
    );
    setComments(nextComments);
    setBooks(nextBooks);
    if (await save(nextBooks, nextComments)) {
      setComment('');
      setPendingPin(null);
    }
  };
  const toggleDone = async (id: number) => {
    if (!active) return;
    const next = {
      ...comments,
      [active.id]: activeComments.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    };
    setComments(next);
    await save(books, next);
  };
  const pointerPoint = (
    event: ReactPointerEvent<SVGSVGElement> | ReactMouseEvent<SVGSVGElement>,
  ) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - box.left) / box.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - box.top) / box.height) * 100),
      ),
    };
  };
  const startStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pinning) {
      setPendingPin(pointerPoint(event));
      setPinning(false);
      setCommentPanel(true);
      setFocusedComment(null);
      return;
    }
    if (!drawing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    strokeRef.current = [pointerPoint(event)];
    setCurrentStroke(strokeRef.current);
  };
  const moveStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || !event.currentTarget.hasPointerCapture(event.pointerId))
      return;
    // React clears currentTarget after the handler; state updaters may run later.
    const point = pointerPoint(event);
    strokeRef.current = [...strokeRef.current, point];
    setCurrentStroke(strokeRef.current);
  };
  const finishStroke = async (event: ReactPointerEvent<SVGSVGElement>) => {
    const stroke = strokeRef.current;
    strokeRef.current = [];
    if (!active || stroke.length < 2) {
      setCurrentStroke([]);
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const points =
      annotationTool === 'rectangle'
        ? [stroke[0], stroke[stroke.length - 1]]
        : stroke;
    const mark: AnnotationMark = {
      id: crypto.randomUUID(),
      tool: annotationTool === 'eraser' ? 'pen' : annotationTool,
      points,
      color: annotationColor,
      width: annotationWidth,
    };
    const annotations = {
      ...(active.annotations || {}),
      [String(page)]: [...(active.annotations?.[String(page)] || []), mark],
    };
    const next = books.map((book) =>
      book.id === active.id ? { ...book, annotations } : book,
    );
    setBooks(next);
    setPendingPin(stroke[stroke.length - 1]);
    setCommentPanel(true);
    setFocusedComment(null);
    setCurrentStroke([]);
    setRedoMarks((current) => ({ ...current, [String(page)]: [] }));
    await save(next, comments);
  };
  const removeMark = async (markIndex: number) => {
    if (!active) return;
    const pageKey = String(page);
    const marks = [...(active.annotations?.[pageKey] || [])];
    const [removed] = marks.splice(markIndex, 1);
    const annotations = { ...(active.annotations || {}), [pageKey]: marks };
    const next = books.map((book) =>
      book.id === active.id ? { ...book, annotations } : book,
    );
    setBooks(next);
    setRedoMarks((current) => ({
      ...current,
      [pageKey]: removed
        ? [...(current[pageKey] || []), removed]
        : current[pageKey] || [],
    }));
    await save(next, comments);
  };
  const undoAnnotation = async () => {
    if (!active) return;
    const marks = active.annotations?.[String(page)] || [];
    if (!marks.length) return;
    await removeMark(marks.length - 1);
  };
  const redoAnnotation = async () => {
    if (!active) return;
    const pageKey = String(page);
    const stack = redoMarks[pageKey] || [];
    const restored = stack[stack.length - 1];
    if (!restored) return;
    const annotations = {
      ...(active.annotations || {}),
      [pageKey]: [...(active.annotations?.[pageKey] || []), restored],
    };
    const next = books.map((book) =>
      book.id === active.id ? { ...book, annotations } : book,
    );
    setBooks(next);
    setRedoMarks((current) => ({ ...current, [pageKey]: stack.slice(0, -1) }));
    await save(next, comments);
  };
  const clearPageDrawing = async () => {
    if (!active) return;
    const annotations = { ...(active.annotations || {}), [String(page)]: [] };
    const next = books.map((book) =>
      book.id === active.id ? { ...book, annotations } : book,
    );
    setBooks(next);
    await save(next, comments);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_0_0,#edffad_0,transparent_25%),radial-gradient(circle_at_100%_35%,#fff0ae_0,transparent_28%),#f5f4ee] text-[#171914]">
      <header className="sticky top-0 z-40 border-b border-black/7 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#78d11f]">
              <BookOpen className="size-5" />
            </span>
            <div>
              <p className="font-extrabold">Bookdesk</p>
              <p className="text-[11px] text-black/40">Complete book review</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${saveState === 'saved' ? 'bg-emerald-50 text-emerald-700' : saveState === 'saving' ? 'bg-blue-50 text-blue-700' : saveState === 'offline' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}
            >
              {saveState === 'saved' ? (
                <CheckCircle2 className="size-3.5" />
              ) : saveState === 'saving' ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <CloudOff className="size-3.5" />
              )}
              {saveState === 'saved'
                ? 'Saved'
                : saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'offline'
                    ? 'Offline · retry queued'
                    : 'Save failed · retry queued'}
            </span>
            <Button variant="outline" onClick={newBook}>
              <Plus />
              Add book
            </Button>
            <Button variant="ghost" onClick={logout}>
              <Lock />
              Lock
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-9">
        {error && !editing && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {editing ? (
          <form
            onSubmit={saveBook}
            className="mx-auto max-w-3xl rounded-[28px] border border-black/8 bg-white/85 p-7 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#64766a]">
                  Book setup
                </p>
                <h1 className="mt-2 text-3xl font-semibold">
                  {draft.id ? 'Update book PDF' : 'Upload book PDF link'}
                </h1>
                <p className="mt-2 text-sm text-black/45">
                  Paste one shared Google Drive PDF link and enter the total
                  number of pages.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditing(false)}
              >
                <X />
              </Button>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Book title
                <Input
                  className="mt-2"
                  required
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold">
                Subject
                <Input
                  className="mt-2"
                  required
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold">
                Grade
                <Input
                  className="mt-2"
                  required
                  value={draft.grade}
                  onChange={(e) =>
                    setDraft({ ...draft, grade: e.target.value })
                  }
                  placeholder="Grade 1"
                />
              </label>
              <label className="text-xs font-semibold">
                Version
                <Input
                  className="mt-2"
                  value={draft.version}
                  onChange={(e) =>
                    setDraft({ ...draft, version: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-semibold sm:col-span-2">
                PDF link (Google Drive or direct URL)
                <Input
                  className="mt-2"
                  required
                  type="url"
                  value={draft.pdf}
                  onChange={(e) => setDraft({ ...draft, pdf: e.target.value })}
                  placeholder="https://drive.google.com/file/d/.../view"
                />
                <span className="mt-2 block text-xs font-normal text-black/55">
                  Open the PDF in Drive → Share → Copy link. Folder and search
                  links cannot be used.
                </span>
              </label>
              <label htmlFor="book-uploader" className="text-xs font-semibold">
                Book uploader name
                <Input
                  id="book-uploader"
                  className="mt-2"
                  required
                  value={draft.uploader || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, uploader: e.target.value })
                  }
                  placeholder="Your name"
                />
              </label>
              <label className="text-xs font-semibold">
                Total pages
                <Input
                  className="mt-2"
                  type="number"
                  min={1}
                  required
                  value={draft.pageCount}
                  onChange={(e) =>
                    setDraft({ ...draft, pageCount: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="mt-7 w-full" disabled={saving}>
              <Save />
              {saving ? 'Saving…' : 'Save PDF and open review'}
            </Button>
          </form>
        ) : active ? (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Close book review"
              title="Close book review"
              onClick={() => setSelected(null)}
              className="absolute -right-3 -top-3 z-40 size-10 rounded-full border-black/15 bg-white text-black shadow-md hover:bg-stone-100"
            >
              <X className="size-5" />
            </Button>
            <section className="grid min-h-[calc(100vh-145px)] overflow-hidden rounded-[28px] border border-white/80 bg-white/70 shadow-2xl xl:grid-cols-[minmax(0,1fr)_360px]">
              <div
                ref={viewerRef}
                className={
                  fullscreen
                    ? 'fixed inset-0 z-50 flex h-dvh w-full flex-col bg-[#1c271f] p-3'
                    : 'relative flex min-h-[720px] flex-col bg-[#1c271f] p-5'
                }
              >
                <div className="mb-4 flex items-center justify-between gap-3 text-white">
                  <div>
                    <p className="text-xs text-white/45">
                      {active.grade} · {active.subject} · {active.version}
                    </p>
                    <h1 className="mt-1 text-lg font-semibold">
                      {active.title}
                    </h1>
                  </div>
                  <div
                    className={
                      fullscreen
                        ? 'absolute right-4 top-4 z-40 flex max-w-[90%] flex-wrap justify-end gap-2 rounded-2xl bg-[#1c271f]/95 p-3 shadow-xl'
                        : 'flex flex-wrap items-center gap-2'
                    }
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/25 bg-[#f5f5ef] text-[#1c271f] hover:bg-white hover:text-[#1c271f]"
                      onClick={() => void toggleFullscreen()}
                      aria-label={
                        fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                      }
                    >
                      {fullscreen ? <Minimize /> : <Maximize />}
                      {fullscreen ? 'Exit' : 'Fullscreen'}
                    </Button>
                    <div
                      role="group"
                      aria-label="PDF zoom"
                      className="flex items-center gap-1 rounded-lg bg-[#f5f5ef] p-0.5 text-[#1c271f]"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Zoom out"
                        title="Zoom out"
                        disabled={zoom <= 50}
                        onClick={() =>
                          setZoom((value) => Math.max(50, value - 25))
                        }
                        className="text-[#1c271f] hover:bg-black/10 hover:text-[#1c271f]"
                      >
                        <ZoomOut />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Zoom ${zoom} percent. Reset to fit width`}
                        title="Reset to fit width"
                        onClick={() => setZoom(100)}
                        className="min-w-14 text-[#1c271f] hover:bg-black/10 hover:text-[#1c271f]"
                      >
                        {zoom}%
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Zoom in"
                        title="Zoom in"
                        disabled={zoom >= 300}
                        onClick={() =>
                          setZoom((value) => Math.min(300, value + 25))
                        }
                        className="text-[#1c271f] hover:bg-black/10 hover:text-[#1c271f]"
                      >
                        <ZoomIn />
                      </Button>
                    </div>
                    <Button
                      variant={pinning ? 'default' : 'outline'}
                      size="sm"
                      className={
                        pinning
                          ? 'border-[#dafa73] bg-[#dafa73] text-[#1c271f] hover:bg-[#c9ed61] hover:text-[#1c271f]'
                          : 'border-white/25 bg-[#f5f5ef] text-[#1c271f] hover:bg-white hover:text-[#1c271f]'
                      }
                      aria-pressed={pinning}
                      onClick={() => {
                        setPinning(!pinning);
                        setDrawing(false);
                      }}
                    >
                      <MapPin />
                      Pin
                    </Button>
                    {fullscreen && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          commentPanel
                            ? 'border-[#dafa73] bg-[#dafa73] text-[#1c271f] hover:bg-[#c9ed61] hover:text-[#1c271f]'
                            : 'border-white/25 bg-[#f5f5ef] text-[#1c271f] hover:bg-white hover:text-[#1c271f]'
                        }
                        aria-pressed={commentPanel}
                        onClick={() => setCommentPanel(!commentPanel)}
                      >
                        <MessageCircle />
                        Comment
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setDrawing(!(drawing && annotationTool === 'pen'));
                        setAnnotationTool('pen');
                        setPinning(false);
                      }}
                      variant={drawing ? 'default' : 'outline'}
                      size="sm"
                      className={
                        drawing
                          ? 'bg-[#dafa73] text-[#1c271f] hover:bg-[#dafa73]/90'
                          : 'border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white'
                      }
                    >
                      <Pencil />
                      {drawing ? 'Drawing on' : 'Scribble'}
                    </Button>
                    <Button
                      onClick={() => {
                        setDrawing(true);
                        setAnnotationTool('highlight');
                        setPinning(false);
                      }}
                      variant="outline"
                      size="sm"
                      className={
                        drawing && annotationTool === 'highlight'
                          ? 'bg-[#dafa73] text-[#1c271f]'
                          : 'border-white/20 bg-white/5 text-white'
                      }
                    >
                      <Highlighter />
                      Highlight
                    </Button>
                    <Button
                      onClick={() => {
                        setDrawing(true);
                        setAnnotationTool('rectangle');
                        setPinning(false);
                      }}
                      variant="outline"
                      size="sm"
                      className={
                        drawing && annotationTool === 'rectangle'
                          ? 'bg-[#dafa73] text-[#1c271f]'
                          : 'border-white/20 bg-white/5 text-white'
                      }
                    >
                      <Square />
                      Rectangle
                    </Button>
                    <Button
                      onClick={() => {
                        setDrawing(false);
                        setAnnotationTool('eraser');
                        setPinning(false);
                      }}
                      variant="outline"
                      size="sm"
                      className={
                        annotationTool === 'eraser'
                          ? 'bg-red-100 text-red-700'
                          : 'border-white/20 bg-white/5 text-white'
                      }
                    >
                      <Eraser />
                      Erase mark
                    </Button>
                    <input
                      type="color"
                      value={annotationColor}
                      onChange={(event) =>
                        setAnnotationColor(event.target.value)
                      }
                      aria-label="Annotation colour"
                      title="Annotation colour"
                      className="size-8 rounded border border-white/20 bg-transparent"
                    />
                    <select
                      value={annotationWidth}
                      onChange={(event) =>
                        setAnnotationWidth(Number(event.target.value))
                      }
                      aria-label="Annotation line width"
                      className="h-8 rounded border border-white/20 bg-[#f5f5ef] px-2 text-xs text-[#1c271f]"
                    >
                      <option value={1}>Thin</option>
                      <option value={2}>Medium</option>
                      <option value={4}>Thick</option>
                    </select>
                    <Button
                      onClick={() => void undoAnnotation()}
                      disabled={!active.annotations?.[String(page)]?.length}
                      variant="outline"
                      size="icon-sm"
                      className="border-white/20 bg-white/5 text-white"
                      aria-label="Undo annotation"
                    >
                      <Undo2 />
                    </Button>
                    <Button
                      onClick={() => void redoAnnotation()}
                      disabled={!redoMarks[String(page)]?.length}
                      variant="outline"
                      size="icon-sm"
                      className="border-white/20 bg-white/5 text-white"
                      aria-label="Redo annotation"
                    >
                      <Redo2 />
                    </Button>
                    <Button
                      onClick={() => setShowAnnotations(!showAnnotations)}
                      variant="outline"
                      size="icon-sm"
                      className="border-white/20 bg-white/5 text-white"
                      aria-label={
                        showAnnotations
                          ? 'Hide annotations'
                          : 'Show annotations'
                      }
                    >
                      {showAnnotations ? <EyeOff /> : <Eye />}
                    </Button>
                    <Button
                      onClick={() => void clearPageDrawing()}
                      variant="outline"
                      size="sm"
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    >
                      <Eraser />
                      Clear page
                    </Button>
                    <Badge className={statusClass[active.status]}>
                      {active.status}
                    </Badge>
                  </div>
                </div>
                <PdfPage
                  key={`${active.id}-${active.pdf}`}
                  url={active.pdf}
                  page={page}
                  onPageCount={setActualPages}
                  fullscreen={fullscreen}
                  zoom={zoom}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    onPointerDown={startStroke}
                    onPointerMove={moveStroke}
                    onPointerUp={finishStroke}
                    onPointerCancel={finishStroke}
                    onDoubleClick={(event) => {
                      const point = pointerPoint(event);
                      setPendingPin(point);
                      setDrawing(false);
                    }}
                    className={`absolute inset-0 z-10 h-full w-full touch-none ${drawing || pinning || annotationTool === 'eraser' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
                    aria-label="Page drawing layer"
                  >
                    {showAnnotations &&
                      [
                        ...(active.annotations?.[String(page)] || []),
                        ...(currentStroke.length ? [currentStroke] : []),
                      ].map((annotation, index) => {
                        const mark = normaliseMark(annotation, index);
                        const first = mark.points[0];
                        const last = mark.points[mark.points.length - 1];
                        const selectMark = () => {
                          if (annotationTool === 'eraser') {
                            void removeMark(index);
                            return;
                          }
                          const linked = activeComments.find(
                            (item) =>
                              item.page === page &&
                              item.pin?.x === last?.x &&
                              item.pin?.y === last?.y,
                          );
                          if (linked) {
                            setFocusedComment(linked.id);
                            setCommentPanel(true);
                            if (!fullscreen)
                              document
                                .getElementById(`feedback-${linked.id}`)
                                ?.scrollIntoView({
                                  behavior: 'smooth',
                                  block: 'nearest',
                                });
                          } else {
                            setPendingPin(last || null);
                            setCommentPanel(true);
                            if (!fullscreen)
                              document.getElementById('page-feedback')?.focus();
                          }
                        };
                        const common = {
                          fill: 'none',
                          stroke: mark.color,
                          strokeWidth:
                            mark.tool === 'highlight'
                              ? Math.max(8, mark.width * 3)
                              : mark.width,
                          vectorEffect: 'non-scaling-stroke' as const,
                          style: {
                            pointerEvents:
                              drawing || pinning
                                ? ('none' as const)
                                : ('stroke' as const),
                            cursor:
                              annotationTool === 'eraser'
                                ? 'not-allowed'
                                : 'pointer',
                          },
                          onClick: selectMark,
                        };
                        return mark.tool === 'rectangle' ? (
                          <rect
                            key={mark.id}
                            x={Math.min(first.x, last.x)}
                            y={Math.min(first.y, last.y)}
                            width={Math.abs(last.x - first.x)}
                            height={Math.abs(last.y - first.y)}
                            {...common}
                          />
                        ) : (
                          <polyline
                            key={mark.id}
                            points={mark.points
                              .map((point) => `${point.x},${point.y}`)
                              .join(' ')}
                            strokeOpacity={mark.tool === 'highlight' ? 0.38 : 1}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            {...common}
                          />
                        );
                      })}
                  </svg>
                  {activeComments
                    .filter((item) => item.page === page && item.pin)
                    .map((item, index) => (
                      <button
                        key={item.id}
                        title={item.text}
                        onClick={() => {
                          setFocusedComment(item.id);
                          setCommentPanel(true);
                          if (!fullscreen)
                            document
                              .getElementById(`feedback-${item.id}`)
                              ?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'nearest',
                              });
                        }}
                        aria-label={`Read comment: ${item.text}`}
                        className="absolute z-20 grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-red-500 text-xs font-bold text-white shadow-lg ring-2 ring-white"
                        style={{
                          left: `${item.pin!.x}%`,
                          top: `${item.pin!.y}%`,
                        }}
                      >
                        {index + 1}
                      </button>
                    ))}
                  {pendingPin && (
                    <span
                      className="absolute z-20 grid size-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full bg-amber-400 text-xs font-bold text-black ring-2 ring-white"
                      style={{
                        left: `${pendingPin.x}%`,
                        top: `${pendingPin.y}%`,
                      }}
                    >
                      <MapPin className="size-4" />
                    </span>
                  )}
                </PdfPage>
                {fullscreen && commentPanel && (
                  <div className="absolute bottom-20 right-4 z-40 max-h-[60vh] w-[min(340px,calc(100%-2rem))] overflow-auto rounded-2xl bg-white p-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">Page {page} feedback</h2>
                      <Button
                        aria-label="Close comments"
                        variant="ghost"
                        size="icon"
                        onClick={() => setCommentPanel(false)}
                      >
                        <X />
                      </Button>
                    </div>
                    {activeComments
                      .filter((item) => item.page === page)
                      .map((item) => (
                        <div
                          key={item.id}
                          className={`mt-3 rounded-xl border p-3 text-sm ${focusedComment === item.id ? 'border-amber-400 bg-amber-50' : 'border-black/10'}`}
                        >
                          <p className="break-words">{item.text}</p>
                          <Button
                            className="mt-2"
                            size="sm"
                            variant="outline"
                            onClick={() => void toggleDone(item.id)}
                          >
                            {item.done ? 'Reopen' : 'Mark done'}
                          </Button>
                        </div>
                      ))}
                    <form onSubmit={postComment} className="mt-3">
                      <label
                        htmlFor="fullscreen-feedback"
                        className="text-xs font-semibold"
                      >
                        {pendingPin
                          ? 'Comment on selected mark / pin'
                          : 'Comment on this page'}
                      </label>
                      <Textarea
                        id="fullscreen-feedback"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Write feedback…"
                        className="mt-2 bg-white"
                      />
                      {error && (
                        <p role="alert" className="mt-2 text-xs text-red-600">
                          {error}
                        </p>
                      )}
                      <Button
                        type="submit"
                        className="mt-3 w-full"
                        disabled={!comment.trim()}
                      >
                        <Send />
                        Post feedback
                      </Button>
                    </form>
                  </div>
                )}
                <Button
                  onClick={() => {
                    setPage(Math.max(1, page - 1));
                    setPendingPin(null);
                    setComment('');
                    setCurrentStroke([]);
                    strokeRef.current = [];
                  }}
                  disabled={page <= 1}
                  variant="ghost"
                  size="icon-lg"
                  className="absolute left-7 top-1/2 z-30 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  onClick={() => {
                    setPage(
                      Math.min(actualPages ?? active.pageCount, page + 1),
                    );
                    setPendingPin(null);
                    setComment('');
                    setCurrentStroke([]);
                    strokeRef.current = [];
                  }}
                  disabled={page >= (actualPages ?? active.pageCount)}
                  variant="ghost"
                  size="icon-lg"
                  className="absolute right-7 top-1/2 z-30 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
                >
                  <ChevronRight />
                </Button>
                <div className="mt-4 flex items-center justify-center gap-3 text-sm text-white">
                  <span>Page</span>
                  <Input
                    className="h-9 w-20 border-white/15 bg-white/10 text-center text-white"
                    type="number"
                    min={1}
                    max={actualPages ?? active.pageCount}
                    value={page}
                    onChange={(e) => {
                      setPage(
                        Math.min(
                          actualPages ?? active.pageCount,
                          Math.max(1, Number(e.target.value) || 1),
                        ),
                      );
                      setPendingPin(null);
                      setComment('');
                      setCurrentStroke([]);
                      strokeRef.current = [];
                    }}
                  />
                  <span>of {actualPages ?? active.pageCount}</span>
                  <span className="ml-3 text-xs text-white/45">
                    Draw a mark, then write feedback to pin it to that location.
                  </span>
                </div>
              </div>
              <aside className="max-h-[calc(100vh-145px)] overflow-y-auto p-6">
                <div className="mb-5 flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-3">
                  <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-[#f2f2ec]">
                    {activeCover ? (
                      <ApprovedCoverImage
                        key={activeCover.image}
                        cover={activeCover}
                        contain
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-black/40">
                        <BookOpen className="size-7" />
                        <span className="text-[10px]">No cover linked</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#607468]">
                      Book cover
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold">
                      {active.title}
                    </p>
                    <p className="mt-1 text-xs text-black/45">
                      {active.grade} · {active.version}
                    </p>
                  </div>
                </div>
                <p className="mb-3 text-sm text-black/55">
                  Uploaded by {active.uploader || 'Not recorded'}
                </p>
                <Button
                  variant="outline"
                  className="mb-5"
                  onClick={() => {
                    setDraft(active);
                    setEditing(true);
                  }}
                >
                  <FileText /> Update PDF link
                </Button>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#607468]">
                      Review status
                    </p>
                    <p className="mt-1 text-xs text-black/40">
                      Decision for the complete book
                    </p>
                  </div>
                </div>
                <section
                  aria-label="Three-level quality control"
                  className="mt-5 space-y-3"
                >
                  <h2 className="font-semibold">
                    Quality control ·{' '}
                    {
                      getQc(active.qc).filter(
                        (item) => item.status === 'approved',
                      ).length
                    }
                    /3 passed
                  </h2>
                  <label
                    htmlFor="qc-reviewer"
                    className="block text-xs font-semibold"
                  >
                    Reviewer name
                  </label>
                  <Input
                    id="qc-reviewer"
                    value={reviewer}
                    onChange={(event) => setReviewer(event.target.value)}
                    placeholder="Your name"
                  />
                  <label
                    htmlFor="qc-note"
                    className="block text-xs font-semibold"
                  >
                    QC notes
                  </label>
                  <Textarea
                    id="qc-note"
                    value={qcNote}
                    onChange={(event) => setQcNote(event.target.value)}
                    placeholder="Required when requesting changes"
                  />
                  {QC_LEVELS.map((label, level) => {
                    const review = getQc(active.qc)[level];
                    const locked = getQc(active.qc)
                      .slice(0, level)
                      .some((item) => item.status !== 'approved');
                    return (
                      <div
                        key={label}
                        className={`rounded-2xl border p-4 ${review.status === 'approved' ? 'border-emerald-200 bg-emerald-50' : 'border-black/10 bg-white'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">
                            QC {level + 1} · {label}
                          </h3>
                          {review.status === 'approved' && (
                            <Check className="size-4 text-emerald-700" />
                          )}
                        </div>
                        <p className="mt-1 text-xs text-black/55">
                          {locked
                            ? 'Locked until the previous level passes'
                            : review.status === 'approved'
                              ? 'Passed'
                              : review.status === 'changes-needed'
                                ? 'Changes needed'
                                : 'Awaiting review'}
                        </p>
                        {review.reviewer && (
                          <p className="mt-2 text-xs text-black/55">
                            {review.reviewer} ·{' '}
                            {new Date(review.reviewedAt).toLocaleString()}
                          </p>
                        )}
                        {review.note && (
                          <p className="mt-2 break-words text-sm">
                            {review.note}
                          </p>
                        )}
                        {!locked && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {review.status !== 'approved' && (
                              <Button
                                size="sm"
                                disabled={
                                  qcSaving ||
                                  !reviewer.trim() ||
                                  unresolved(active) > 0
                                }
                                onClick={() => void decideQc(level, true)}
                              >
                                Pass QC {level + 1}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                qcSaving || !reviewer.trim() || !qcNote.trim()
                              }
                              onClick={() => void decideQc(level, false)}
                            >
                              {review.status === 'approved'
                                ? 'Reopen level'
                                : 'Request changes'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {unresolved(active) > 0 && (
                    <p className="text-xs text-amber-700">
                      Resolve {unresolved(active)} open feedback item(s) before
                      passing QC.
                    </p>
                  )}
                  <p className="text-xs text-black/45">
                    Reopening a level resets later approvals. Replacing the PDF
                    starts QC again.
                  </p>
                </section>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => void setStatus(status)}
                      className={`min-h-14 rounded-2xl border px-3 text-left text-sm transition ${active.status === status ? 'border-[#1c2b22] bg-[#1c2b22] text-white shadow-lg' : 'border-black/8 bg-white hover:border-black/20'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <div className="mt-8 border-t border-black/8 pt-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Page feedback</h2>
                    <Badge>{activeComments.length}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-black/40">
                    Comments are saved against the selected page.
                  </p>
                  <div className="mt-4 space-y-3">
                    {activeComments.map((item) => (
                      <article
                        key={item.id}
                        id={`feedback-${item.id}`}
                        style={
                          focusedComment === item.id
                            ? { outline: '2px solid #eab308' }
                            : undefined
                        }
                        className={`rounded-2xl border p-4 ${item.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-black/8 bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              setPage(item.page);
                              setPendingPin(null);
                              setComment('');
                              setFocusedComment(item.id);
                            }}
                            className="rounded-full bg-[#edf1e8] px-2.5 py-1 text-xs font-semibold"
                          >
                            Page {item.page}
                            {item.pin ? ' · Pinned' : ''}
                          </button>
                          <span className="text-[10px] text-black/35">
                            {item.time}
                          </span>
                        </div>
                        <p
                          className={`mt-3 break-words text-sm leading-5 ${item.done ? 'text-black/40 line-through' : 'text-black/65'}`}
                        >
                          {item.text}
                        </p>
                        <Button
                          onClick={() => void toggleDone(item.id)}
                          size="sm"
                          variant={item.done ? 'outline' : 'default'}
                          className="mt-3"
                        >
                          <Check />
                          {item.done ? 'Reopen' : 'Mark done'}
                        </Button>
                      </article>
                    ))}
                  </div>
                  <form
                    onSubmit={postComment}
                    className="mt-5 rounded-2xl bg-[#eef3e9] p-4"
                  >
                    <label className="flex items-center justify-between text-xs font-semibold">
                      <span>Comment for page {page}</span>
                      {pendingPin && (
                        <span className="flex items-center gap-1 text-amber-700">
                          <MapPin className="size-3" />
                          Pinned on page
                        </span>
                      )}
                    </label>
                    <Textarea
                      id="page-feedback"
                      className="mt-2 min-h-24 bg-white"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Write feedback for this page…"
                    />
                    <Button
                      type="submit"
                      className="mt-3 w-full"
                      disabled={!comment.trim()}
                    >
                      <Send />
                      Post feedback
                    </Button>
                  </form>
                </div>
              </aside>
            </section>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#64766a]">
                  Complete book library
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-[-.045em]">
                  Build and review every page.
                </h1>
                <p className="mt-3 text-sm text-black/48">
                  Choose an approved cover, add the complete PDF, then review
                  and mark every page.
                </p>
              </div>
              <Button onClick={newBook}>
                <Plus />
                Add complete book
              </Button>
            </div>
            {approvedCovers.length > 0 && (
              <section className="mb-8 rounded-[28px] border border-black/8 bg-white/65 p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#68796f]">
                      Approved cover library
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      Approved artwork only
                    </h2>
                    <p className="mt-1 text-xs text-black/40">
                      Internal comments and design concepts are hidden in this
                      workspace.
                    </p>
                  </div>
                  <Badge>{approvedCovers.length} approved</Badge>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                  {approvedCovers.map((cover) => (
                    <button
                      type="button"
                      key={cover.id}
                      onClick={() => openCover(cover)}
                      className="overflow-hidden rounded-2xl border border-black/8 bg-white text-left transition hover:border-emerald-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-emerald-600"
                    >
                      <div className="aspect-video bg-[#e8e8e3]">
                        <ApprovedCoverImage cover={cover} />
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-black/40">
                          {cover.grade} · {cover.version}
                        </p>
                        <p className="mt-1 font-semibold">{cover.subject}</p>
                        <Badge className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-700">
                          Approved
                        </Badge>
                        <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                          {bookForCover(cover)
                            ? 'Open book review'
                            : 'Add PDF link'}{' '}
                          <ChevronRight className="size-4" />
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {loading ? (
              <div className="rounded-3xl bg-white/70 p-12 text-center text-black/40">
                Loading books…
              </div>
            ) : books.length === 0 ? (
              <button
                onClick={newBook}
                className="w-full rounded-3xl border border-dashed border-black/15 bg-white/60 py-24 text-black/45"
              >
                <BookOpen className="mx-auto mb-4 size-10" />
                No complete books yet. Add the first PDF.
              </button>
            ) : (
              <div className="space-y-8">
                {grouped.map(([subject, items]) => (
                  <section
                    key={subject}
                    className="rounded-[28px] border border-black/8 bg-white/65 p-6"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#68796f]">
                      Subject
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">{subject}</h2>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((book) => {
                        const cover = coverForBook(book);
                        return (
                          <article
                            key={book.id}
                            className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm"
                          >
                            <button
                              onClick={() => openBook(book)}
                              className="block w-full text-left"
                            >
                              <div className="relative aspect-[16/8] overflow-hidden bg-[#f2f2ec]">
                                {cover ? (
                                  <ApprovedCoverImage
                                    key={cover.image}
                                    cover={cover}
                                    contain
                                  />
                                ) : (
                                  <div className="flex h-full flex-col items-center justify-center gap-3 text-black/40">
                                    <BookOpen className="size-12" />
                                    <span className="text-xs">
                                      No cover linked
                                    </span>
                                  </div>
                                )}
                                <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">
                                  {book.pageCount}{' '}
                                  {book.pageCount === 1 ? 'page' : 'pages'}
                                </span>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-black/40">
                                    {book.grade} · {book.version}
                                  </span>
                                  <Badge className={statusClass[book.status]}>
                                    {book.status}
                                  </Badge>
                                </div>
                                <h3 className="mt-3 text-xl font-semibold">
                                  {book.title}
                                </h3>
                                <p className="mt-2 text-xs font-medium text-[#42604d]">
                                  QC ·{' '}
                                  {
                                    getQc(book.qc).filter(
                                      (item) => item.status === 'approved',
                                    ).length
                                  }
                                  /3 passed
                                </p>
                                <div className="mt-5 flex items-center justify-between border-t border-black/7 pt-4 text-sm text-[#42604d]">
                                  <span>
                                    {unresolved(book) > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                                        <MessageCircle className="size-3" />
                                        {unresolved(book)}
                                      </span>
                                    )}
                                  </span>
                                  <span>
                                    Open book{' '}
                                    <ChevronRight className="inline size-4" />
                                  </span>
                                </div>
                              </div>
                            </button>
                            <div className="flex border-t border-black/7">
                              <button
                                onClick={() => {
                                  setDraft(book);
                                  setEditing(true);
                                }}
                                className="flex-1 px-4 py-3 text-xs font-semibold text-black/50 hover:bg-black/[.03]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void deleteBook(book)}
                                className="border-l border-black/7 px-4 text-red-500 hover:bg-red-50"
                                aria-label={`Delete ${book.title}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

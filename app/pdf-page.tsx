'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { parsePdfLink } from '@/lib/pdf-link';

// The PDF canvas and annotation layer share exactly the same page rectangle.
export default function PdfPage({ url, page, children, onPageCount, fullscreen = false, zoom = 100 }: {
  url: string; page: number; children: ReactNode; onPageCount: (count: number) => void;
  fullscreen?: boolean;
  zoom?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [renderedPage, setRenderedPage] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('Downloading PDF');
  const [attempt, setAttempt] = useState(0);
  const [localData, setLocalData] = useState<Uint8Array | null>(null);
  const countCallback = useRef(onPageCount);
  useEffect(() => { countCallback.current = onPageCount; }, [onPageCount]);

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      if (!disposed) setError('The PDF took too long to load. Retry or choose the same PDF below.');
      void task?.destroy();
    }, 45000);
    let task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        let source = url;
        if (!localData) {
          const parsed = parsePdfLink(url);
          source = parsed.url;
          if (parsed.driveId) {
            source = `/api/books/pdf?id=${encodeURIComponent(parsed.driveId)}`;
            if (parsed.resourceKey) source += `&resourcekey=${encodeURIComponent(parsed.resourceKey)}`;
          }
        }
        if (disposed) return;
        let data = localData?.slice();
        if (!data) {
          const response = await fetch(source, { signal: controller.signal });
          if (!response.ok) {
            const detail = source.startsWith('/api/books/pdf?') ? await response.text() : '';
            throw new Error(detail || `PDF download failed (${response.status}). Check the file's sharing and download permissions.`);
          }
          data = new Uint8Array(await response.arrayBuffer());
          if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) {
            throw new Error('The link returned a web page instead of a PDF. Use a direct PDF or shared Drive file link.');
          }
        }
        if (disposed || controller.signal.aborted) return;
        setStage('Preparing PDF');
        task = pdfjs.getDocument({ data });
        const pdf = await task.promise;
        if (disposed) return;
        setDocument(pdf);
        countCallback.current(pdf.numPages);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Unable to load PDF.');
      } finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); void task?.destroy(); };
  }, [url, localData, attempt]);

  useEffect(() => {
    if (!document) return;
    let disposed = false;
    const timeout = setTimeout(() => {
      if (!disposed) { setError('This page took too long to render. Please retry.'); render?.cancel(); }
    }, 30000);
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    void (async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (disposed || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const element = canvas.current;
        element.width = viewport.width;
        element.height = viewport.height;
        render = pdfPage.render({ canvas: element, viewport });
        await render.promise;
        if (!disposed) setRenderedPage(page);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Unable to render page.');
      } finally { clearTimeout(timeout); }
    })();
    return () => { disposed = true; clearTimeout(timeout); render?.cancel(); };
  }, [document, page]);

  const ready = renderedPage === page && !error;
  return <div className={fullscreen ? 'min-h-0 flex-1 overflow-auto rounded-xl bg-black/20 p-3' : 'max-h-[75vh] min-h-96 overflow-auto rounded-xl bg-black/20 p-3'}>
    {error ? <div role="alert" className="p-6 text-sm text-white">
      <p>Unable to display the PDF: {error}</p>
      {/^https?:\/\//i.test(url) && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 mr-4 inline-block underline">Open original PDF</a>}
      <button type="button" className="mt-3 rounded-lg border border-white/30 px-4 py-2" onClick={() => {
        setError(''); setDocument(null); setRenderedPage(null); setStage('Downloading PDF'); setAttempt(value => value + 1);
      }}>Retry PDF</button>
      <p className="mt-3">For Drive files, allow anyone with the link to view and download. You can also choose the same PDF from your computer to review it here.</p>
      <label className="mt-4 block">Choose the same PDF
        <input type="file" accept="application/pdf,.pdf" className="mt-2 block" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setError(''); setRenderedPage(null); setDocument(null);
          setLocalData(new Uint8Array(await file.arrayBuffer()));
        }} />
      </label>
      <p className="mt-2 text-xs">The local file stays in this browser. Marks and comments are saved to the book.</p>
    </div> : <>
      {!ready && <output className="block p-6 text-sm text-white">{document ? `Rendering page ${page}` : stage}…</output>}
      <div className="relative mx-auto shrink-0 bg-white" style={{ width: `${zoom}%`, visibility: ready ? 'visible' : 'hidden' }}>
        <canvas ref={canvas} className="block h-auto w-full" aria-label={`PDF page ${page}`} />
        {ready && children}
      </div>
    </>}
  </div>;
}

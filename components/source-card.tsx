'use client';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import type { Source } from '@/lib/model';
export function SourceCard({
  source,
  count,
  reviewCount,
  date,
  compact = false,
  onOpen,
  onReview,
}: {
  source: Source;
  count: number;
  reviewCount: number;
  date: string;
  compact?: boolean;
  onOpen: () => void;
  onReview: () => void;
}) {
  return (
    <article className={`source-card source-${source.type} ${compact ? 'compact' : ''}`}>
      <button className="source-open" onClick={onOpen}>
        {source.type === 'image' && source.fileUrl ? (
          <div className="source-thumbnail">
            <Image
              src={source.fileUrl}
              alt={source.fileName || 'Captured image'}
              fill
              unoptimized
              sizes="320px"
            />
          </div>
        ) : source.type === 'voice' ? (
          <div className="source-wave" aria-hidden="true">
            {[10, 22, 16, 30, 18, 26, 12, 32, 18, 24, 14, 28, 18, 12, 24, 16].map((h, n) => (
              <i key={n} style={{ height: h }} />
            ))}
          </div>
        ) : source.type === 'pdf' ? (
          <div className="pdf-cover" aria-hidden="true">
            <FileText size={26} />
            <span>PDF</span>
            <i />
            <i />
            <i />
          </div>
        ) : (
          <div className="source-scrap" aria-hidden="true">
            {source.rawText.slice(0, 180)}
          </div>
        )}
        <strong>
          {source.fileName ||
            (source.type === 'voice'
              ? 'A thought, out loud'
              : source.rawText.slice(0, 90) || 'Text capture')}
        </strong>
        <span className="source-meta">
          {source.type}
          {source.durationSeconds
            ? ` · ${Math.floor(source.durationSeconds / 60)}:${String(Math.floor(source.durationSeconds % 60)).padStart(2, '0')}`
            : ''}{' '}
          · {date} · {count} items
        </span>
      </button>
      <div className="source-card-bottom">
        <span className={'status ' + (source.processingStatus === 'error' ? 'error-status' : '')}>
          {['queued', 'processing', 'error'].includes(source.processingStatus)
            ? source.processingStatus
            : reviewCount
              ? `${reviewCount} to review`
              : 'Organized'}
        </span>
        <button className="icon-button" aria-label="Review source items" onClick={onReview}>
          <ArrowUpRight size={18} />
        </button>
      </div>
    </article>
  );
}
export function SourcePreview({ source }: { source: Source }) {
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  return (
    <>
      {source.type === 'image' && source.fileUrl && (
        <div className="source-image-preview">
          <Image
            src={source.fileUrl}
            alt={source.fileName || 'Original image'}
            width={1000}
            height={750}
            unoptimized
          />
        </div>
      )}
      {source.type === 'pdf' && (
        <div className="pdf-preview">
          {source.fileUrl && !failed && (
            <Image
              key={page}
              className="pdf-rendered-page"
              src={`${source.fileUrl}?preview=1&page=${page}`}
              width={1000}
              height={1294}
              unoptimized
              alt={`PDF page ${page} of ${source.fileName}`}
              onError={() => setFailed(true)}
            />
          )}
          <div className="pdf-page-controls">
            <button
              className="small-button"
              disabled={page <= 1}
              onClick={() => {
                setPage(page - 1);
                setFailed(false);
              }}
            >
              Previous page
            </button>
            <span>
              Page {page}
              {source.pageCount ? ` of ${source.pageCount}` : ''}
            </span>
            <button
              className="small-button"
              disabled={failed || page >= (source.pageCount || 1)}
              onClick={() => setPage(page + 1)}
            >
              Next page
            </button>
          </div>
          {failed && (
            <p className="subtle">
              No preview for this page. Open the original or read the extracted text.
            </p>
          )}
          <details className="pdf-text-preview">
            <summary>Extracted text</summary>
            <p>{source.rawText}</p>
          </details>
        </div>
      )}
      {source.type === 'voice' && (
        <p className="source-kind-label">
          Voice transcript{source.durationSeconds ? ` · ${source.durationSeconds} seconds` : ''} ·
          audio is not retained
        </p>
      )}
      {source.type !== 'pdf' && (
        <p className="source-text">
          {source.transcription || source.rawText || 'An image you added to your pile.'}
        </p>
      )}
    </>
  );
}

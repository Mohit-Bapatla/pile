'use client';
import Image from 'next/image';
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
          {source.type} · {date} · {count} items
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
        <div className="pdf-text-preview">
          <div>
            <FileText size={20} />
            <strong>{source.fileName}</strong>
            <span>Extracted text</span>
          </div>
          <p>{source.rawText || 'This PDF has no readable text. Open the original file below.'}</p>
        </div>
      )}
      {source.type === 'voice' && (
        <p className="source-kind-label">Voice transcript · audio is not retained</p>
      )}
      {source.type !== 'pdf' && (
        <p className="source-text">
          {source.transcription || source.rawText || 'An image you added to your pile.'}
        </p>
      )}
    </>
  );
}

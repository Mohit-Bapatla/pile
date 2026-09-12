'use client';
import {
  Check,
  CheckCheck,
  MoreHorizontal,
  Paperclip,
  CalendarDays,
  Flag,
  Clock,
  Lightbulb,
  FileText,
  AudioLines,
} from 'lucide-react';
import type { Item, Source } from '@/lib/model';
const glyphs = {
  task: Check,
  event: CalendarDays,
  deadline: Flag,
  reminder: Clock,
  idea: Lightbulb,
  note: FileText,
  reference: Paperclip,
};
export function PileCard({
  item,
  source,
  date,
  onEdit,
  onComplete,
  onSource,
  arriving,
  completing,
}: {
  item: Item;
  source?: Source;
  date: string;
  onEdit: () => void;
  onComplete: () => void;
  onSource: () => void;
  arriving?: boolean;
  completing?: boolean;
}) {
  const Glyph = glyphs[item.type];
  const SourceGlyph = source?.type === 'voice' ? AudioLines : Paperclip;
  return (
    <article
      data-testid="item-card"
      className={`pile-card type-${item.type} ${item.status === 'done' ? 'completed' : ''} ${arriving ? 'arriving' : ''} ${completing ? 'completing' : ''}`}
    >
      <div className="card-top">
        <span className="eyebrow">
          <Glyph size={14} />
          {item.type}
        </span>
        <button className="icon-button more" aria-label={`Edit ${item.title}`} onClick={onEdit}>
          <MoreHorizontal size={18} />
        </button>
      </div>
      <button className="card-main" onClick={onEdit}>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
      </button>
      <div className="card-meta">
        {date && (
          <span>
            <Clock size={13} />
            {date}
          </span>
        )}
        {item.calendarStatus === 'synced' && (
          <span className="synced">
            <CheckCheck size={14} />
            Synced
          </span>
        )}
        {item.needsClarification && <span className="review-badge">Needs review</span>}
      </div>
      <div className="card-footer">
        <span className="project-label">{item.project || 'Unsorted'}</span>
        {!['idea', 'note', 'reference'].includes(item.type) && (
          <button
            className="complete-button"
            disabled={completing}
            aria-label={`${item.status === 'done' ? 'Reopen' : 'Complete'} ${item.title}`}
            onClick={onComplete}
          >
            <Check size={16} />
          </button>
        )}
      </div>
      {source && (
        <button
          className="source-receipt"
          onClick={onSource}
          aria-label={`View source for ${item.title}`}
        >
          <SourceGlyph size={13} />
          <span>
            {source.fileName || (source.type === 'voice' ? 'Voice transcript' : 'Original thought')}
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      )}
    </article>
  );
}

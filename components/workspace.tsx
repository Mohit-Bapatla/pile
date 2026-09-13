'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import Link from 'next/link';
import { PileCard } from './pile-card';
import { CalendarSettings, downloadCalendar } from './calendar-settings';
import type { Preferences } from '@/lib/preferences';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { calendarOccurrences, nextMeeting } from '@/lib/recurrence';
import { matchingExcerpt, searchTokens } from '@/lib/search';
import { SourceCard, SourcePreview } from './source-card';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  Inbox,
  CalendarDays,
  Folder,
  Search,
  Settings,
  Plus,
  ArrowUp,
  ArrowUpRight,
  Mic,
  Paperclip,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sun,
  Lightbulb,
  FileText,
  Clock,
  Flag,
  ArrowRight,
  AudioLines,
  Square,
  LoaderCircle,
  CalendarPlus,
  Archive,
  ExternalLink,
  Trash2,
  RotateCcw,
  Menu,
  CheckCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  type Item,
  type Source,
  type Project,
  type CalendarEvent,
  types,
  section,
  localDate,
  itemDay,
} from '@/lib/model';
type Config = {
  demo: boolean;
  ai: string;
  voice: boolean;
  googleConfigured: boolean;
  calendar: string;
  googleConnected: boolean;
  elevenlabs: string;
  backboard: string;
  persistence: string;
};
type Snapshot = {
  items: Item[];
  sources: Source[];
  projects: Project[];
  events: CalendarEvent[];
  config: Config;
  preferences: Preferences;
};
const icons: Record<string, LucideIcon> = {
  task: Check,
  deadline: Flag,
  event: CalendarDays,
  reminder: Clock,
  note: FileText,
  idea: Lightbulb,
  reference: Paperclip,
  text: FileText,
  voice: AudioLines,
  pdf: FileText,
  image: Paperclip,
  file: FileText,
};
const nav = [
  ['Board', '/app', LayoutDashboard],
  ['Inbox', '/app/inbox', Inbox],
  ['Calendar', '/app/calendar', CalendarDays],
  ['Projects', '/app/projects', Folder],
  ['Search', '/app/search', Search],
] as const;
async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/' + url, {
    method,
    ...(body instanceof FormData
      ? { body }
      : body
        ? {
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
          }
        : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}
function dateLabel(value?: string, timezone = 'America/Chicago') {
  if (!value) return '';
  const d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(value.length > 10 ? { timeZone: timezone, hour: 'numeric', minute: '2-digit' } : {}),
  });
}
function Icon({ name, ...props }: { name: string; size?: number; className?: string }) {
  const Component = icons[name] || FileText;
  return <Component size={16} {...props} />;
}
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={'modal ' + (wide ? 'wide' : '')}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
        >
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || 'Review and organize your pile.'}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={21} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export default function Workspace({ view }: { view: string[] }) {
  const router = useRouter();
  const page = view[0] || 'board';
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sorting, setSorting] = useState<{ label: string; done?: number }>();
  const [arriving, setArriving] = useState<string[]>([]);
  const [completing, setCompleting] = useState<string[]>([]);
  const [detail, setDetail] = useState<Item>();
  const [review, setReview] = useState<string>();
  const [voice, setVoice] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [intro, setIntro] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProvider, setSearchProvider] = useState('Local search');
  const [sourceResults, setSourceResults] = useState<Source[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [remoteEvents, setRemoteEvents] = useState<CalendarEvent[]>([]);
  const [sourcePreview, setSourcePreview] = useState<Source>();
  const [newItem, setNewItem] = useState(false);
  const sortingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sortingTimer.current) clearTimeout(sortingTimer.current);
    },
    [],
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLTextAreaElement>(null);
  const timezone = data?.preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDate(new Date(), timezone);
  const refresh = useCallback(async () => {
    const next = await api<Snapshot>('state');
    if (!next.preferences?.timezone) {
      next.preferences = await api<Preferences>('preferences', 'PATCH', {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneDetected: true,
      });
    }
    setData(next);
    return next;
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (page !== 'search') return;
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch('/api/search?q=' + encodeURIComponent(query), {
          signal: controller.signal,
        });
        const found = await r.json();
        if (!r.ok) throw new Error(found.error);
        setResults(found.items);
        setSourceResults(found.sources || []);
        setSearchProvider(found.provider || 'Local search');
        setSearching(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Search failed.');
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, page, data?.items.length]);
  useEffect(() => {
    if (!data?.config.googleConnected) return;
    api<{ events: CalendarEvent[] }>('calendar')
      .then((r) => setRemoteEvents(r.events))
      .catch((e) => setError(e.message));
  }, [data?.config.googleConnected]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        router.push('/app/search');
      }
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [router]);
  async function act(fn: () => Promise<unknown>, message?: string) {
    setError('');
    try {
      await fn();
      await refresh();
      if (message) setToast(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }
  async function capture(
    content: string | File,
    type: 'text' | 'voice' = 'text',
    durationSeconds?: number,
  ) {
    if (busy) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const landing = new Promise((resolve) => setTimeout(resolve, reduced ? 0 : 800));
    if (sortingTimer.current) clearTimeout(sortingTimer.current);
    setSorting({ label: content instanceof File ? content.name : content.slice(0, 90) });
    setBusy(true);
    setError('');
    try {
      let body: unknown;
      if (content instanceof File) {
        const form = new FormData();
        form.set('file', content);
        form.set('timezone', timezone);
        body = form;
      } else {
        body = { text: content, type, timezone, durationSeconds };
      }
      const source = await api<Source>('capture', 'POST', body);
      setText('');
      await refresh();
      if (source.duplicateOf) {
        setSorting(undefined);
        setReview(source.id);
        setToast('Already in your pile. Opened the original import.');
        return;
      }
      const result = await api<{ items: Item[]; memoryWarning?: string }>(
        'process/' + source.id,
        'POST',
      );
      await landing;
      setArriving(result.items.map((i) => i.id));
      setSorting({
        label:
          source.fileName || (source.type === 'voice' ? 'Voice transcript' : 'Original thought'),
        done: result.items.length,
      });
      await refresh();
      sortingTimer.current = setTimeout(
        () => {
          setSorting(undefined);
          setArriving([]);
        },
        reduced ? 0 : 1400,
      );
      setToast(
        result.memoryWarning ||
          (result.items.length
            ? `${result.items.length} useful items, a little more organized.`
            : 'Original saved. No new actions to manage.'),
      );
      if (
        source.type === 'pdf' ||
        source.type === 'image' ||
        result.items.some((i) => i.needsClarification)
      )
        setReview(source.id);
    } catch (e) {
      setSorting(undefined);
      setError(e instanceof Error ? e.message : 'Could not capture this.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const active =
    data?.items.filter((i) =>
      showDone ? i.status === 'done' : !['done', 'archived'].includes(i.status),
    ) || [];
  const needsAttention = active.filter(
    (i) =>
      i.tier !== 'optional' &&
      (i.needsClarification ||
        i.status === 'inbox' ||
        ['suggested', 'failed'].includes(i.calendarStatus)),
  );
  const inbox = active.filter((i) => section(i, today, timezone) === 'Inbox');
  const weekStart = new Date(Date.parse(today) + calendarOffset * 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const weekEnd = new Date(Date.parse(weekStart) + 6 * 86400000).toISOString().slice(0, 10);
  const events = calendarOccurrences(
    Array.from(new Map([...(data?.events || []), ...remoteEvents].map((e) => [e.id, e])).values()),
    weekStart,
    weekEnd,
  ).sort((a, b) => a.start.localeCompare(b.start));
  const title =
    page === 'board'
      ? 'A place to put it all.'
      : page === 'inbox'
        ? 'Your inbox.'
        : page === 'calendar'
          ? 'The days ahead.'
          : page === 'projects'
            ? view[1]
              ? data?.projects.find((p) => p.id === view[1])?.name || 'Project'
              : 'Your project folders.'
            : page === 'search'
              ? 'Find that thing.'
              : 'Your workspace.';
  const pending =
    data?.sources.filter((s) => ['queued', 'processing', 'error'].includes(s.processingStatus)) ||
    [];
  function renderCard(item: Item) {
    const source = data?.sources.find((s) => s.id === item.sourceId);
    return (
      <PileCard
        key={item.id}
        item={item}
        source={source}
        date={
          item.recurrence
            ? `${item.recurrence.days.join('/')} · ${dateLabel(nextMeeting(item, new Date()), timezone) || 'Term ended'}`
            : dateLabel(item.dueDate || item.startDateTime, timezone)
        }
        arriving={arriving.includes(item.id)}
        completing={completing.includes(item.id)}
        onEdit={() => setDetail(item)}
        onSource={() => setSourcePreview(source)}
        onComplete={async () => {
          try {
            await api('items/' + item.id, 'PATCH', {
              status: item.status === 'done' ? 'planned' : 'done',
            });
            setCompleting((ids) => [...ids, item.id]);
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
              await new Promise((r) => setTimeout(r, 200));
            await refresh();
            setToast(item.status === 'done' ? 'Back on the board.' : 'One less thing.');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not update item.');
          } finally {
            setCompleting((ids) => ids.filter((id) => id !== item.id));
          }
        }}
      />
    );
  }
  function sourceRow(s: Source, compact = false) {
    const items = data?.items.filter((i) => i.sourceId === s.id) || [];
    return (
      <SourceCard
        key={s.id}
        source={s}
        compact={compact}
        count={items.length}
        reviewCount={
          items.filter(
            (i) =>
              i.tier !== 'optional' &&
              !['done', 'archived'].includes(i.status) &&
              (i.needsClarification || i.status === 'inbox' || i.calendarStatus === 'failed'),
          ).length
        }
        date={dateLabel(s.createdAt, timezone)}
        onOpen={() => setSourcePreview(s)}
        onReview={() => setReview(s.id)}
      />
    );
  }
  const inboxTray = data ? (
    <div className="inbox-tray">
      <div>
        <Inbox size={19} />
        <strong>Inbox</strong>
        <span>{data.sources.length}</span>
      </div>
      <p className="inbox-description">The originals behind your day.</p>
      <div className="inbox-sources">
        {[...data.sources]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 2)
          .map((s) => sourceRow(s, true))}
      </div>
      <Link className="text-button" href="/app/inbox">
        All captures <ArrowRight size={14} />
      </Link>
      {pending.map((s) => (
        <div key={s.id} className="processing-row">
          {s.processingStatus === 'error' ? (
            <>
              <span>{s.fileName || 'Capture'} needs another try.</span>
              <button
                className="text-button"
                onClick={() =>
                  act(() => api('process/' + s.id, 'POST'), 'Sorted. Ready to review.')
                }
              >
                <RotateCcw size={14} />
                Retry
              </button>
            </>
          ) : (
            <>
              <LoaderCircle size={17} className="spin" />
              <span>Sorting your pile…</span>
            </>
          )}
        </div>
      ))}
      {inbox.length > 0 && (
        <button className="text-button" onClick={() => setReview(inbox[0].sourceId)}>
          A couple things need a human.
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  ) : null;
  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (menu ? 'mobile-open' : '')}>
        <Link href="/app" className="brand">
          <span className="brand-mark">
            <span />
            <span />
          </span>
          pile<span className="brand-period">.</span>
        </Link>
        <nav>
          {nav.map(([label, href, NavIcon]) => (
            <Link
              key={href}
              href={href}
              className={(page === label.toLowerCase() ? 'active ' : '') + 'nav-link'}
              aria-current={page === label.toLowerCase() ? 'page' : undefined}
              onClick={() => setMenu(false)}
            >
              <NavIcon size={19} />
              {label}
              {label === 'Inbox' && inbox.length > 0 && (
                <span className="count">{inbox.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className={'nav-link ' + (page === 'settings' ? 'active' : '')}
            href="/app/settings"
            onClick={() => setMenu(false)}
          >
            <Settings size={19} />
            Settings
          </Link>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              My workspace <span>/</span>{' '}
              <b>{page === 'board' ? 'Board' : page.charAt(0).toUpperCase() + page.slice(1)}</b>
            </span>
          </div>
          <div className="topbar-right">
            <span className="mode-pill">
              <span />
              {data?.config.demo ? 'Demo workspace' : 'Personal workspace'}
            </span>
            <button
              className="icon-button"
              aria-label="Show welcome guide"
              onClick={() => setOnboarding(true)}
            >
              <Sun size={19} />
            </button>
            <span className="tiny-avatar">M</span>
          </div>
        </header>
        <main
          className={page === 'board' ? 'board-page' : undefined}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDrag(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) capture(e.dataTransfer.files[0]);
          }}
        >
          {drag && (
            <div className="drop-overlay">
              <Paperclip size={38} />
              <h2>Let it land here.</h2>
              <p>Drop a PDF, image, or text file into your pile.</p>
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="greeting">
                {page === 'board' ? <>YOUR EVERYDAY DESK</> : <>YOUR {page.toUpperCase()}</>}
              </div>
              <h1>{title}</h1>
              <p>
                {page === 'board' ? (
                  <>
                    Drop a thought or file. Keep the actions, leave the noise.
                    <span className="today-summary">
                      You’ve got{' '}
                      <strong>
                        {active.filter((i) => section(i, today, timezone) === 'Today').length}{' '}
                        things
                      </strong>{' '}
                      for today. One thing at a time.
                    </span>
                  </>
                ) : page === 'inbox' ? (
                  'The original thoughts, files, and moments behind your plan.'
                ) : page === 'calendar' ? (
                  'Your plans, with just enough space to breathe.'
                ) : page === 'projects' ? (
                  'Related thoughts, naturally finding each other.'
                ) : page === 'search' ? (
                  'Find the note, the deadline, or that thing you said.'
                ) : (
                  'A few preferences. No complicated setup.'
                )}
              </p>
            </div>
            {data && (
              <span className="header-date">
                {formatInTimeZone(new Date(), timezone, 'EEEE')}
                <strong>{formatInTimeZone(new Date(), timezone, 'MMMM d')}</strong>
              </span>
            )}
          </section>
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" />
              Making a little room…
              <button
                className="text-button"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {['board', 'inbox'].includes(page) && (
                <section className={'capture-box ' + (busy ? 'processing' : '')}>
                  <div className="capture-label">
                    <span>DROP IT HERE. MAKE SENSE OF IT LATER.</span>
                    <span className="capture-shortcut">⌘ ↵ to sort</span>
                  </div>
                  <textarea
                    ref={captureInput}
                    aria-label="Dump anything here"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim())
                        capture(text);
                    }}
                    placeholder="Dump anything here…"
                    rows={2}
                  />
                  <div className="capture-bottom">
                    <div>
                      <button
                        className="voice-button"
                        onClick={() => setVoice(true)}
                        disabled={busy}
                      >
                        <Mic size={17} />
                        Talk it out
                      </button>
                      <button
                        className="attach-button"
                        onClick={() => fileInput.current?.click()}
                        disabled={busy}
                      >
                        <Paperclip size={17} />
                        <span>Attach a file</span>
                      </button>
                      <span className="capture-hint">or just drop it here</span>
                    </div>
                    <button
                      className="sort-button"
                      disabled={busy || !text.trim()}
                      onClick={() => capture(text)}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle className="spin" size={16} />
                          Sorting your pile…
                        </>
                      ) : (
                        <>
                          Sort my pile
                          <ArrowUp size={17} />
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    className="visually-hidden"
                    ref={fileInput}
                    type="file"
                    aria-label="Upload file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
                    onChange={(e) => {
                      if (e.target.files?.[0]) capture(e.target.files[0]);
                      e.target.value = '';
                    }}
                  />
                </section>
              )}
              {sorting && (
                <div
                  className={'sorting-receipt ' + (sorting.done !== undefined ? 'sorted' : '')}
                  role="status"
                >
                  <div className="split-papers" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div>
                    <strong>{sorting.label}</strong>
                    <span>
                      {sorting.done !== undefined
                        ? `${sorting.done} items found their place. Original saved in Inbox.`
                        : 'Finding the tasks, dates, and ideas. Keeping your original attached…'}
                    </span>
                  </div>
                </div>
              )}
              {page === 'board' && (
                <>
                  <div className="board-toolbar">
                    <div>
                      <h2>Your board</h2>
                      <span className="subtle">Everything in its own time.</span>
                    </div>
                    <div>
                      <button
                        className={'text-button ' + (showDone ? 'selected' : '')}
                        onClick={() => setShowDone(!showDone)}
                      >
                        <CheckCheck size={16} />
                        {showDone ? 'Show active' : 'Completed'}
                      </button>
                      <button className="text-button" onClick={() => setNewItem(true)}>
                        <Plus size={16} />
                        New item
                      </button>
                    </div>
                  </div>
                  <div className="board-with-rail">
                    <div className="board-area">
                      <div className="board-columns">
                        {(['Today', 'This week', 'Later'] as const).map((s, index) => (
                          <Fragment key={s}>
                            <section className={`board-column zone-${index}`}>
                              <div className="column-heading">
                                <span className={'column-symbol symbol-' + index}>
                                  {index === 0 ? (
                                    <Sun size={17} />
                                  ) : index === 1 ? (
                                    <CalendarDays size={17} />
                                  ) : (
                                    <Lightbulb size={17} />
                                  )}
                                </span>
                                <h2>{s}</h2>
                                <span className="column-count">
                                  {active.filter((i) => section(i, today, timezone) === s).length}
                                </span>
                                <button
                                  className="icon-button"
                                  aria-label={`Add item to ${s}`}
                                  onClick={() => setNewItem(true)}
                                >
                                  <Plus size={17} />
                                </button>
                              </div>
                              <div className="column-description">
                                {index === 0
                                  ? 'Start here. The rest can wait.'
                                  : index === 1
                                    ? 'On the horizon.'
                                    : 'Ideas worth keeping.'}
                              </div>
                              <div className="zone-cards">
                                {active
                                  .filter((i) => section(i, today, timezone) === s)
                                  .map((item) => renderCard(item))}
                              </div>
                              {!active.some((i) => section(i, today, timezone) === s) && (
                                <div className="empty-column">
                                  <span>↳</span>
                                  <p>
                                    {showDone
                                      ? 'Your finished things will land here.'
                                      : 'Nothing is yelling at you here.'}
                                  </p>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      captureInput.current?.focus();
                                    }}
                                  >
                                    Add a little something
                                  </button>
                                </div>
                              )}
                              {s === 'Later' && (
                                <div className="board-note">
                                  Not everything needs
                                  <br />
                                  to be a task.
                                  <span>Keep a little room for possibility.</span>
                                </div>
                              )}
                            </section>
                            {index === 0 && inboxTray}
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <aside className="right-rail">
                      <section className="mini-calendar">
                        <div className="rail-heading">
                          <h3>
                            This week{' '}
                            <span className="calendar-month">
                              {new Date().toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                          </h3>
                          <Link href="/app/calendar" aria-label="Open calendar">
                            <ArrowUpRight size={18} />
                          </Link>
                        </div>
                        <div className="week-strip">
                          {Array.from({ length: 7 }, (_, n) => {
                            const d = new Date(Date.parse(today) + n * 86400000);
                            const iso = d.toISOString().slice(0, 10);
                            return (
                              <Link
                                href="/app/calendar"
                                className={n === 0 ? 'current' : ''}
                                key={n}
                              >
                                <span>
                                  {d.toLocaleDateString('en-US', {
                                    weekday: 'narrow',
                                    timeZone: 'UTC',
                                  })}
                                </span>
                                <strong>{d.getUTCDate()}</strong>
                                <i
                                  className={
                                    events.some((e) => itemDay(e.start, timezone) === iso)
                                      ? 'has-event'
                                      : ''
                                  }
                                />
                              </Link>
                            );
                          })}
                        </div>
                        <div className="rail-agenda">
                          {events
                            .filter((e) => itemDay(e.start, timezone) >= today)
                            .slice(0, 2)
                            .map((e) => (
                              <div className="mini-event" key={e.id}>
                                <span className="event-line" />
                                <div>
                                  <strong>{e.title}</strong>
                                  <small>{dateLabel(e.start, timezone)}</small>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="calendar-provider">
                          <CalendarDays size={13} />
                          {data.config.calendar}
                        </div>
                      </section>
                      <section className="attention-panel">
                        <div className="rail-heading">
                          <h3>Needs a look</h3>
                          <span>{needsAttention.length}</span>
                        </div>
                        <p>A couple things need a human.</p>
                        {needsAttention.slice(0, 2).map((item) => (
                          <div className="attention-item" key={item.id}>
                            <span className="eyebrow">
                              {item.needsClarification ? 'QUICK QUESTION' : 'CALENDAR SUGGESTION'}
                            </span>
                            <strong>{item.title}</strong>
                            <p>
                              {item.clarificationQuestion ||
                                'Make a little space for this on your calendar?'}
                            </p>
                            <button
                              className="small-button"
                              onClick={() =>
                                item.needsClarification ? setDetail(item) : setReview(item.sourceId)
                              }
                            >
                              {item.needsClarification ? 'Review details' : 'Review & add'}
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        ))}
                        {!needsAttention.length && (
                          <p className="all-clear">
                            <CheckCheck size={20} />
                            All clear. You’re good to go.
                          </p>
                        )}
                      </section>
                      <section className="demo-kit">
                        <span className="eyebrow">FROM YOUR DEMO KIT</span>
                        <h3>From a file to a plan.</h3>
                        <p>Give Pile something messy.</p>
                        <button
                          onClick={async () => {
                            const r = await fetch('/api/fixtures/sample-syllabus.pdf');
                            capture(
                              new File([await r.blob()], 'sample-syllabus.pdf', {
                                type: 'application/pdf',
                              }),
                            );
                          }}
                          disabled={busy}
                        >
                          <FileText size={17} />
                          Try a syllabus
                          <ArrowUpRight size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            const r = await fetch('/api/fixtures/sample-event.png');
                            capture(
                              new File([await r.blob()], 'sample-event.png', {
                                type: 'image/png',
                              }),
                            );
                          }}
                          disabled={busy}
                        >
                          <Paperclip size={17} />
                          Try an event flyer
                          <ArrowUpRight size={16} />
                        </button>
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {page === 'inbox' && (
                <section className="content-panel">
                  <div className="panel-heading">
                    <h2>
                      All captures <span>{data.sources.length}</span>
                    </h2>
                    <span>Originals, always within reach.</span>
                  </div>
                  <div className="source-grid">
                    {[...data.sources]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((s) => sourceRow(s))}
                  </div>
                  {!data.sources.length && (
                    <div className="empty-page">
                      <Inbox size={35} />
                      <h3>A fresh little inbox.</h3>
                      <p>Type, talk, or upload something to get started.</p>
                    </div>
                  )}
                </section>
              )}
              {page === 'calendar' && (
                <>
                  <div className="board-toolbar">
                    <div>
                      <h2>
                        {new Date(
                          Date.parse(today) + calendarOffset * 7 * 86400000,
                        ).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </h2>
                      <span className="mode-pill">{data.config.calendar}</span>
                    </div>
                    <div>
                      <button
                        className="icon-button bordered"
                        aria-label="Previous week"
                        onClick={() => setCalendarOffset(calendarOffset - 1)}
                      >
                        <ChevronLeft size={19} />
                      </button>
                      <button className="text-button" onClick={() => setCalendarOffset(0)}>
                        Today
                      </button>
                      <input
                        type="date"
                        aria-label="Jump to date"
                        className="calendar-jump"
                        onChange={(e) => {
                          if (e.target.value)
                            setCalendarOffset(
                              Math.floor(
                                (Date.parse(e.target.value) - Date.parse(today)) / (7 * 86400000),
                              ),
                            );
                        }}
                      />
                      <button
                        className="icon-button bordered"
                        aria-label="Next week"
                        onClick={() => setCalendarOffset(calendarOffset + 1)}
                      >
                        <ChevronRight size={19} />
                      </button>
                    </div>
                  </div>
                  <p className="calendar-legend">
                    Solid cards: calendar events · Dashed cards: suggestions awaiting approval.
                  </p>
                  <div className="calendar-grid">
                    {Array.from({ length: 7 }, (_, n) => {
                      const d = new Date(Date.parse(today) + (calendarOffset * 7 + n) * 86400000);
                      const iso = d.toISOString().slice(0, 10);
                      return (
                        <div
                          className={'calendar-day ' + (iso === today ? 'is-today' : '')}
                          key={n}
                        >
                          <header>
                            <span>
                              {d.toLocaleDateString('en-US', {
                                weekday: 'short',
                                timeZone: 'UTC',
                              })}
                            </span>
                            <strong>{d.getUTCDate()}</strong>
                          </header>
                          {events
                            .filter((e) => itemDay(e.start, timezone) === iso)
                            .map((e) => (
                              <div className="calendar-event" key={e.id}>
                                <CheckCheck size={14} />
                                <strong>{e.title}</strong>
                                <span>
                                  {e.allDay
                                    ? 'All day'
                                    : dateLabel(e.start, timezone).split(', ').slice(1).join(', ')}
                                </span>
                                {e.location && <small>{e.location}</small>}
                                {data.config.googleConnected && (
                                  <small>{e.demo ? 'Demo calendar' : 'Google Calendar'}</small>
                                )}
                              </div>
                            ))}
                          {active
                            .filter(
                              (i) =>
                                i.tier !== 'optional' &&
                                i.calendarStatus !== 'synced' &&
                                (i.startDateTime || i.dueDate
                                  ? itemDay((i.startDateTime || i.dueDate)!, timezone)
                                  : undefined) === iso,
                            )
                            .map((i) => (
                              <button
                                className="calendar-event unsynced"
                                key={i.id}
                                onClick={() => setDetail(i)}
                              >
                                <Icon name={i.type} />
                                <strong>{i.title}</strong>
                                <small>On your board · not synced</small>
                              </button>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                  <p className="calendar-footnote">
                    Only items you approve are added to your calendar. Dashed cards are still on
                    your board.
                  </p>
                </>
              )}
              {page === 'projects' && !view[1] && (
                <div className="project-grid">
                  {data.projects.map((p) => (
                    <Link
                      href={'/app/projects/' + p.id}
                      className={'project-card ' + p.color}
                      key={p.id}
                    >
                      <Folder size={28} />
                      <ArrowUpRight className="project-arrow" size={20} />
                      <h2>{p.name}</h2>
                      <p>
                        {active.filter((i) => i.projectId === p.id).length} open things ·{' '}
                        {
                          data.items.filter(
                            (i) =>
                              i.projectId === p.id &&
                              ['note', 'reference', 'idea'].includes(i.type),
                          ).length
                        }{' '}
                        saved thoughts
                      </p>
                      <div className="project-preview">
                        {active
                          .filter((i) => i.projectId === p.id)
                          .slice(0, 3)
                          .map((i) => (
                            <span key={i.id}>
                              <Icon name={i.type} />
                              {i.title}
                            </span>
                          ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {page === 'projects' && view[1] && (
                <>
                  <Link href="/app/projects" className="back-link">
                    <ChevronLeft size={16} />
                    All spaces
                  </Link>
                  {data.projects.find((p) => p.id === view[1])?.metadata && (
                    <section className="content-panel course-metadata">
                      <h2>Course details</h2>
                      <dl>
                        {Object.entries(data.projects.find((p) => p.id === view[1])!.metadata!).map(
                          ([key, value]) =>
                            value && (
                              <Fragment key={key}>
                                <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                                <dd>{value}</dd>
                              </Fragment>
                            ),
                        )}
                      </dl>
                    </section>
                  )}
                  <div className="results-grid">
                    {active.filter((i) => i.projectId === view[1]).map((i) => renderCard(i))}
                  </div>
                  <section className="content-panel">
                    <div className="panel-heading">
                      <h2>Captured context</h2>
                    </div>
                    <div className="source-grid">
                      {data.sources
                        .filter((s) =>
                          data.items.some((i) => i.projectId === view[1] && i.sourceId === s.id),
                        )
                        .map((s) => sourceRow(s))}
                    </div>
                  </section>
                </>
              )}
              {page === 'search' && (
                <>
                  <div className="search-bar">
                    <Search size={22} />
                    <input
                      autoFocus
                      aria-label="Search your pile"
                      placeholder="Find anything you've piled away..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery('')}
                      >
                        <X size={18} />
                      </button>
                    )}
                    <kbd>⌘ K</kbd>
                  </div>
                  <div className="search-suggestions">
                    Try <button onClick={() => setQuery('HackRice')}>HackRice</button>
                    <button onClick={() => setQuery('recruiter')}>recruiter</button>
                    <button onClick={() => setQuery('Maya')}>Maya</button>
                  </div>
                  <div className="board-toolbar">
                    <h2>
                      {!query.trim()
                        ? 'Start with something you remember'
                        : searching
                          ? 'Looking through your pile…'
                          : `${results.length} ${results.length === 1 ? 'item' : 'items'} · ${sourceResults.length} ${sourceResults.length === 1 ? 'source' : 'sources'}`}
                    </h2>
                  </div>
                  <p className="search-mode">{searchProvider}</p>
                  {!!results.length && <h3 className="search-group-title">Items</h3>}
                  <div className="results-grid">
                    {results.map((i) => (
                      <div key={i.id}>
                        {renderCard(i)}
                        <SearchExcerpt
                          text={i.evidence || i.description || i.title}
                          query={query}
                        />
                      </div>
                    ))}
                  </div>
                  {!!sourceResults.length && (
                    <h3 className="search-group-title">Sources · the original context</h3>
                  )}
                  <div className="source-grid search-source-results">
                    {sourceResults.map((source) => (
                      <div key={source.id}>
                        {sourceRow(source)}
                        <SearchExcerpt
                          text={source.transcription || source.rawText}
                          query={query}
                        />
                      </div>
                    ))}
                  </div>
                  {!searching && !results.length && !sourceResults.length && (
                    <div className="empty-page">
                      <Search size={38} />
                      <h3>
                        {query.trim()
                          ? 'Nothing in your pile matches that yet.'
                          : 'A name, a deadline, a half-remembered thought.'}
                      </h3>
                      <p>Try a name, a project, or a few words you remember.</p>
                      {!!query.trim() && (
                        <button className="small-button" onClick={() => setQuery('')}>
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              {page === 'settings' && (
                <div className="settings-grid">
                  <CalendarSettings
                    config={data.config}
                    preferences={data.preferences}
                    onChange={refresh}
                  />
                  <section className="content-panel settings-panel">
                    <h2>A quick way to get the hang of it.</h2>
                    <p>
                      Talk, type, upload. Pile keeps the original and gives every useful thing a
                      home.
                    </p>
                    <button
                      className="small-button"
                      onClick={() => {
                        setIntro(0);
                        setOnboarding(true);
                      }}
                    >
                      Take the 10-second tour
                      <ArrowRight size={15} />
                    </button>
                    <div className="fixture-links">
                      <h3>Your demo kit</h3>
                      <a href="/api/fixtures/sample-syllabus.pdf">
                        Download sample syllabus
                        <ArrowUpRight size={15} />
                      </a>
                      <a href="/api/fixtures/sample-event.png">
                        Download sample event flyer
                        <ArrowUpRight size={15} />
                      </a>
                      <a href="/api/fixtures/sample-meeting-notes.txt">
                        Download meeting notes
                        <ArrowUpRight size={15} />
                      </a>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            pile<span>·</span>a little less on your mind.
          </span>
          <span>Your thoughts. A little more room.</span>
        </footer>
      </div>
      {toast && !review && !detail && !voice && !sourcePreview && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Modal
        open={!!detail}
        onClose={() => setDetail(undefined)}
        title="A closer look"
        description="A little context makes everything clearer."
      >
        {detail && (
          <ItemEditor
            timezone={timezone}
            key={detail.id}
            item={data?.items.find((i) => i.id === detail.id) || detail}
            source={data?.sources.find((s) => s.id === detail.sourceId)}
            onSave={async (patch) => {
              await api('items/' + detail.id, 'PATCH', patch);
              await refresh();
              setToast('Changes saved.');
              setDetail(undefined);
            }}
            onCalendar={async (remove) => {
              await api('calendar/' + detail.id, remove ? 'DELETE' : 'POST');
              await refresh();
              setToast(remove ? 'Removed from calendar.' : 'Added to calendar.');
            }}
            onDelete={async () => {
              if (!window.confirm('Delete this item? Your original source will stay in the inbox.'))
                return;
              await api('items/' + detail.id, 'DELETE');
              await refresh();
              setDetail(undefined);
              setToast('Item deleted.');
            }}
            onArchive={async () => {
              await api('items/' + detail.id, 'PATCH', { status: 'archived' });
              await refresh();
              setDetail(undefined);
              setToast('Tucked away.');
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!review}
        onClose={() => setReview(undefined)}
        title={
          data?.sources.find((s) => s.id === review)?.metadata
            ? 'Syllabus ready'
            : 'A few things found their place.'
        }
        description={
          data?.sources.find((s) => s.id === review)?.summary ||
          'Review what Pile found before adding anything to your calendar.'
        }
        wide
      >
        {review && (
          <ReviewPanel
            items={
              data?.items.filter((i) => i.sourceId === review && i.status !== 'archived') || []
            }
            timezone={timezone}
            source={data?.sources.find((s) => s.id === review)}
            onRefresh={refresh}
            calendarName={
              (data?.config.calendar || 'Demo calendar') +
              (data?.config.googleConnected
                ? ` · ${data.preferences.calendarName || 'Primary calendar'}`
                : '')
            }
            onApprove={async (ids, calendar) => {
              for (const id of ids) {
                const i = data!.items.find((x) => x.id === id)!;
                if (i.needsClarification)
                  throw new Error('Edit uncertain items before approving them.');
                await api('items/' + id, 'PATCH', { status: 'planned' });
                if (calendar && (i.startDateTime || i.dueDate)) await api('calendar/' + id, 'POST');
              }
              await refresh();
              setReview(undefined);
              setToast(
                calendar
                  ? `${
                      ids.filter((id) => {
                        const i = data!.items.find((x) => x.id === id)!;
                        return !!(i.dueDate || i.startDateTime);
                      }).length
                    } added to ${data?.config.calendar}.`
                  : 'Saved to your board.',
              );
            }}
          />
        )}
      </Modal>
      <Modal
        open={!!sourcePreview}
        onClose={() => setSourcePreview(undefined)}
        title={sourcePreview?.fileName || 'The original thought'}
        description="Your source stays attached to every extracted item."
        wide={sourcePreview?.type === 'pdf' || sourcePreview?.type === 'image'}
      >
        {sourcePreview && (
          <div className="source-detail">
            <span className="mode-pill">{sourcePreview.provider || sourcePreview.type}</span>
            <SourcePreview source={sourcePreview} />
            {sourcePreview.fileUrl && (
              <a
                className="small-button"
                href={sourcePreview.fileUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open original file
                <ExternalLink size={15} />
              </a>
            )}
            <p className="subtle">{sourcePreview.error}</p>
            <div className="modal-actions">
              <button
                className="text-button danger"
                onClick={() => {
                  if (window.confirm('Delete this source and all its extracted items?'))
                    act(async () => {
                      await api('sources/' + sourcePreview.id, 'DELETE');
                      setSourcePreview(undefined);
                    }, 'Source and items deleted.');
                }}
              >
                <Trash2 size={15} />
                Delete source & items
              </button>
              <button
                className="small-button"
                onClick={() => {
                  setReview(sourcePreview.id);
                  setSourcePreview(undefined);
                }}
              >
                View extracted items
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={voice}
        onClose={() => setVoice(false)}
        title="Let it all out."
        description="A thought doesn’t have to be tidy to be useful."
      >
        {voice && (
          <VoiceCapture
            real={data?.config.voice || false}
            demo={data?.config.demo || false}
            onCapture={async (t, duration) => {
              setVoice(false);
              await capture(t, 'voice', duration);
            }}
          />
        )}
      </Modal>
      <Modal
        open={newItem}
        onClose={() => setNewItem(false)}
        title="One little thing"
        description="Add a task, idea, or note exactly as you like it."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setNewItem(false);
            await act(
              () =>
                api('items', 'POST', {
                  title: String(form.get('title')),
                  type: String(form.get('type')),
                  priority: 'medium',
                  confidence: 1,
                  needsClarification: false,
                  project: 'Personal',
                  ...(form.get('date') ? { dueDate: String(form.get('date')), allDay: true } : {}),
                }),
              'Added to your pile.',
            );
          }}
        >
          <label className="field-label">
            What’s on your mind?
            <input name="title" autoFocus required placeholder="Email Maya" maxLength={240} />
          </label>
          <div className="field-row">
            <label className="field-label">
              Type
              <select name="type">
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Date
              <input name="date" type="date" />
            </label>
          </div>
          <div className="modal-actions">
            <button className="primary-button">
              Add to Pile
              <Plus size={17} />
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={onboarding}
        onClose={() => setOnboarding(false)}
        title={
          [
            'A desk for everything on your mind.',
            'Start with the messy version.',
            'A plan you have the final say in.',
          ][intro]
        }
        description="Meet your new place to put it all."
      >
        <div className="intro-content">
          <span className="intro-icon">
            <span className="intro-paper-label">
              {['a thought', 'a capture', 'a little clarity'][intro]}
            </span>
            {intro === 0 ? (
              <Inbox size={48} />
            ) : intro === 1 ? (
              <Mic size={48} />
            ) : (
              <CheckCheck size={48} />
            )}
          </span>
          <p>
            {
              [
                'The little things add up. Give them a place to land, so you can get on with your day.',
                'A voice note on a walk. A syllabus. A messy thought. Start wherever you are.',
                'Useful tasks, dates, and ideas — with you in control of the final call.',
              ][intro]
            }
          </p>
          <div className="intro-dots">
            {[0, 1, 2].map((n) => (
              <i key={n} className={n === intro ? 'active' : ''} />
            ))}
          </div>
          <button
            className="primary-button"
            onClick={() => (intro < 2 ? setIntro(intro + 1) : setOnboarding(false))}
          >
            {intro === 2 ? 'Enter Pile' : 'Next'}
            <ArrowRight size={17} />
          </button>
        </div>
      </Modal>
    </div>
  );
}
function ItemEditor({
  timezone,
  item,
  source,
  onSave,
  onCalendar,
  onArchive,
  onDelete,
}: {
  timezone: string;
  item: Item;
  source?: Source;
  onSave: (patch: unknown) => Promise<void>;
  onCalendar: (remove: boolean) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(item.type);
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const d = String(f.get('date') || '');
        const time = String(f.get('time') || '');
        const date = d ? (time ? fromZonedTime(d + 'T' + time, timezone).toISOString() : d) : null;
        perform(() =>
          onSave({
            title: f.get('title'),
            description: f.get('description'),
            type,
            priority: f.get('priority'),
            project: f.get('project'),
            location: f.get('location'),
            ...(type === 'event'
              ? { startDateTime: date, dueDate: null }
              : { dueDate: date, startDateTime: null }),
            endDateTime:
              f.get('endTime') && d
                ? fromZonedTime(
                    String(f.get('endDate') || d) + 'T' + f.get('endTime'),
                    timezone,
                  ).toISOString()
                : null,
            tier: f.get('tier'),
            recurrence: f.get('recurring')
              ? {
                  days: f.getAll('days'),
                  until: String(f.get('until') || '') || undefined,
                  timezone: item.recurrence?.timezone || timezone,
                }
              : null,
            allDay: !time,
            needsClarification: false,
            confidence: 1,
            status: f.get('status'),
          }),
        );
      }}
    >
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      {item.needsClarification && (
        <div className="question-box">
          {item.clarificationQuestion || 'Please confirm the details.'}
        </div>
      )}
      <fieldset disabled={busy}>
        <label className="field-label">
          Title
          <input name="title" required defaultValue={item.title} maxLength={240} />
        </label>
        <label className="field-label">
          Description
          <textarea name="description" defaultValue={item.description} rows={3} />
        </label>
        <div className="field-row">
          <label className="field-label">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as Item['type'])}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Priority
            <select name="priority" defaultValue={item.priority}>
              {['low', 'medium', 'high'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field-label">
            Date
            <input
              type="date"
              name="date"
              defaultValue={
                item.startDateTime || item.dueDate
                  ? itemDay((item.startDateTime || item.dueDate)!, timezone)
                  : ''
              }
            />
          </label>
          <label className="field-label">
            Time <span>optional</span>
            <input
              type="time"
              name="time"
              defaultValue={
                (item.startDateTime || item.dueDate || '').includes('T')
                  ? new Date(item.startDateTime || item.dueDate!).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: timezone,
                    })
                  : ''
              }
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field-label">
            Project
            <input name="project" defaultValue={item.project || 'Personal'} maxLength={80} />
          </label>
          <label className="field-label">
            Status
            <select name="status" defaultValue={item.status === 'inbox' ? 'planned' : item.status}>
              {['inbox', 'planned', 'in_progress', 'done', 'archived'].map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label className="field-label">
            End date
            <input
              type="date"
              name="endDate"
              defaultValue={item.endDateTime ? itemDay(item.endDateTime, timezone) : ''}
            />
          </label>
          <label className="field-label">
            End time
            <input
              type="time"
              name="endTime"
              defaultValue={
                item.endDateTime?.includes('T')
                  ? formatInTimeZone(item.endDateTime, timezone, 'HH:mm')
                  : ''
              }
            />
          </label>
        </div>
        <label className="field-label">
          Keep under
          <select name="tier" defaultValue={item.tier || 'important'}>
            <option value="important">Important / Calendar</option>
            <option value="optional">Optional</option>
            <option value="reference">Useful references</option>
          </select>
        </label>
        <details className="recurrence-editor" open={!!item.recurrence}>
          <summary>Recurring schedule</summary>
          <label>
            <input type="checkbox" name="recurring" defaultChecked={!!item.recurrence} /> Repeat
            weekly
          </label>
          <div className="weekday-choices">
            {(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const).map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  name="days"
                  value={day}
                  defaultChecked={item.recurrence?.days.includes(day)}
                />
                {day}
              </label>
            ))}
          </div>
          <label className="field-label">
            Term end
            <input type="date" name="until" defaultValue={item.recurrence?.until} />
          </label>
          <small>Schedule timezone: {item.recurrence?.timezone || timezone}</small>
        </details>
        <label className="field-label">
          Location
          <input name="location" defaultValue={item.location} />
        </label>
      </fieldset>
      <details className="source-context">
        <summary>
          <Icon name={source?.type || 'text'} />
          From {source?.fileName || `your ${source?.type || 'text'} capture`}
          <ChevronDown size={15} />
        </summary>
        <p>{source?.rawText || item.sourceExcerpt || source?.fileName}</p>
        <small>{item.reasoningSummary}</small>
        {source?.fileUrl && (
          <a href={source.fileUrl} target="_blank" rel="noreferrer">
            Open original
            <ExternalLink size={13} />
          </a>
        )}
      </details>
      <div className="editor-calendar">
        {item.calendarStatus === 'synced' ? (
          <>
            <span className="synced">
              <CheckCheck size={16} />
              Linked to calendar · edits update the event
            </span>
            <button
              type="button"
              className="text-button"
              onClick={() => perform(() => onCalendar(true))}
              disabled={busy}
            >
              Remove from calendar
            </button>
          </>
        ) : (
          (item.startDateTime || item.dueDate) && (
            <button
              className="small-button"
              type="button"
              disabled={busy || item.needsClarification}
              onClick={() => perform(() => onCalendar(false))}
            >
              <CalendarPlus size={17} />
              Add to calendar
            </button>
          )
        )}
      </div>
      {(item.startDateTime || item.dueDate) && (
        <button
          type="button"
          className="small-button apple-export"
          disabled={busy || item.needsClarification}
          onClick={() =>
            perform(async () => {
              await downloadCalendar([item.id]);
              setError('');
            })
          }
        >
          Download calendar file (.ics)
        </button>
      )}
      <div className="modal-actions">
        <button
          className="text-button"
          type="button"
          onClick={() => perform(onArchive)}
          disabled={busy}
        >
          <Archive size={16} />
          Archive
        </button>
        <button
          className="text-button danger"
          type="button"
          disabled={busy}
          onClick={() => perform(onDelete)}
        >
          <Trash2 size={15} />
          Delete
        </button>
        <button className="primary-button" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          Save changes
        </button>
      </div>
    </form>
  );
}
function ReviewPanel({
  items,
  source,
  timezone,
  calendarName,
  onRefresh,
  onApprove,
}: {
  items: Item[];
  source?: Source;
  timezone: string;
  calendarName: string;
  onRefresh: () => Promise<unknown>;
  onApprove: (ids: string[], calendar: boolean) => Promise<void>;
}) {
  const important = items.filter(
    (i) =>
      !['optional', 'reference'].includes(i.tier || '') &&
      !i.needsClarification &&
      i.calendarStatus !== 'synced',
  );
  const [selected, setSelected] = useState(important.map((i) => i.id));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmation, setConfirmation] = useState(false),
    [editing, setEditing] = useState<Item>(),
    [exported, setExported] = useState(false);
  const dated = items.filter((i) => selected.includes(i.id) && (i.dueDate || i.startDateTime));
  async function approve(calendar: boolean) {
    setBusy(true);
    setError('');
    try {
      await onApprove(selected, calendar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <div className="review-edit">
        <button className="text-button" onClick={() => setEditing(undefined)}>
          <ChevronLeft size={16} />
          Back to import
        </button>
        <ItemEditor
          key={editing.id}
          item={items.find((i) => i.id === editing.id) || editing}
          source={source}
          timezone={timezone}
          onSave={async (patch) => {
            await api('items/' + editing.id, 'PATCH', patch);
            await onRefresh();
            setEditing(undefined);
          }}
          onCalendar={async (remove) => {
            await api('calendar/' + editing.id, remove ? 'DELETE' : 'POST');
            await onRefresh();
          }}
          onArchive={async () => {
            await api('items/' + editing.id, 'PATCH', { status: 'archived' });
            await onRefresh();
            setEditing(undefined);
          }}
          onDelete={async () => {
            await api('items/' + editing.id, 'DELETE');
            await onRefresh();
            setSelected(selected.filter((id) => id !== editing.id));
            setEditing(undefined);
          }}
        />
      </div>
    );
  if (confirmation)
    return (
      <div className="calendar-confirmation">
        <CalendarDays size={36} />
        <h3>Add to {calendarName.startsWith('Google') ? 'Google Calendar' : 'demo calendar'}</h3>
        <p>
          {dated.filter((i) => !i.recurrence).length} dates ·{' '}
          {dated.filter((i) => i.recurrence).length} recurring schedules
        </p>
        <p>
          Calendar: <strong>{calendarName}</strong>
        </p>
        <p className="subtle">
          Recurring schedules end on their confirmed term date. Already linked items are skipped.
        </p>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="small-button" disabled={busy} onClick={() => setConfirmation(false)}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy} onClick={() => approve(true)}>
            {busy ? 'Adding…' : `Confirm add ${dated.length}`}
          </button>
        </div>
      </div>
    );
  const groups = [
    [
      'Calendar',
      items.filter((i) => i.tier !== 'optional' && i.tier !== 'reference' && i.type === 'event'),
    ],
    [
      'Tasks & deadlines',
      items.filter((i) => i.tier !== 'optional' && i.tier !== 'reference' && i.type !== 'event'),
    ],
    ['Optional schedule', items.filter((i) => i.tier === 'optional')],
    ['Useful references', items.filter((i) => i.tier === 'reference')],
  ] as const;
  return (
    <div className="review-sheet">
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <p className="review-provenance">
        {source?.pageCount ? `${source.pageCount}-page source · ` : ''}Only the useful parts become
        items. Your original stays intact.
      </p>
      <div className="review-summary">
        <span>
          <strong>
            {
              items.filter(
                (i) => i.tier !== 'optional' && !i.recurrence && (i.dueDate || i.startDateTime),
              ).length
            }
          </strong>{' '}
          dates
        </span>
        <span>
          <strong>{items.filter((i) => i.tier !== 'optional' && i.recurrence).length}</strong>{' '}
          schedules
        </span>
        <span>
          <strong>{items.filter((i) => i.tier === 'optional').length}</strong> optional
        </span>
      </div>
      <div className="review-select">
        <button className="text-button" onClick={() => setSelected(important.map((i) => i.id))}>
          Select all important
        </button>
        <button className="text-button" onClick={() => setSelected([])}>
          Clear
        </button>
      </div>
      <div className="review-list">
        {groups
          .filter(([, group]) => group.length)
          .map(([label, group]) => (
            <section
              className={'review-group ' + (label === 'Optional schedule' ? 'optional-group' : '')}
              key={label}
            >
              <h3>{label}</h3>
              {group.map((i) => (
                <div className="review-row" key={i.id}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${i.title}`}
                    checked={selected.includes(i.id)}
                    disabled={busy || i.needsClarification || i.calendarStatus === 'synced'}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, i.id]
                          : selected.filter((id) => id !== i.id),
                      )
                    }
                  />
                  <div>
                    <strong>{i.title}</strong>
                    <span>
                      {i.recurrence
                        ? `${i.recurrence.days.join(' / ')} · ${i.startDateTime?.includes('T') ? formatInTimeZone(i.startDateTime, i.recurrence.timezone, 'h:mm a') : 'Time to confirm'} · through ${i.recurrence.until || '?'}`
                        : dateLabel(i.startDateTime || i.dueDate, timezone) || i.type}
                      {i.location && ` · ${i.location}`}
                    </span>
                    {(i.evidence || i.sourceExcerpt) && (
                      <details className="item-evidence">
                        <summary>Why this item?</summary>
                        <blockquote>{i.evidence || i.sourceExcerpt}</blockquote>
                      </details>
                    )}
                    {i.needsClarification && <small>{i.clarificationQuestion}</small>}
                    {i.calendarStatus === 'synced' && <small>Already linked to calendar</small>}
                  </div>
                  <button
                    className="text-button"
                    aria-label={`Edit candidate ${i.title}`}
                    onClick={() => setEditing(i)}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </section>
          ))}
      </div>
      {source && (
        <details className="review-reference">
          <summary>View source details · {source.fileName || 'Original capture'}</summary>
          {source.metadata && (
            <dl>
              {Object.entries(source.metadata).map(
                ([k, v]) =>
                  v && (
                    <Fragment key={k}>
                      <dt>{k.replace(/([A-Z])/g, ' $1')}</dt>
                      <dd>{v}</dd>
                    </Fragment>
                  ),
              )}
            </dl>
          )}
          <p>{source.summary}</p>
          {source.fileUrl && (
            <a href={source.fileUrl} target="_blank" rel="noreferrer">
              Open original document
            </a>
          )}
        </details>
      )}
      {!items.length && <p>Your original is saved. There are no new actions or dates to manage.</p>}
      <div className="modal-actions review-actions">
        <button
          className="small-button"
          disabled={busy || !selected.length}
          onClick={() => approve(false)}
        >
          Save to Pile ({selected.length})
        </button>
        <button
          className="primary-button"
          disabled={busy || !dated.length}
          onClick={() => setConfirmation(true)}
        >
          <CalendarPlus size={17} />
          Add {dated.length} to calendar
        </button>
      </div>
      <button
        className="text-button apple-export"
        disabled={busy || !dated.length}
        onClick={async () => {
          setBusy(true);
          try {
            await downloadCalendar(dated.map((i) => i.id));
            setExported(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Export failed.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Download calendar file (.ics)
      </button>
      {exported && (
        <p role="status" className="subtle">
          Exported. Open the calendar file in Apple Calendar to add these events.
        </p>
      )}
    </div>
  );
}
function VoiceCapture({
  real,
  demo,
  onCapture,
}: {
  real: boolean;
  demo: boolean;
  onCapture: (t: string, duration?: number) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState('');
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const recordedDuration = useRef<number | undefined>(undefined);
  const stream = useRef<MediaStream | null>(null);
  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(
      () => setSeconds(Math.floor((performance.now() - startedAt.current) / 1000)),
      250,
    );
    return () => clearInterval(t);
  }, [recording]);
  async function start() {
    setActivity('Waiting for microphone access…');
    setError('');
    setBusy(true);
    try {
      let acceptingStream = true;
      let permissionTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        stream.current = await Promise.race([
          navigator.mediaDevices.getUserMedia({ audio: true }).then((granted) => {
            if (!acceptingStream || unmounted.current) {
              granted.getTracks().forEach((track) => track.stop());
              throw new Error('Microphone request cancelled.');
            }
            return granted;
          }),
          new Promise<never>((_, reject) => {
            permissionTimer = setTimeout(
              () =>
                reject(
                  new Error(
                    'Microphone permission is still pending. Try again, type a transcript, or use the sample.',
                  ),
                ),
              15000,
            );
          }),
        ]);
      } finally {
        acceptingStream = false;
        clearTimeout(permissionTimer);
      }
      if (unmounted.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        return;
      }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(
        (m) =>
          typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        recordedDuration.current = Math.max(0.001, (performance.now() - startedAt.current) / 1000);
        setSeconds(Math.floor(recordedDuration.current));
        stream.current?.getTracks().forEach((t) => t.stop());
        if (unmounted.current) return;
        setRecording(false);
        if (!real) {
          setError(
            'Recording finished. Transcription isn’t configured here; type what you said or use the sample transcript.',
          );
          return;
        }
        setActivity('Transcribing...');
        setBusy(true);
        try {
          const form = new FormData();
          form.set(
            'audio',
            new File(chunks, 'voice.' + (rec.mimeType.includes('mp4') ? 'm4a' : 'webm'), {
              type: rec.mimeType,
            }),
          );
          const r = await api<{ text: string }>('transcribe', 'POST', form);
          setTranscript(r.text);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Transcription failed.');
        } finally {
          setBusy(false);
        }
      };
      setSeconds(0);
      setTranscript('');
      rec.onerror = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setError('Recording stopped unexpectedly. Please try again.');
      };
      startedAt.current = performance.now();
      recordedDuration.current = undefined;
      rec.start(1000);
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(
        e instanceof Error && e.message.startsWith('Microphone permission')
          ? e.message
          : 'Microphone access is unavailable. You can type a transcript or use the sample.',
      );
    } finally {
      if (!unmounted.current) setBusy(false);
    }
  }
  async function sample() {
    setActivity('Loading the sample transcript…');
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('demo', 'true');
      const r = await api<{ text: string }>('transcribe', 'POST', form);
      setTranscript(r.text);
      recordedDuration.current = undefined;
      setSeconds(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sample.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-panel">
      <span className="mode-pill">
        {real
          ? 'ElevenLabs · speech-to-text configured'
          : 'Demo voice · sample transcript available'}
      </span>
      <div aria-hidden="true" className={'waveform ' + (recording ? 'recording' : '')}>
        {Array.from({ length: 29 }, (_, n) => (
          <i
            key={n}
            style={{
              height: 12 + ((n * 17) % 45),
              animationDelay: n * 0.04 + 's',
            }}
          />
        ))}
      </div>
      <div className="recording-time">
        {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
      </div>
      <button
        className={'record-button ' + (recording ? 'is-recording' : '')}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        disabled={busy}
        onClick={() => (recording ? recorder.current?.stop() : start())}
      >
        {recording ? <Square size={21} /> : <Mic size={24} />}
      </button>
      <strong className="record-label">{recording ? 'Stop recording' : 'Record a thought'}</strong>
      <p>
        {recording
          ? 'Recording · the bars are a status animation.'
          : busy
            ? activity
            : real
              ? 'Press to record. No perfect sentences needed.'
              : 'Transcription is not configured here. Type below or use the labeled sample.'}
      </p>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <label className="field-label">
        Your transcript{' '}
        <textarea
          aria-label="Voice transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={4}
          placeholder="Your words will land here. You can edit them before sorting."
        />
      </label>
      <div className="modal-actions">
        {demo && (
          <button className="text-button" onClick={sample} disabled={busy || recording}>
            Use sample transcript
          </button>
        )}
        <button
          className="primary-button"
          disabled={!transcript.trim() || busy || recording}
          onClick={() => onCapture(transcript, recordedDuration.current)}
        >
          Sort this
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SearchExcerpt({ text, query }: { text: string; query: string }) {
  const tokens = searchTokens(query);
  return (
    <p className="search-excerpt">
      {matchingExcerpt(text, query)
        .split(/(\s+)/)
        .map((word, n) =>
          searchTokens(word).some((t) => tokens.includes(t)) ? (
            <mark key={n}>{word}</mark>
          ) : (
            <Fragment key={n}>{word}</Fragment>
          ),
        )}
    </p>
  );
}

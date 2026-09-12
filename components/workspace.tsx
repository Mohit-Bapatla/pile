'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
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
  MoreHorizontal,
  Sparkles,
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
};
type Snapshot = {
  items: Item[];
  sources: Source[];
  projects: Project[];
  events: CalendarEvent[];
  config: Config;
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
// OAuth starts with a full-page navigation so the provider redirect can leave the app.
const googleConnectPath = '/api/oauth/connect';
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
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={'modal ' + (wide ? 'wide' : '')}>
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
  const [detail, setDetail] = useState<Item>();
  const [review, setReview] = useState<string>();
  const [voice, setVoice] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [intro, setIntro] = useState(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [remoteEvents, setRemoteEvents] = useState<CalendarEvent[]>([]);
  const [sourcePreview, setSourcePreview] = useState<Source>();
  const [newItem, setNewItem] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLTextAreaElement>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = localDate(new Date(), timezone);
  const refresh = useCallback(async () => {
    const next = await api<Snapshot>('state');
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
        setAnswer(found.answer || '');
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
  async function capture(content: string | File, type: 'text' | 'voice' = 'text') {
    if (busy) return;
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
        body = { text: content, type, timezone };
      }
      const source = await api<Source>('capture', 'POST', body);
      setText('');
      await refresh();
      const result = await api<{ items: Item[] }>('process/' + source.id, 'POST');
      await refresh();
      setToast(`${result.items.length} things, a little more organized.`);
      if (
        source.type === 'pdf' ||
        source.type === 'image' ||
        result.items.some((i) => i.needsClarification)
      )
        setReview(source.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not capture this.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function update(item: Item, patch: unknown, message?: string) {
    await act(() => api('items/' + item.id, 'PATCH', patch), message);
  }

  const active =
    data?.items.filter((i) =>
      showDone ? i.status === 'done' : !['done', 'archived'].includes(i.status),
    ) || [];
  const needsAttention = active.filter(
    (i) =>
      i.needsClarification ||
      i.status === 'inbox' ||
      ['suggested', 'failed'].includes(i.calendarStatus),
  );
  const inbox = active.filter((i) => section(i, today, timezone) === 'Inbox');
  const events = Array.from(
    new Map([...(data?.events || []), ...remoteEvents].map((e) => [e.id, e])).values(),
  ).sort((a, b) => a.start.localeCompare(b.start));
  const title =
    page === 'board'
      ? 'A little less on your mind.'
      : page === 'inbox'
        ? 'Everything starts here.'
        : page === 'calendar'
          ? 'Make room for what matters.'
          : page === 'projects'
            ? view[1]
              ? data?.projects.find((p) => p.id === view[1])?.name || 'Project'
              : 'A place for every little thing.'
            : page === 'search'
              ? 'It’s somewhere in your pile.'
              : 'Make yourself at home.';
  const pending =
    data?.sources.filter((s) => ['queued', 'processing', 'error'].includes(s.processingStatus)) ||
    [];
  function renderCard(item: Item) {
    return (
      <article
        key={item.id}
        className={`pile-card ${item.type === 'idea' ? 'lilac' : item.project === 'HackRice' ? 'peach' : item.project === 'Calculus' ? 'butter' : item.project === 'Job Search' ? 'blue' : 'mint'} ${item.status === 'done' ? 'completed' : ''}`}
        data-testid="item-card"
      >
        <div className="card-top">
          <span className="eyebrow">
            <Icon name={item.type} />
            {item.type}
          </span>
          <button
            className="icon-button more"
            aria-label={`Edit ${item.title}`}
            onClick={() => setDetail(item)}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
        <button className="card-main" onClick={() => setDetail(item)}>
          <h3>{item.title}</h3>
          {item.description && <p>{item.description}</p>}
        </button>
        <div className="card-meta">
          {(item.dueDate || item.startDateTime) && (
            <span className={section(item, today, timezone) === 'Today' ? 'due-today' : ''}>
              <Clock size={13} />
              {dateLabel(item.dueDate || item.startDateTime, timezone)}
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
          <span className="project-label">
            <i />
            {item.project || 'Unsorted'}
          </span>
          <div>
            <Icon
              name={data?.sources.find((s) => s.id === item.sourceId)?.type || 'text'}
              size={14}
            />
            {!['idea', 'note', 'reference'].includes(item.type) && (
              <button
                className="complete-button"
                aria-label={
                  item.status === 'done' ? `Reopen ${item.title}` : `Complete ${item.title}`
                }
                onClick={() =>
                  update(
                    item,
                    { status: item.status === 'done' ? 'planned' : 'done' },
                    item.status === 'done' ? 'Back on the board.' : 'Off the board.',
                  )
                }
              >
                <Check size={13} />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }
  function sourceRow(s: Source) {
    const count = data?.items.filter((i) => i.sourceId === s.id).length || 0;
    return (
      <div className="source-row" key={s.id}>
        <span className="source-icon">
          <Icon name={s.type} size={22} />
        </span>
        <button className="source-open" onClick={() => setSourcePreview(s)}>
          <strong>{s.fileName || s.rawText.slice(0, 90) || 'Image capture'}</strong>
          <span>
            {s.type} · {dateLabel(s.createdAt, timezone)} · {count} items
          </span>
        </button>
        <span className={'status ' + (s.processingStatus === 'error' ? 'error-status' : '')}>
          {s.processingStatus.replaceAll('_', ' ')}
        </span>
        <button
          className="icon-button"
          aria-label="Review source items"
          onClick={() => setReview(s.id)}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
    );
  }
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
        <button className="workspace-switch" onClick={() => setOnboarding(true)}>
          <span className="tiny-avatar">M</span>My little workspace
          <ChevronDown size={14} />
        </button>
        <nav>
          {nav.map(([label, href, NavIcon]) => (
            <Link
              key={href}
              href={href}
              className={(page === label.toLowerCase() ? 'active ' : '') + 'nav-link'}
            >
              <NavIcon size={19} />
              {label}
              {label === 'Inbox' && inbox.length > 0 && (
                <span className="count">{inbox.length}</span>
              )}
              {label === 'Search' && <kbd>⌘ K</kbd>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="sidebar-label">
            YOUR SPACES
            <Link href="/app/projects" aria-label="View projects">
              <Plus size={15} />
            </Link>
          </div>
          {data?.projects.slice(0, 6).map((p) => (
            <Link href={'/app/projects/' + p.id} key={p.id}>
              <i className={'project-dot ' + p.color} />
              {p.name}
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sparkles size={18} />
            <p>
              A busy mind deserves
              <br />a quiet place to land.
            </p>
            <span>That’s what we’re here for.</span>
          </div>
          <Link
            className={'nav-link ' + (page === 'settings' ? 'active' : '')}
            href="/app/settings"
          >
            <Settings size={19} />
            Settings
          </Link>
          <div className="profile">
            <span className="avatar">M</span>
            <div>
              <strong>My workspace</strong>
              <small>{data?.config.demo ? 'Demo mode' : 'Personal workspace'}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Show welcome guide"
              onClick={() => setOnboarding(true)}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
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
                {page === 'board' ? (
                  <>
                    YOUR MIND CAN EXHALE <span>✳</span>
                  </>
                ) : (
                  <>YOUR {page.toUpperCase()}</>
                )}
              </div>
              <h1>{title}</h1>
              <p>
                {page === 'board' ? (
                  <>
                    You’ve got{' '}
                    <strong>
                      {active.filter((i) => section(i, today, timezone) === 'Today').length} things
                    </strong>{' '}
                    that matter today. Let’s take them one at a time.
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
            <span className="header-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              <strong>
                {new Date().toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>
            </span>
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
            <div className="loading-state">
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
                    <Sparkles size={16} />
                    <span>A PLACE FOR EVERYTHING ON YOUR MIND</span>
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
              {page === 'board' && (
                <>
                  <div className="board-toolbar">
                    <div>
                      <h2>Your board</h2>
                      <span className="subtle">A little structure. A lot less noise.</span>
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
                      {(inbox.length > 0 || pending.length > 0) && (
                        <div className="inbox-tray">
                          <div>
                            <Inbox size={19} />
                            <strong>In your inbox</strong>
                            <span>{inbox.length + pending.length}</span>
                          </div>
                          {pending.map((s) => (
                            <div key={s.id} className="processing-row">
                              {s.processingStatus === 'error' ? (
                                <>
                                  <span>{s.fileName || 'Capture'} needs another try.</span>
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      act(
                                        () => api('process/' + s.id, 'POST'),
                                        'Sorted. Ready to review.',
                                      )
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
                            <button
                              className="text-button"
                              onClick={() => setReview(inbox[0].sourceId)}
                            >
                              A couple things need a human.
                              <ArrowRight size={16} />
                            </button>
                          )}
                        </div>
                      )}
                      <div className="board-columns">
                        {(['Today', 'This week', 'Later'] as const).map((s, index) => (
                          <section className="board-column" key={s}>
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
                                ? 'Just the next few things.'
                                : index === 1
                                  ? 'A little look ahead.'
                                  : 'Good things can wait.'}
                            </div>
                            {active
                              .filter((i) => section(i, today, timezone) === s)
                              .map((item) => renderCard(item))}
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
                                <span>Let an idea be an idea. ✧</span>
                              </div>
                            )}
                          </section>
                        ))}
                      </div>
                      <div className="board-caption">
                        <span>✧</span> Everything has a place. You don’t have to hold it all.
                      </div>
                    </div>
                    <aside className="right-rail">
                      <section className="mini-calendar">
                        <div className="rail-heading">
                          <h3>Ahead of you</h3>
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
                          <h3>
                            <Sparkles size={17} />A little attention
                          </h3>
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
                        <span className="eyebrow">TRY A LITTLE MAGIC</span>
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
                  {[...data.sources]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map(sourceRow)}
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
                                <small>{e.demo ? 'Demo calendar' : 'Google Calendar'}</small>
                              </div>
                            ))}
                          {active
                            .filter(
                              (i) =>
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
                  <div className="results-grid">
                    {active.filter((i) => i.projectId === view[1]).map((i) => renderCard(i))}
                  </div>
                  <section className="content-panel">
                    <div className="panel-heading">
                      <h2>Captured context</h2>
                    </div>
                    {data.sources
                      .filter((s) =>
                        data.items.some((i) => i.projectId === view[1] && i.sourceId === s.id),
                      )
                      .map(sourceRow)}
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
                      placeholder="Try “what did I say about Maya?”"
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
                  {answer && (
                    <div className="memory-answer">
                      <Sparkles size={20} />
                      <p>{answer}</p>
                      <small>Backboard memory · may include older context</small>
                    </div>
                  )}
                  <div className="board-toolbar">
                    <h2>
                      {searching ? 'Looking through your pile…' : `${results.length} things found`}
                    </h2>
                  </div>
                  <div className="results-grid">{results.map((i) => renderCard(i))}</div>
                  {!searching && !results.length && (
                    <div className="empty-page">
                      <Search size={38} />
                      <h3>Couldn’t find that in your pile.</h3>
                      <p>Try a name, a project, or a few words you remember.</p>
                    </div>
                  )}
                </>
              )}
              {page === 'settings' && (
                <div className="settings-grid">
                  <section className="content-panel settings-panel">
                    <h2>Your connections</h2>
                    <div className="setting-row">
                      <span className="setting-icon">
                        <CalendarDays />
                      </span>
                      <div>
                        <h3>Google Calendar</h3>
                        <p>
                          {data.config.googleConnected
                            ? 'Connected. Approved items go to your primary calendar.'
                            : data.config.googleConfigured
                              ? 'Connect once. Keep your real calendar in the loop.'
                              : 'Demo calendar is ready. Google OAuth credentials can be added on the server.'}
                        </p>
                      </div>
                      {data.config.googleConfigured ? (
                        <a className="small-button" href={googleConnectPath} target="_self">
                          {data.config.googleConnected ? 'Reconnect' : 'Connect'}
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <span className="mode-pill">Demo</span>
                      )}
                    </div>
                    <div className="setting-row">
                      <span className="setting-icon">
                        <Sparkles />
                      </span>
                      <div>
                        <h3>Understanding your pile</h3>
                        <p>
                          {data.config.ai}.{' '}
                          {data.config.voice
                            ? 'Voice transcription and image understanding are available.'
                            : 'Text uses local rules. Voice has a sample transcript; the sample flyer works offline.'}
                        </p>
                      </div>
                    </div>
                    <div className="setting-row">
                      <span className="setting-icon">
                        <Clock />
                      </span>
                      <div>
                        <h3>Your timezone</h3>
                        <p>{timezone} · Dates are interpreted where you are.</p>
                      </div>
                    </div>
                  </section>
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
          <span>Made for the beautifully busy.</span>
        </footer>
      </div>
      {toast && (
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
        title="A few things found their place."
        description={
          data?.sources.find((s) => s.id === review)?.summary ||
          'Review what Pile found before adding anything to your calendar.'
        }
        wide
      >
        {review && (
          <ReviewPanel
            items={data?.items.filter((i) => i.sourceId === review) || []}
            calendarName={data?.config.calendar || 'Demo calendar'}
            onEdit={(i) => {
              setReview(undefined);
              setDetail(i);
            }}
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
                calendar ? 'Your calendar has a little more clarity.' : 'Saved to your board.',
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
      >
        {sourcePreview && (
          <div className="source-detail">
            <span className="mode-pill">{sourcePreview.provider || sourcePreview.type}</span>
            <p className="source-text">
              {sourcePreview.transcription ||
                sourcePreview.rawText ||
                'An image you added to your pile.'}
            </p>
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
            onCapture={async (t) => {
              setVoice(false);
              await capture(t, 'voice');
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
            'Your life doesn’t arrive neatly organized.',
            'Talk, type, upload, or drop anything in.',
            'We’ll turn it into the things you actually need.',
          ][intro]
        }
        description="Meet your new place to put it all."
      >
        <div className="intro-content">
          <span className="intro-icon">
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
  item,
  source,
  onSave,
  onCalendar,
  onArchive,
  onDelete,
}: {
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
        const date = d ? (time ? new Date(d + 'T' + time).toISOString() : d) : null;
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
            endDateTime: null,
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
          <Sparkles size={18} />
          {item.clarificationQuestion || 'Please confirm the details.'}
        </div>
      )}
      <fieldset disabled={busy || item.calendarStatus === 'synced'}>
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
                  ? itemDay(
                      (item.startDateTime || item.dueDate)!,
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                    )
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
        <label className="field-label">
          Location
          <input name="location" defaultValue={item.location} />
        </label>
      </fieldset>
      <details className="source-context">
        <summary>
          <Icon name={source?.type || 'text'} />
          From your {source?.type || 'text'} capture
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
              Synced · remove before editing
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
          disabled={busy || item.calendarStatus === 'synced'}
          onClick={() => perform(onDelete)}
        >
          <Trash2 size={15} />
          Delete
        </button>
        <button className="primary-button" disabled={busy || item.calendarStatus === 'synced'}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
          Save changes
        </button>
      </div>
    </form>
  );
}
function ReviewPanel({
  items,
  calendarName,
  onEdit,
  onApprove,
}: {
  items: Item[];
  calendarName: string;
  onEdit: (i: Item) => void;
  onApprove: (ids: string[], calendar: boolean) => Promise<void>;
}) {
  const [selected, setSelected] = useState(
    items.filter((i) => !i.needsClarification && i.calendarStatus !== 'synced').map((i) => i.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dated = items.filter((i) => selected.includes(i.id) && (i.dueDate || i.startDateTime));
  async function approve(calendar: boolean) {
    setBusy(true);
    try {
      await onApprove(selected, calendar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <div className="review-summary">
        <span>
          <Sparkles size={17} />
          {items.length} things found
        </span>
        <span>{items.filter((i) => i.dueDate || i.startDateTime).length} dates</span>
        <span>{calendarName}</span>
      </div>
      <div className="review-list">
        {items.map((i) => (
          <div className="review-row" key={i.id}>
            <input
              aria-label={`Select ${i.title}`}
              type="checkbox"
              checked={selected.includes(i.id)}
              disabled={i.needsClarification || i.calendarStatus === 'synced' || busy}
              onChange={(e) =>
                setSelected(
                  e.target.checked ? [...selected, i.id] : selected.filter((id) => id !== i.id),
                )
              }
            />
            <span className="review-icon">
              <Icon name={i.type} size={20} />
            </span>
            <div>
              <strong>{i.title}</strong>
              <span>
                {i.type} · {dateLabel(i.startDateTime || i.dueDate) || 'No date'}
                {i.location && ' · ' + i.location}
              </span>
              {i.needsClarification && <small>{i.clarificationQuestion}</small>}
              {i.calendarStatus === 'synced' && <small>Synced to calendar</small>}
            </div>
            <button className="text-button" onClick={() => onEdit(i)}>
              Edit
            </button>
          </div>
        ))}
      </div>
      <p className="review-note">
        Choose what to keep. Uncertain details need a quick edit first. Only selected, dated items
        will go to your calendar.
      </p>
      <div className="modal-actions">
        <button
          className="small-button"
          disabled={busy || !selected.length}
          onClick={() => approve(false)}
        >
          Save only ({selected.length})
        </button>
        <button
          className="primary-button"
          disabled={busy || !dated.length}
          onClick={() => approve(true)}
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : <CalendarPlus size={17} />}
          Add {dated.length} to calendar
        </button>
      </div>
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
  onCapture: (t: string) => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
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
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  async function start() {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const rec = new MediaRecorder(stream.current);
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (unmounted.current) return;
        setRecording(false);
        if (!real) {
          setError(
            'Recording finished. Transcription isn’t configured here; type what you said or use the sample transcript.',
          );
          return;
        }
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
      rec.start();
      setRecording(true);
    } catch {
      setError('Microphone access is unavailable. You can type a transcript or use the sample.');
    }
  }
  async function sample() {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('demo', 'true');
      const r = await api<{ text: string }>('transcribe', 'POST', form);
      setTranscript(r.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load sample.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="voice-panel">
      <span className="mode-pill">
        {real ? 'Voice transcription connected' : 'Demo voice · sample transcript available'}
      </span>
      <div className={'waveform ' + (recording ? 'recording' : '')}>
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
        disabled={busy}
        onClick={() => (recording ? recorder.current?.stop() : start())}
      >
        {recording ? <Square size={21} /> : <Mic size={24} />}
      </button>
      <p>
        {recording
          ? 'Listening. Take your time.'
          : busy
            ? 'Turning sound into words…'
            : 'Press to record. No perfect sentences needed.'}
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
          onClick={() => onCapture(transcript)}
        >
          Sort my words
          <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
}

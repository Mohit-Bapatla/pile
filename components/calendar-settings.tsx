'use client';
import { useEffect, useState } from 'react';
import type { Preferences } from '@/lib/preferences';
const googleConnectPath = '/api/oauth/connect';
export const commonZones = [
  'America/Chicago',
  'America/New_York',
  'America/Los_Angeles',
  'America/Denver',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];
export function CalendarSettings({
  config,
  preferences,
  onChange,
}: {
  config: {
    googleConnected: boolean;
    googleConfigured: boolean;
    elevenlabs: string;
    backboard: string;
    persistence: string;
  };
  preferences: Preferences;
  onChange: () => Promise<unknown>;
}) {
  const [zone, setZone] = useState(preferences.timezone || 'America/Chicago');
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (config.googleConnected)
      fetch('/api/google/calendars')
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setCalendars(d);
        })
        .catch((e) => setError(e.message));
  }, [config.googleConnected]);
  async function save(patch: Preferences) {
    setError('');
    try {
      const response = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error);
        return;
      }
      await onChange();
    } catch {
      setError('Could not save your settings. Check the connection and try again.');
    }
  }
  return (
    <section className="content-panel settings-panel">
      <h2>Time & Calendar</h2>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <form
        className="timezone-form"
        onSubmit={(e) => {
          e.preventDefault();
          save({ timezone: zone, timezoneDetected: false });
        }}
      >
        <label className="field-label">
          Timezone
          <input
            aria-label="Timezone"
            list="pile-timezones"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </label>
        <datalist id="pile-timezones">
          {commonZones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="subtle">
          {preferences.timezoneDetected ? 'Detected from this device' : 'Your selected timezone'} ·
          all-day dates stay put.
        </p>
        <button className="small-button">Save timezone</button>
      </form>
      <div className="setting-row">
        <div>
          <h3>Google Calendar</h3>
          <p>
            {config.googleConnected
              ? 'Connected'
              : config.googleConfigured
                ? 'Ready to connect'
                : 'Not configured'}
          </p>
        </div>
        {config.googleConfigured && (
          <a className="small-button" href={googleConnectPath}>
            {config.googleConnected ? 'Reconnect' : 'Connect'}
          </a>
        )}
      </div>
      {config.googleConnected && (
        <>
          <label className="field-label">
            Selected calendar
            <select
              aria-label="Selected calendar"
              value={preferences.calendarId || 'primary'}
              onChange={(e) => save({ calendarId: e.target.value })}
            >
              <option value="primary">Primary calendar</option>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={async () => {
              const r = await fetch('/api/google/connection', { method: 'DELETE' });
              if (!r.ok) {
                setError('Could not disconnect.');
                return;
              }
              await onChange();
            }}
          >
            Disconnect Google Calendar
          </button>
        </>
      )}
      <div className="setting-row">
        <div>
          <h3>Apple Calendar</h3>
          <p>Add Pile events through Apple Calendar files.</p>
        </div>
        <span className="mode-pill">Available</span>
      </div>
      <h2 className="integrations-heading">Integrations</h2>
      {[
        ['ElevenLabs', 'Speech-to-text', config.elevenlabs],
        ['Backboard', 'Memory search', config.backboard],
        ['Persistence', 'Your saved pile', config.persistence],
      ].map(([name, description, status]) => (
        <div className="setting-row" key={name}>
          <div>
            <h3>{name}</h3>
            <p>{description}</p>
          </div>
          <span className="integration-status">{status}</span>
        </div>
      ))}
    </section>
  );
}
export async function downloadCalendar(ids: string[]) {
  const response = await fetch('/api/calendar-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error((await response.json()).error || 'Could not export calendar.');
  const blob = await response.blob(),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download =
    response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ||
    'Pile-events.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

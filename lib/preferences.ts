import type { DB } from './db';
export type Preferences = {
  timezone?: string;
  timezoneDetected?: boolean;
  calendarId?: string;
  calendarName?: string;
};
export async function preferences(db: DB, user: string): Promise<Preferences> {
  return (
    (
      await db.query<{ body: Preferences }>('SELECT body FROM user_preferences WHERE user_id=$1', [
        user,
      ])
    ).rows[0]?.body || {}
  );
}
export async function savePreferences(db: DB, user: string, patch: Preferences) {
  await db.query(
    'INSERT INTO user_preferences(user_id,body) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET body=user_preferences.body || excluded.body',
    [user, JSON.stringify(patch)],
  );
  return preferences(db, user);
}

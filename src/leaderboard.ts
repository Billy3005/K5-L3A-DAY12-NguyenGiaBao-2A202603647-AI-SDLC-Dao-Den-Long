// Ticket-04 §3 local leaderboard rules, shared by the browser client and dist/server.js.
export interface Entry { name: string; score: number; nights_won: number; achieved_at: string; seed: number }

export const MAX_ENTRIES = 10;
// [A-Za-z0-9_] + Vietnamese letters (bonus): Latin-1/Latin Ext-A/B letters used by Vietnamese + U+1EA0–U+1EF9
const NAME_RE = /^[A-Za-z0-9_ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1EA0-\u1EF9]{3,12}$/u;

/** Returns the NFC-normalised name if valid (3–12 characters), else null. */
export function validateName(raw: string): string | null {
  const n = raw.normalize('NFC');
  return NAME_RE.test(n) ? n : null;
}

/** Score desc; equal score -> earlier achieved_at first; stable otherwise. */
export function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
}

export function insertEntry(list: Entry[], e: Entry): Entry[] {
  return sortEntries([...list, e]).slice(0, MAX_ENTRIES);
}

/** ISO 8601 in local time with offset, e.g. 2026-11-20T16:30:05+07:00. */
export function isoLocal(d: Date): string {
  const p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${off >= 0 ? '+' : '-'}${p(off / 60)}:${p(off % 60)}`;
}

/** Validate an untrusted entry (server POST / stored file). */
export function parseEntry(x: unknown): Entry | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const name = typeof o.name === 'string' ? validateName(o.name) : null;
  const ok = name !== null && Number.isInteger(o.score) && (o.score as number) >= 0
    && Number.isInteger(o.nights_won) && (o.nights_won as number) >= 0 && (o.nights_won as number) <= 3
    && typeof o.achieved_at === 'string' && /[+-]\d\d:\d\d$|Z$/.test(o.achieved_at) && !Number.isNaN(Date.parse(o.achieved_at))
    && Number.isInteger(o.seed);
  return ok ? { name, score: o.score as number, nights_won: o.nights_won as number, achieved_at: o.achieved_at as string, seed: o.seed as number } : null;
}

/** The config editor's form: values of the keys the server describes, their checks and diffs. */
import type { components } from './api/schema';

export type ConfigField = components['schemas']['ConfigField'];
export type FormValue = boolean | number | string | string[];
export type FormValues = Record<string, FormValue>;

/** A deep copy of a JSON value. (`structuredClone` throws on the reactive proxies the pages hold.) */
export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** The default as the schema reports it (typed loosely by the OpenAPI document). */
export function defaultOf(f: ConfigField): FormValue {
  return f.default as unknown as FormValue;
}

/** What a key has in the file now: its value, or the default when the file leaves it out. */
export function effectiveValues(fields: readonly ConfigField[], fileValues: Record<string, unknown>): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const v = fileValues[f.path];
    out[f.path] = v === undefined || v === null ? clone(defaultOf(f)) : (clone(v) as FormValue);
  }
  return out;
}

function same(a: FormValue | undefined, b: FormValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

/** The keys the user changed: `path -> new value`. Keys equal to what the file already has are left out. */
export function changedValues(fields: readonly ConfigField[], original: FormValues, current: FormValues): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const now = current[f.path];
    if (now !== undefined && !same(original[f.path], now)) out[f.path] = now;
  }
  return out;
}

/** One line per entry, blanks dropped. */
export function listFromText(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

export function listToText(list: readonly string[]): string {
  return list.join('\n');
}

/** The first problem with a value, mirroring the server's checks (which decide in the end). */
export function validateField(f: ConfigField, v: FormValue | undefined): string | null {
  if (v === undefined) return null;
  switch (f.kind) {
    case 'bool':
      return typeof v === 'boolean' ? null : `${f.label}: true or false.`;
    case 'int': {
      if (typeof v !== 'number' || !Number.isInteger(v)) return `${f.label}: a whole number.`;
      const lo = f.min ?? Number.MIN_SAFE_INTEGER;
      const hi = f.max ?? Number.MAX_SAFE_INTEGER;
      return v >= lo && v <= hi ? null : `${f.label}: between ${lo} and ${hi}.`;
    }
    case 'text': {
      if (typeof v !== 'string') return `${f.label}: text.`;
      if (f.max_len !== undefined && f.max_len !== null && [...v].length > f.max_len) return `${f.label}: at most ${f.max_len} characters.`;
      // eslint-disable-next-line no-control-regex
      const bad = f.multiline ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
      return bad.test(v) ? `${f.label}: no control characters.` : null;
    }
    case 'choice':
      return typeof v === 'string' && f.options.includes(v) ? null : `${f.label}: one of ${f.options.join(', ')}.`;
    case 'list':
      if (!Array.isArray(v)) return `${f.label}: a list.`;
      return v.length > 100 || v.some((x) => x.length > 256) ? `${f.label}: at most 100 entries of 256 characters.` : null;
    default:
      return null;
  }
}

/** Problems by path for every changed value. */
export function fieldErrors(fields: readonly ConfigField[], values: FormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const e = validateField(f, values[f.path]);
    if (e) out[f.path] = e;
  }
  return out;
}

const SECTION_TITLES: Record<string, string> = {
  server: 'Server',
  gateway: 'Realm',
  network: 'Network',
  accounts: 'Accounts',
  security: 'Security',
  instance: 'Instances',
  web: 'Web API and admin',
  metrics: 'Metrics',
  scheduler: 'Scheduler',
  commands: 'Chat commands',
  logging: 'Logging',
};

export function sectionTitle(section: string): string {
  return SECTION_TITLES[section] ?? section;
}

export interface FieldGroup {
  section: string;
  title: string;
  fields: ConfigField[];
}

/** The fields grouped by section, in the order the server lists them. */
export function groupFields(fields: readonly ConfigField[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const f of fields) {
    let g = groups.find((x) => x.section === f.section);
    if (!g) {
      g = { section: f.section, title: sectionTitle(f.section), fields: [] };
      groups.push(g);
    }
    g.fields.push(f);
  }
  return groups;
}

/** A line for the error list: "line 12, column 5: message". */
export function problemText(p: { message: string; line?: number | null; column?: number | null }): string {
  if (p.line && p.column) return `line ${p.line}, column ${p.column}: ${p.message}`;
  if (p.line) return `line ${p.line}: ${p.message}`;
  return p.message;
}

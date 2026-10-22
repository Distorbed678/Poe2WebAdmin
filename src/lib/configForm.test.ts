import { describe, expect, it } from 'vitest';
import {
  type ConfigField,
  changedValues,
  clone,
  defaultOf,
  effectiveValues,
  fieldErrors,
  groupFields,
  listFromText,
  listToText,
  problemText,
  validateField,
} from './configForm';

function field(over: Partial<ConfigField> & { path: string; kind: string }): ConfigField {
  const [section = '', key = ''] = over.path.split('.');
  return {
    section,
    key,
    label: key,
    help: '',
    multiline: false,
    options: [],
    restart: true,
    default: false as never,
    ...over,
  } as ConfigField;
}

const FIELDS = [
  field({ path: 'web.log_buffer', kind: 'int', min: 10, max: 1000, default: 2000 as never }),
  field({ path: 'web.enabled', kind: 'bool', default: true as never }),
  field({ path: 'server.motd', kind: 'text', max_len: 10, multiline: true, default: '' as never }),
  field({ path: 'server.restart_mode', kind: 'choice', options: ['exec', 'exit'], default: 'exec' as never }),
  field({ path: 'web.cors_origins', kind: 'list', default: [] as never }),
];

describe('values', () => {
  it('uses the default where the file has no value', () => {
    const v = effectiveValues(FIELDS, { 'web.log_buffer': 500 });
    expect(v).toEqual({ 'web.log_buffer': 500, 'web.enabled': true, 'server.motd': '', 'server.restart_mode': 'exec', 'web.cors_origins': [] });
    // Mutating a value does not touch the schema's default.
    (v['web.cors_origins'] as string[]).push('x');
    expect(defaultOf(FIELDS[4]!)).toEqual([]);
  });

  it('copies values that sit behind reactive proxies', () => {
    // structuredClone throws on a Proxy (what a $state object is); the JSON copy does not.
    const proxy = new Proxy({ a: [1, 2], b: 'x' }, {});
    expect(() => structuredClone(proxy)).toThrow();
    expect(clone(proxy)).toEqual({ a: [1, 2], b: 'x' });
    const fromProxy = effectiveValues(FIELDS, new Proxy({ 'web.cors_origins': new Proxy(['http://a'], {}) }, {}));
    expect(fromProxy['web.cors_origins']).toEqual(['http://a']);
    expect(fromProxy['web.log_buffer']).toBe(2000);
  });

  it('reports only what changed against the file', () => {
    const original = effectiveValues(FIELDS, { 'web.log_buffer': 500 });
    const current = { ...original, 'web.log_buffer': 600, 'web.cors_origins': ['http://a'], 'server.motd': '' };
    expect(changedValues(FIELDS, original, current)).toEqual({ 'web.log_buffer': 600, 'web.cors_origins': ['http://a'] });
    expect(changedValues(FIELDS, original, original)).toEqual({});
    // Lists compare by content.
    expect(changedValues(FIELDS, { 'web.cors_origins': ['a', 'b'] }, { 'web.cors_origins': ['a', 'b'] })).toEqual({});
    expect(changedValues(FIELDS, { 'web.cors_origins': ['a', 'b'] }, { 'web.cors_origins': ['b', 'a'] })).toEqual({ 'web.cors_origins': ['b', 'a'] });
  });

  it('converts list text', () => {
    expect(listFromText(' http://a \n\n http://b\n')).toEqual(['http://a', 'http://b']);
    expect(listFromText('')).toEqual([]);
    expect(listToText(['a', 'b'])).toBe('a\nb');
  });
});

describe('validateField', () => {
  const by = (path: string) => FIELDS.find((f) => f.path === path)!;
  it('checks numbers against their bounds', () => {
    expect(validateField(by('web.log_buffer'), 100)).toBeNull();
    expect(validateField(by('web.log_buffer'), 9)).toContain('between 10 and 1000');
    expect(validateField(by('web.log_buffer'), 1001)).toContain('between');
    expect(validateField(by('web.log_buffer'), 12.5)).toContain('whole number');
    expect(validateField(by('web.log_buffer'), 'x' as never)).toContain('whole number');
  });

  it('checks text length and characters', () => {
    expect(validateField(by('server.motd'), 'a\nb')).toBeNull();
    expect(validateField(by('server.motd'), 'x'.repeat(11))).toContain('at most 10');
    expect(validateField(by('server.motd'), 'bell\u0007')).toContain('control');
    // A single-line field refuses line breaks; counts characters, not bytes.
    const one = field({ path: 'gateway.display_name', kind: 'text', max_len: 3, default: '' as never });
    expect(validateField(one, 'a\nb')).toContain('control');
    expect(validateField(one, 'äöü')).toBeNull();
  });

  it('checks choices, booleans and lists', () => {
    expect(validateField(by('server.restart_mode'), 'exit')).toBeNull();
    expect(validateField(by('server.restart_mode'), 'reboot')).toContain('exec, exit');
    expect(validateField(by('web.enabled'), true)).toBeNull();
    expect(validateField(by('web.enabled'), 1 as never)).toBeTruthy();
    expect(validateField(by('web.cors_origins'), ['a'])).toBeNull();
    expect(validateField(by('web.cors_origins'), Array(101).fill('a'))).toBeTruthy();
    expect(validateField(by('web.cors_origins'), 'a' as never)).toBeTruthy();
    expect(validateField(by('web.cors_origins'), undefined)).toBeNull();
  });

  it('collects errors by path', () => {
    const e = fieldErrors(FIELDS, { 'web.log_buffer': 5, 'web.enabled': true, 'server.motd': 'ok' });
    expect(Object.keys(e)).toEqual(['web.log_buffer']);
  });
});

describe('layout', () => {
  it('groups by section in order', () => {
    const g = groupFields(FIELDS);
    expect(g.map((x) => [x.section, x.title, x.fields.length])).toEqual([
      ['web', 'Web API and admin', 3],
      ['server', 'Server', 2],
    ]);
  });

  it('writes a problem with its place', () => {
    expect(problemText({ message: 'bad', line: 12, column: 5 })).toBe('line 12, column 5: bad');
    expect(problemText({ message: 'bad', line: 3 })).toBe('line 3: bad');
    expect(problemText({ message: 'bad' })).toBe('bad');
  });
});

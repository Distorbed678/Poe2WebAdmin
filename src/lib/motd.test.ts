import { describe, expect, it } from 'vitest';
import { MOTD_MAX, motdProblem } from './motd';

describe('motdProblem', () => {
  it('accepts plain text with line breaks, up to the limit', () => {
    expect(motdProblem('')).toBeNull();
    expect(motdProblem('Welcome!\nSee you at 18:00.')).toBeNull();
    expect(motdProblem('a\r\nb')).toBeNull();
    expect(motdProblem('x'.repeat(MOTD_MAX))).toBeNull();
    expect(motdProblem(`  ${'x'.repeat(MOTD_MAX)}  `)).toBeNull();
  });

  it('counts characters, not bytes or code units', () => {
    expect(motdProblem('é'.repeat(MOTD_MAX))).toBeNull();
    expect(motdProblem('😀'.repeat(MOTD_MAX))).toBeNull();
    expect(motdProblem('😀'.repeat(MOTD_MAX + 1))).toContain('at most 280');
  });

  it('refuses control characters', () => {
    expect(motdProblem('bell\u0007')).toContain('control');
    expect(motdProblem('tab\there')).toContain('control');
    expect(motdProblem('nul\u0000')).toContain('control');
  });
});

/**
 * Voxta Macros Tests
 */

import { describe, it, expect } from 'vitest';
import { voxtaToStandard, standardToVoxta } from './macros.js';

describe('voxtaToStandard', () => {
  it('should convert {{ user }} to {{user}}', () => {
    expect(voxtaToStandard('Hello {{ user }}!')).toBe('Hello {{user}}!');
  });

  it('should convert {{ char }} to {{char}}', () => {
    expect(voxtaToStandard('I am {{ char }}.')).toBe('I am {{char}}.');
  });

  it('should handle multiple macros', () => {
    const input = '{{ user }} talks to {{ char }} about {{ user }}.';
    const expected = '{{user}} talks to {{char}} about {{user}}.';
    expect(voxtaToStandard(input)).toBe(expected);
  });

  it('should handle mixed spacing', () => {
    expect(voxtaToStandard('{{user}} and {{ user }}')).toBe('{{user}} and {{user}}');
  });

  it('should preserve already-standard macros', () => {
    expect(voxtaToStandard('{{user}} and {{char}}')).toBe('{{user}} and {{char}}');
  });

  it('should handle empty string', () => {
    expect(voxtaToStandard('')).toBe('');
  });

  it('should handle text without macros', () => {
    expect(voxtaToStandard('Hello world!')).toBe('Hello world!');
  });
});

describe('standardToVoxta', () => {
  it('should convert {{user}} to {{ user }}', () => {
    expect(standardToVoxta('Hello {{user}}!')).toBe('Hello {{ user }}!');
  });

  it('should convert {{char}} to {{ char }}', () => {
    expect(standardToVoxta('I am {{char}}.')).toBe('I am {{ char }}.');
  });

  it('should handle multiple macros', () => {
    const input = '{{user}} talks to {{char}} about {{user}}.';
    const expected = '{{ user }} talks to {{ char }} about {{ user }}.';
    expect(standardToVoxta(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    expect(standardToVoxta('')).toBe('');
  });
});

describe('round-trip', () => {
  it('should preserve content through round-trip (standard -> voxta -> standard)', () => {
    const original = 'Hello {{user}}, I am {{char}}.';
    const voxta = standardToVoxta(original);
    const back = voxtaToStandard(voxta);
    expect(back).toBe(original);
  });

  it('should normalize Voxta format through round-trip', () => {
    const original = 'Hello {{ user }}, I am {{ char }}.';
    const standard = voxtaToStandard(original);
    const voxta = standardToVoxta(standard);
    expect(voxta).toBe(original);
  });
});

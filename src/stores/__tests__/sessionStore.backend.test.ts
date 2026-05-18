import { describe, it, expect } from 'vitest';
import { normalizeSessionBackend } from '../sessionStore';

describe('session backend migration', () => {
  it('defaults missing backend to claude', () => {
    expect(normalizeSessionBackend({ id: 'x' } as any).backend).toBe('claude');
  });
  it('preserves explicit codex backend', () => {
    expect(normalizeSessionBackend({ id: 'x', backend: 'codex' } as any).backend).toBe('codex');
  });
});

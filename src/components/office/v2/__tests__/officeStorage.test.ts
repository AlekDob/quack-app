import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OfficeLayout } from '../officeTypes';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Dynamic import AFTER mocks are installed
const { readOfficeLayout, writeOfficeLayout } = await import('../officeStorage');

beforeEach(() => {
  mockInvoke.mockReset();
});

const sampleLayout: OfficeLayout = {
  version: 1,
  zones: [],
  rooms: [],
  tags: [],
  activeTagIds: [],
  breakRoom: { x: 0, y: 0 },
};

describe('readOfficeLayout', () => {
  it('returns null when the file does not exist', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.reject(new Error('ENOENT'));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toBeNull();
  });

  it('parses a valid version-1 layout', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve(JSON.stringify(sampleLayout));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toEqual(sampleLayout);
  });

  it('returns null and renames corrupt file', async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      calls.push({ cmd, args });
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve('{{ not json }}');
      if (cmd === 'rename_file') return Promise.resolve();
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toBeNull();
    expect(calls.some(c => c.cmd === 'rename_file')).toBe(true);
  });
});

describe('writeOfficeLayout', () => {
  it('writes JSON to the expected path', async () => {
    const writes: unknown[] = [];
    mockInvoke.mockImplementation((cmd: string, args: unknown) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'write_file_content') {
        writes.push(args);
        return Promise.resolve();
      }
      throw new Error('unexpected cmd: ' + cmd);
    });

    await writeOfficeLayout(sampleLayout);
    expect(writes).toHaveLength(1);
    const call = writes[0] as { path: string; content: string };
    expect(call.path).toBe('/Users/alek/.quack/office-layout.json');
    expect(JSON.parse(call.content)).toEqual(sampleLayout);
  });
});

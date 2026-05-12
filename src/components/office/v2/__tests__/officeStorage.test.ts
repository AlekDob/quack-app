import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OfficeLayout } from '../officeTypes';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const { readOfficeLayout, writeOfficeLayout } = await import('../officeStorage');

beforeEach(() => {
  mockInvoke.mockReset();
});

const sampleLayout: OfficeLayout = {
  version: 2,
  rooms: [],
  tags: [],
  activeTagIds: [],
  customGroups: [],
  postIts: [],
  stickers: [],
  texts: [],
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

  it('parses a valid v2 layout', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve(JSON.stringify(sampleLayout));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).toEqual(sampleLayout);
  });

  it('migrates a v1 layout on read, dropping zones and breakRoom', async () => {
    const v1 = {
      version: 1,
      zones: [{ id: 'z', label: 'Z', color: '#fff', x: 0, y: 0, w: 10, h: 10 }],
      rooms: [{ projectPath: '/a', x: 1, y: 2, tagIds: ['personal'], zoneId: 'z' }],
      tags: [{ id: 'personal', label: 'Personal', color: '#c084fc', source: 'auto' }],
      activeTagIds: [],
      breakRoom: { x: 0, y: 0 },
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_home_directory') return Promise.resolve('/Users/alek');
      if (cmd === 'read_file_content') return Promise.resolve(JSON.stringify(v1));
      throw new Error('unexpected cmd: ' + cmd);
    });

    const result = await readOfficeLayout();
    expect(result).not.toBeNull();
    expect(result!.version).toBe(2);
    expect(result!.rooms[0].projectPath).toBe('/a');
    expect((result as unknown as Record<string, unknown>).zones).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).breakRoom).toBeUndefined();
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

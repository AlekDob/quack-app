import { invoke } from '@tauri-apps/api/core';
import { normalizeToForwardSlash } from '../../../utils/platform';
import { LAYOUT_FILE_NAME } from './officeConstants';
import { normaliseLayout } from './officeMigration';
import type { OfficeLayout } from './officeTypes';

async function resolveLayoutPath(): Promise<string> {
  const home = await invoke<string>('get_home_directory');
  return normalizeToForwardSlash(`${home}/.quack/${LAYOUT_FILE_NAME}`);
}

async function quarantineCorruptFile(path: string): Promise<void> {
  const corruptPath = path.replace(
    /\.json$/,
    `.corrupt-${new Date().toISOString().slice(0, 10)}.json`,
  );
  try {
    await invoke('rename_file', { from: path, to: corruptPath });
  } catch {
    /* swallow */
  }
}

export async function readOfficeLayout(): Promise<OfficeLayout | null> {
  const path = await resolveLayoutPath();
  let raw: string;
  try {
    raw = await invoke<string>('read_file_content', { path });
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return normaliseLayout(parsed);
  } catch {
    await quarantineCorruptFile(path);
    return null;
  }
}

export async function writeOfficeLayout(layout: OfficeLayout): Promise<void> {
  const path = await resolveLayoutPath();
  const content = JSON.stringify(layout, null, 2);
  await invoke('write_file_content', { path, content });
}

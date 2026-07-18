import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, type Settings } from './types';

const STORAGE_KEY = 'moodleloader:settings';

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEY]: settings });
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    const value = changes[STORAGE_KEY].newValue as Partial<Settings> | undefined;
    callback({ ...DEFAULT_SETTINGS, ...value });
  });
}

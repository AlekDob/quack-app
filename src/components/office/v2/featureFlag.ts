// src/components/office/v2/featureFlag.ts
const LEGACY_LOCAL_STORAGE_KEY = 'quack:forceOfficeV1';

export function isOfficeV2Enabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY) !== 'true';
}

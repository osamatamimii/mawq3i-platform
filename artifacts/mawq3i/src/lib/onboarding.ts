import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'mawq3i_onboarding_seen_v1';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function hasSeenOnboarding(): Promise<boolean> {
  if (!isNativeApp()) return true; // onboarding is native-app-only
  const { value } = await Preferences.get({ key: KEY });
  return value === '1';
}

export async function markOnboardingSeen(): Promise<void> {
  if (!isNativeApp()) return;
  await Preferences.set({ key: KEY, value: '1' });
}

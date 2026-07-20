// Registers the device for push notifications when running inside the
// native iOS/Android app (Capacitor). No-ops silently in a normal browser
// tab, so this is always safe to call from the web dashboard too.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { adminRest } from './supabase';

let didInit = false;

export async function initPushNotifications(storeId: string, userId?: string) {
  if (!Capacitor.isNativePlatform()) return; // web tab — nothing to do
  if (didInit) return;
  didInit = true;

  const platform = Capacitor.getPlatform(); // 'ios' | 'android'

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    await adminRest.insert(
      'device_tokens',
      {
        store_id: storeId,
        user_id: userId || null,
        token: token.value,
        platform,
        device_name: navigator.userAgent?.slice(0, 120) || null,
      },
      storeId,
    );
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration failed', err);
  });

  // Foreground notification (order arrives while app is open) — the OS
  // handles background/killed-state notifications automatically.
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push received in foreground', notification);
  });

  // Tapping a notification (e.g. app was in background) — route to Orders.
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data as { type?: string } | undefined;
    if (data?.type === 'new_order') {
      window.location.href = '/dashboard/orders';
    }
  });
}

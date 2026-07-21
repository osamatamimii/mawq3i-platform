// Registers the device for push notifications when running inside the
// native iOS/Android app (Capacitor). No-ops silently in a normal browser
// tab, so this is always safe to call from the web dashboard too.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { adminRest } from './supabase';

export async function requestNotificationPermissionEarly(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  let status = await PushNotifications.checkPermissions();
  if (status.receive === 'prompt') {
    status = await PushNotifications.requestPermissions();
  }
  // Android: create the branded channel merchants will see in system
  // notification settings ("طلبات جديدة") — high importance so order
  // alerts show as a heads-up banner with sound, like Shopify/Stripe.
  // No-ops safely on iOS (channels are an Android-only concept).
  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: 'orders',
        name: 'طلبات جديدة',
        description: 'إشعار فوري عند وصول طلب جديد',
        importance: 5, // IMPORTANCE_HIGH — heads-up + sound
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#3B6D11',
      });
    } catch {
      // channel already exists or platform doesn't support it — ignore
    }
  }
  return status.receive === 'granted';
}

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

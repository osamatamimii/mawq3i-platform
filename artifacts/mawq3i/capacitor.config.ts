import type { CapacitorConfig } from '@capacitor/cli';

// Mawq3i merchant app — wraps the LIVE dashboard (mawq3i.co) instead of a bundled build.
// This means every deploy to mawq3i.co (Vercel push) updates the app instantly for all
// merchants, with NO app store resubmission needed — same as the web platform.
// App store review is only required when native code/permissions/icons change.
const config: CapacitorConfig = {
  appId: 'co.mawq3i.app',
  appName: 'موقعي',
  webDir: 'dist', // fallback bundle only used if server.url is unreachable (offline splash)
  server: {
    url: 'https://mawq3i.co',
    cleartext: false,
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#3B6D11',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#3B6D11',
    },
  },
};

export default config;

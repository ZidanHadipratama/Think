import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.think.app',
  appName: 'Think',
  webDir: 'out',
  plugins: {
    Keyboard: {
      resize: 'body',
    },
    StatusBar: {
      style: 'dark',
    },
  },
  /**
   * LIVE RELOAD CONFIGURATION (DEV ONLY)
   * 1. Find your computer's local IP (e.g., 192.168.1.5)
   * 2. Run 'npm run dev' on your computer
   * 3. Uncomment the block below and set the URL
   * 4. Run 'npx cap sync android'
   * 5. Run the app on your phone
   */
  // server: {
  //   url: 'http://192.168.1.21:3000',
  //   cleartext: true
  // },
};

export default config;

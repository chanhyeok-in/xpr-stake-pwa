import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// IMPORTANT: Add your Firebase project configuration to your .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const getFCMToken = async () => {
  const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY; // This is the VAPID key from Firebase Cloud Messaging settings
  if (!VAPID_KEY) {
    console.error('VITE_FIREBASE_VAPID_KEY is not set in your environment variables.');
    throw new Error('Firebase VAPID key is not configured.');
  }
  try {
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      return currentToken;
    } else {
      // This means the user has not granted notification permission yet.
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    throw err;
  }
};

// Handle foreground messages (when the app is active)
onMessage(messaging, (payload) => {
  console.log('Foreground message received. ', payload);
  // You can display a custom notification here if you want
});

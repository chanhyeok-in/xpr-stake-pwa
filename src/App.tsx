import { useState, useEffect } from 'react';
import ProtonWebSDK from '@proton/web-sdk';
import { Button, Container, Typography, Box, CircularProgress, Alert } from '@mui/material';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  // Check for existing push subscription on component mount
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setIsSubscribed(true);
          }
          setIsSubscriptionLoading(false);
        });
      });
    }
  }, []);

  // Restore user session from localStorage
  useEffect(() => {
    const savedSession = localStorage.getItem('proton-session');
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        console.error('Could not parse saved session:', e);
        localStorage.removeItem('proton-session');
      }
    }
  }, []);

  const handleLogin = async () => {
    try {
      const { session } = await ProtonWebSDK({
        linkOptions: { endpoints: ['https://proton.greymass.com'] },
        transportOptions: { requestStatus: false },
        selectorOptions: {
          appName: 'XPR Stake Notifier',
          appLogo: 'https://avatars.githubusercontent.com/u/6749354?s=200&v=4',
        },
      });
      setSession(session);
      localStorage.setItem('proton-session', JSON.stringify(session));
    } catch (e) {
      console.error('Login error:', e);
      setError('Failed to login.');
    }
  };

  const handleLogout = async () => {
    if (session && typeof session.logout === 'function') {
      await session.logout();
    }
    localStorage.removeItem('proton-session');
    setSession(null);
    setStatus(null);
  };

  const subscribeToPush = async () => {
    if (!session) {
      setError('Please login first to subscribe.');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key is not configured. Cannot subscribe.');
      console.error('VITE_VAPID_PUBLIC_KEY is not set in your environment variables.');
      return;
    }

    setIsSubscriptionLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, xprAccount: session.auth.actor }),
      });

      setIsSubscribed(true);
      setStatus('Successfully subscribed to notifications.');
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('Failed to subscribe to notifications. Please ensure you have granted permission.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsSubscriptionLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setStatus('Successfully unsubscribed from notifications.');
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError('Failed to unsubscribe. Please try again.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" style={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h4" gutterBottom>
        XPR Stake Notifier
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {status && <Alert severity="success" onClose={() => setStatus(null)}>{status}</Alert>}

      {!session ? (
        <Button variant="contained" color="primary" onClick={handleLogin} style={{ marginTop: '20px' }}>
          Login with WebAuth
        </Button>
      ) : (
        <Box>
          <Typography variant="h6">Welcome, {session.auth.actor}</Typography>
          <Button variant="contained" color="secondary" onClick={handleLogout} style={{ marginTop: '10px' }}>
            Logout
          </Button>
          <Box mt={4}>
            <Button 
              variant="contained" 
              onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush} 
              disabled={isSubscriptionLoading}
              style={{ marginTop: '20px' }}
            >
              {isSubscriptionLoading ? <CircularProgress size={24} /> : (isSubscribed ? 'Unsubscribe from Notifications' : 'Subscribe to Notifications')}
            </Button>
            <Typography variant="body2" style={{ marginTop: '15px'}}>
              {isSubscribed ? 
                'You are subscribed to claim reminders.' : 
                'Subscribe to receive a notification when your XPR stake rewards are ready to claim.'
              }
            </Typography>
          </Box>
        </Box>
      )}
    </Container>
  );
}

export default App;

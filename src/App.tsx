// Trigger new build to clear Vercel cache
import { useState, useEffect } from 'react';
import ProtonWebSDK from '@proton/web-sdk';
import { Button, Container, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { getFCMToken } from './firebase'; // Import the new FCM token function

function App() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // State to hold the FCM token
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  // Check for existing FCM token on component mount
  useEffect(() => {
    // Storing the token in localStorage to check subscription status without asking Firebase every time.
    const token = localStorage.getItem('fcm_token');
    if (token) {
      setFcmToken(token);
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

    setIsSubscriptionLoading(true);
    setError(null);

    try {
      // 1. Request permission and get FCM token
      const token = await getFCMToken();
      if (!token) {
        throw new Error('Notification permission not granted.');
      }

      // 2. Send the token to the backend
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken: token, xprAccount: session.auth.actor }),
      });

      setFcmToken(token);
      localStorage.setItem('fcm_token', token);
      setStatus('Successfully subscribed to notifications.');
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError('Failed to subscribe. Please ensure you have granted notification permission in your browser settings.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    if (!fcmToken) {
      setError('Not currently subscribed.');
      return;
    }
    setIsSubscriptionLoading(true);
    setError(null);

    try {
      // 1. Send token to backend to remove from DB
      await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken }),
      });
      
      // 2. Clear local token
      setFcmToken(null);
      localStorage.removeItem('fcm_token');
      setStatus('Successfully unsubscribed from notifications.');
      
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError('Failed to unsubscribe. Please try again.');
    } finally {
      setIsSubscriptionLoading(false);
    }
  };

  const isSubscribed = !!fcmToken;

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
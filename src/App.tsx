import { useState, useEffect } from 'react';
import ProtonWebSDK from '@proton/web-sdk';
import { Button, Container, Typography, Box, CircularProgress } from '@mui/material';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  const rpcEndpoint = 'https://rpc.api.mainnet.metalx.com';

  const handleLogin = async () => {
    try {
      const { session } = await ProtonWebSDK({
        linkOptions: {
          endpoints: ['https://proton.greymass.com'],
        },
        transportOptions: {
          requestStatus: false,
        },
        selectorOptions: {
          appName: 'XPR Stake Notifier',
          appLogo: 'https://avatars.githubusercontent.com/u/6749354?s=200&v=4',
        },
      });
      setSession(session);
      requestNotificationPermission();
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const handleLogout = async () => {
    if (session) {
      await session.logout();
      setSession(null);
      setClaimStatus(null);
    }
  };

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const scheduleNotification = async (notificationTime: Date, body: string, icon: string) => {
    if (notificationPermission !== 'granted') return;

    // Wait for the service worker to be ready and controlling the page
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'SCHEDULE_NOTIFICATION',
            payload: {
              notificationTime: notificationTime.getTime(), // Send timestamp
              body: body,
              icon: icon,
            },
          });
          console.log('Message sent to service worker to schedule notification.');
        } else {
          console.warn('Service worker is ready but not active, falling back to main thread (unreliable).');
          const now = new Date().getTime();
          const delay = notificationTime.getTime() - now;
          if (delay > 0) {
            setTimeout(() => {
              new Notification('XPR Stake Reward', { body: body, icon: icon });
            }, delay);
          }
        }
      } catch (error) {
        console.error('Error waiting for service worker ready:', error);
        console.warn('Service worker not ready, scheduling notification in main thread (unreliable).');
        const now = new Date().getTime();
        const delay = notificationTime.getTime() - now;
        if (delay > 0) {
          setTimeout(() => {
            new Notification('XPR Stake Reward', { body: body, icon: icon });
          }, delay);
        }
      }
    } else {
      console.warn('Service worker API not supported, scheduling notification in main thread (unreliable).');
      const now = new Date().getTime();
      const delay = notificationTime.getTime() - now;
      if (delay > 0) {
        setTimeout(() => {
          new Notification('XPR Stake Reward', { body: body, icon: icon });
        }, delay);
      }
    }
  };

  const checkClaimStatus = async () => {
    if (!session) return;
    setLoading(true);
    setClaimStatus('Checking claim status...');

    try {
      const response = await fetch(`${rpcEndpoint}/v1/chain/get_table_rows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: true,
          code: 'eosio',
          scope: 'eosio',
          table: 'votersxpr',
          lower_bound: session.auth.actor,
          upper_bound: session.auth.actor,
          limit: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.rows && data.rows.length > 0) {
        // The `lastclaim` is a number of seconds since epoch. Convert to milliseconds.
        const lastClaimTimestamp = data.rows[0].lastclaim * 1000;
        const nextClaimTime = new Date(lastClaimTimestamp + 24 * 60 * 60 * 1000);
        
        setClaimStatus(`Next claim is available at: ${nextClaimTime.toLocaleString()}`);
        await scheduleNotification(nextClaimTime, 'It\'s time to claim your XPR staking rewards!', '/pwa-192x192.png');
      } else {
        setClaimStatus('No staking information found. You may be able to claim now.');
      }
    } catch (error) {
      console.error("Failed to fetch claim status:", error);
      setClaimStatus('Error fetching claim status.');
    }
    finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (notificationPermission !== 'granted') {
      alert('Please enable notifications first.');
      return;
    }
    console.log('Scheduling a test notification in 10 seconds...');
    const tenSecondsInMs = 10 * 1000;
    const testNotificationTime = new Date(new Date().getTime() + tenSecondsInMs);
    await scheduleNotification(testNotificationTime, 'This is a test notification!', '/pwa-192x192.png');
    alert('Test notification scheduled! You should receive it in 10 seconds.');
  };

  useEffect(() => {
    if (session) {
      checkClaimStatus();
    }
  }, [session]);

  return (
    <Container maxWidth="sm" style={{ textAlign: 'center', marginTop: '50px' }}>
      <Typography variant="h4" gutterBottom>
        XPR Stake Notifier
      </Typography>
      {!session ? (
        <Button variant="contained" color="primary" onClick={handleLogin}>
          Login with WebAuth
        </Button>
      ) : (
        <Box>
          <Typography variant="h6">Welcome, {session.auth.actor}</Typography>
          <Button variant="contained" color="secondary" onClick={handleLogout} style={{ marginTop: '10px' }}>
            Logout
          </Button>
          <Box mt={4}>
            {loading ? (
              <CircularProgress />
            ) : claimStatus ? (
              <Typography variant="body1">
                {claimStatus}
              </Typography>
            ) : (
              <Typography variant="body1">
                Click the button to check your claim status.
              </Typography>
            )}
            <Button onClick={checkClaimStatus} disabled={loading} style={{ marginTop: '20px' }}>
              Check Claim Status
            </Button>
            <Button onClick={handleTestNotification} style={{ marginLeft: '10px', marginTop: '20px' }}>
              Test Notification (10s)
            </Button>
             {notificationPermission !== 'granted' && session && (
                <Button onClick={requestNotificationPermission} style={{marginTop: '20px'}}>
                  Enable Notifications
                </Button>
            )}
          </Box>
        </Box>
      )}
    </Container>
  );
}

export default App;
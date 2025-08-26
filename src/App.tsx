import { useState, useEffect } from 'react';
import ProtonWebSDK from '@proton/web-sdk';
import { Button, Container, Typography, Box, CircularProgress } from '@mui/material';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  const handleLogin = async () => {
    try {
      // The session object contains the auth and transact functionalities
      const { session } = await ProtonWebSDK({
        linkOptions: {
          endpoints: ['https://proton.greymass.com'],
        },
        transportOptions: {
          requestStatus: false, // This will disable the SDK's default success/error modals
        },
        selectorOptions: {
          appName: 'XPR Stake Notifier',
          appLogo: 'https://avatars.githubusercontent.com/u/6749354?s=200&v=4',
        },
      });
      setSession(session); // Store the entire session object
      requestNotificationPermission();
    } catch (e) {
      console.error(e);
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

  const scheduleNotificationIn = (delay: number) => {
    if (notificationPermission !== 'granted' || delay <= 0) return;

    setTimeout(() => {
      new Notification('XPR Stake Reward', {
        body: 'It\'s time to claim your XPR staking rewards!',
        icon: '/pwa-192x192.png',
      });
    }, delay);
  };

  const checkClaimStatusAndSchedule = async () => {
    if (!session) return;
    setLoading(true);
    setClaimStatus('Checking claim status...');

    try {
      // Use the session object directly to transact
      await session.transact({
        actions: [{
          account: 'eosio',
          name: 'voterclaim',
          authorization: [session.auth], // Use auth from the session state
          data: {
            owner: session.auth.actor, // Use actor from the session state
          },
        }],
      });

      setClaimStatus('A claim is available now. Next notification will be in 24 hours.');
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      scheduleNotificationIn(twentyFourHoursInMs);

    } catch (error: any) {
      const errorMessage = error?.message || '';
      const waitTimeMatch = errorMessage.match(/Please wait (\d+) hours (\d+) minutes (\d+) seconds/);

      if (waitTimeMatch) {
        const hours = parseInt(waitTimeMatch[1], 10);
        const minutes = parseInt(waitTimeMatch[2], 10);
        const seconds = parseInt(waitTimeMatch[3], 10);

        const delayInMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
        const notificationTime = new Date(Date.now() + delayInMs);
        const statusMessage = `Next claim is at: ${notificationTime.toLocaleString()}.`;

        setClaimStatus(statusMessage);
        
        // Schedule the future notification
        scheduleNotificationIn(delayInMs);

        // Also, send an immediate notification to confirm scheduling
        if (notificationPermission === 'granted') {
          new Notification('Claim Timer Set', {
            body: `Your next claim is in ${hours}h ${minutes}m. We\'ll notify you then.`, 
            icon: '/pwa-192x192.png',
          });
        }
      } else {
        setClaimStatus('Could not determine claim status. You may be able to claim now.');
        console.error("An unexpected error occurred during claim check:", error);
      }
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      checkClaimStatusAndSchedule();
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
            <Button onClick={checkClaimStatusAndSchedule} disabled={loading} style={{ marginTop: '20px' }}>
              Check Claim Status
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

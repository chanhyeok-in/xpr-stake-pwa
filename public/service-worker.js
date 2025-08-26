self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { notificationTime, body, icon } = event.data.payload;
    const delay = notificationTime - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification('XPR Stake Reward', {
          body: body,
          icon: icon,
        });
      }, delay);
    } else {
      // If delay is 0 or negative, show immediately
      self.registration.showNotification('XPR Stake Reward', {
        body: body,
        icon: icon,
      });
    }
  }
});

// Listener for push events (simulated by DevTools)
self.addEventListener('push', (event) => {
  const title = 'Test Push Notification';
  const options = {
    body: event.data ? event.data.text() : 'This is a test push notification from DevTools.',
    icon: '/pwa-192x192.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
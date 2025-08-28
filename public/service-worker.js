// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { notificationTime, body, icon } = event.data.payload;
    const now = Date.now();
    const delay = notificationTime - now;

    if (delay > 0) {
      setTimeout(() => {
        self.registration.showNotification('XPR Stake Reward', {
          body: body,
          icon: icon,
          badge: icon, // Badge for Android
          data: {
            url: '/', // URL to open when notification is clicked
          },
        });
      }, delay);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open to the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
      return null;
    })
  );
});

// This event is fired when the service worker is activated.
// clients.claim() ensures that the service worker takes control of the page immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

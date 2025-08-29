const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure web-push with VAPID details
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('VAPID Public and Private Keys must be provided.');
}

const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { xprAccount } = req.body;

  if (!xprAccount) {
    return res.status(400).json({ error: 'Missing xprAccount.' });
  }

  try {
    // 1. Fetch the subscription for the given account
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('xpr_account', xprAccount);

    if (fetchError) {
      console.error('Error fetching subscription for test:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch subscription.' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: `No subscription found for account ${xprAccount}.` });
    }

    // 2. Send a test notification to all subscriptions for that account
    const notificationPayload = {
      title: '테스트 알림',
      body: '이 알림은 테스트 목적으로 발송되었습니다.',
      url: '/'
    };

    let notificationsSent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          sub.subscription_data,
          JSON.stringify(notificationPayload)
        );
        notificationsSent++;
      } catch (notificationError) {
        console.error(`Error sending test notification to ${xprAccount}:`, notificationError);
        // Optionally, handle expired subscriptions here as well
      }
    }

    if (notificationsSent > 0) {
        return res.status(200).json({ message: `Test notification sent to ${notificationsSent} device(s) for ${xprAccount}.` });
    } else {
        return res.status(500).json({ error: 'Failed to send test notification.' });
    }

  } catch (e) {
    console.error('Unexpected error in test-push:', e);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
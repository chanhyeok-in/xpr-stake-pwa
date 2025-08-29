import * as webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Move VAPID configuration inside the handler
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: 'VAPID keys are not configured on the server.' });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { xprAccount } = req.body;

  if (!xprAccount) {
    return res.status(400).json({ error: 'Missing xprAccount.' });
  }

  try {
    const subsResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions?select=subscription_data&xpr_account=eq.${xprAccount}`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!subsResponse.ok) {
      const errorData = await subsResponse.json();
      throw new Error(errorData.message || 'Failed to fetch subscription.');
    }
    const subscriptions = await subsResponse.json();

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ error: `No subscription found for account ${xprAccount}.` });
    }

    const notificationPayload = {
      title: '테스트 알림',
      body: '이 알림은 관리자 테스트 목적으로 발송되었습니다.',
      url: '/'
    };

    for (const sub of subscriptions) {
      await webpush.sendNotification(
        sub.subscription_data,
        JSON.stringify(notificationPayload)
      );
    }

    return res.status(200).json({ message: `Test notification sent to ${subscriptions.length} device(s) for ${xprAccount}.` });

  } catch (e) {
    console.error('Unexpected error in test-push:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}
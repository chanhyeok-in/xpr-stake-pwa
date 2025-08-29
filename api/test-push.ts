import { createClient } from '@supabase/supabase-js';
import * as webpush from 'web-push';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { xprAccount } = req.body;

  if (!xprAccount) {
    return res.status(400).json({ error: 'Missing xprAccount.' });
  }

  try {
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
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}
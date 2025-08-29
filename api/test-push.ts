import * as admin from 'firebase-admin';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

let firebaseServiceAccount = null;
if (FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
  try {
    firebaseServiceAccount = JSON.parse(Buffer.from(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8'));
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount),
      });
    }
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or initialize Firebase Admin SDK:', e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin SDK not initialized.' });
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

    const message = {
      token: subscriptions[0].subscription_data.endpoint, // Use endpoint as token for FCM
      notification: {
        title: '테스트 알림',
        body: '이 알림은 관리자 테스트 목적으로 발송되었습니다.',
      },
      webpush: {
        fcm_options: {
          link: 'https://xpr-stake-pwa.vercel.app/' // Deep link for test
        }
      }
    };

    const fcmResponse = await admin.messaging().send(message);

    return res.status(200).json({ message: `Test notification sent successfully to ${xprAccount}. FCM Response: ${fcmResponse}` });

  } catch (e) {
    console.error('Unexpected error in test-push:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}
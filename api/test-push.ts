import { SignJWT } from 'jose';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

let firebaseServiceAccount = null;
if (FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) {
  try {
    firebaseServiceAccount = JSON.parse(Buffer.from(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8'));
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON_BASE64:', e);
  }
}

async function getAccessToken() {
  if (!firebaseServiceAccount) {
    throw new Error('Firebase service account not configured.');
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: firebaseServiceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const privateKeyPem = firebaseServiceAccount.private_key; // This is the PEM string
  const privateKey = await importPKCS8(privateKeyPem, 'RS256'); // Use importPKCS8

  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey); // Pass the KeyObject/CryptoKey directly

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!firebaseServiceAccount) {
    return res.status(500).json({ error: 'Firebase service account not configured.' });
  }

  const { xprAccount } = req.body;

  if (!xprAccount) {
    return res.status(400).json({ error: 'Missing xprAccount.' });
  }

  try {
    const accessToken = await getAccessToken();
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
      token: subscriptions[0].subscription_data.keys.p256dh, // This is not the correct token for FCM
      notification: {
        title: '테스트 알림',
        body: '이 알림은 관리자 테스트 목적으로 발송되었습니다.',
      },
      webpush: {
        fcm_options: {
          link: '/'
        }
      }
    };

    const fcmResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${firebaseServiceAccount.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message: notificationPayload }),
    });

    if (!fcmResponse.ok) {
      const errorText = await fcmResponse.text();
      throw new Error(`FCM send error: ${errorText}`);
    }

    return res.status(200).json({ message: `Test notification sent successfully to ${xprAccount}.` });

  } catch (e) {
    console.error('Unexpected error in test-push:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}
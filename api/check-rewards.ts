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

const PROTON_RPC_ENDPOINT = process.env.PROTON_RPC_ENDPOINT || 'https://rpc.api.mainnet.metalx.com';
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getProtonRewardStatus(xprAccount) {
  try {
    const response = await fetch(`${PROTON_RPC_ENDPOINT}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: true,
        code: 'eosio',
        scope: 'eosio',
        table: 'votersxpr',
        lower_bound: xprAccount,
        upper_bound: xprAccount,
        limit: 1,
      }),
    });
    if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
    const data = await response.json();
    if (data.rows && data.rows.length > 0) {
      const lastClaimTimestampSeconds = data.rows[0].lastclaim;
      const nextClaimTime = new Date((lastClaimTimestampSeconds * 1000) + COOLDOWN_PERIOD_MS);
      return { nextClaimTime };
    }
    return null;
  } catch (error) {
      console.error(`Error fetching Proton reward status for ${xprAccount}:`, error);
      return null;
  }
}

async function deleteSubscription(endpoint) {
    await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?subscription_data->>endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      }
    );
    console.log(`Deleted invalid subscription for endpoint: ${endpoint}`);
}


export default async function handler(req, res) {
  if (!admin.apps.length) {
    return res.status(500).json({ error: 'Firebase Admin SDK not initialized.' });
  }

  try {
    const subsResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions?select=*`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!subsResponse.ok) {
      throw new Error(await subsResponse.text());
    }
    const subscriptions = await subsResponse.json();

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No subscriptions to process.' });
    }

    const notificationPromises = subscriptions.map(async (sub) => {
      try {
        const rewardStatus = await getProtonRewardStatus(sub.xpr_account);
        if (rewardStatus && rewardStatus.nextClaimTime <= new Date()) {
          const message = {
            token: sub.subscription_data, // Use the FCM token directly from the DB
            notification: {
              title: 'XPR 보상 청구 가능!',
              body: '지금 바로 XPR 보상을 청구하세요!',
            },
            webpush: {
              fcm_options: {
                link: 'https://xpr-stake-pwa.vercel.app/claim' // Deep link to claim page
              }
            }
          };

          const fcmResponse = await admin.messaging().send(message);
          console.log(`FCM notification sent to ${sub.xpr_account}:`, fcmResponse);

        }
      } catch (notificationError) {
        console.error(`Error sending notification to ${sub.xpr_account}:`, notificationError);
        // Handle invalid tokens (e.g., delete subscription)
      }
    });

    await Promise.all(notificationPromises);

    return res.status(200).json({ message: 'Reward check and notifications processed.' });

  } catch (e) {
    console.error('Unexpected error in check-rewards:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}



import * as webpush from 'web-push';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const PROTON_RPC_ENDPOINT = process.env.PROTON_RPC_ENDPOINT || 'https://rpc.api.mainnet.metalx.com';
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000;

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
  // Move VAPID configuration inside the handler
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: 'VAPID keys are not configured on the server.' });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

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
          const notificationPayload = JSON.stringify({
            title: 'XPR 보상 청구 가능!',
            body: '지금 바로 XPR 보상을 청구하세요!',
            url: '/'
          });
          await webpush.sendNotification(sub.subscription_data, notificationPayload);
          console.log(`Notification sent to ${sub.xpr_account}`);
        }
      } catch (notificationError) {
        console.error(`Error sending notification to ${sub.xpr_account}:`, notificationError);
        if (notificationError.statusCode === 410 || notificationError.statusCode === 404) {
          await deleteSubscription(sub.subscription_data.endpoint);
        }
      }
    });

    await Promise.all(notificationPromises);

    return res.status(200).json({ message: 'Reward check and notifications processed.' });
  } catch (e) {
    console.error('Unexpected error in check-rewards:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}

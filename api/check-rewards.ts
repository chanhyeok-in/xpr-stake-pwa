import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided as environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure web-push with VAPID details
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error('VAPID Public and Private Keys must be provided as environment variables.');
}

const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com';
webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

// Proton RPC Endpoint
const PROTON_RPC_ENDPOINT = process.env.PROTON_RPC_ENDPOINT || 'https://rpc.api.mainnet.metalx.com';

// Cooldown period in milliseconds (24 hours)
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000;

// Function to get reward status from Proton blockchain
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

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.rows && data.rows.length > 0) {
      const stakerInfo = data.rows[0];
      const lastClaimTimestampSeconds = stakerInfo.lastclaim;
      const lastClaimTime = new Date(lastClaimTimestampSeconds * 1000);
      const nextClaimTime = new Date(lastClaimTime.getTime() + COOLDOWN_PERIOD_MS);
      return { lastClaimTime, nextClaimTime };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Proton reward status for ${xprAccount}:`, error);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions.' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No subscriptions to process.' });
    }

    for (const sub of subscriptions) {
      const { id, xpr_account, subscription_data } = sub;

      try {
        const rewardStatus = await getProtonRewardStatus(xpr_account);
        const now = new Date();

        if (rewardStatus && rewardStatus.nextClaimTime && rewardStatus.nextClaimTime <= now) {
          const notificationPayload = {
            title: 'XPR 보상 청구 가능!',
            body: '지금 바로 XPR 보상을 청구하세요!',
            url: '/'
          };

          await webpush.sendNotification(
            subscription_data,
            JSON.stringify(notificationPayload)
          );
          console.log(`Notification sent to ${xpr_account}`);
        }
      } catch (notificationError) {
        console.error(`Error sending notification to ${xpr_account}:`, notificationError);
        if (notificationError.statusCode === 410 || notificationError.statusCode === 404) {
          console.log(`Subscription for ${xpr_account} is no longer valid. Deleting from DB.`);
          await supabase.from('subscriptions').delete().eq('id', id);
        }
      }
    }

    return res.status(200).json({ message: 'Reward check and notifications processed.' });

  } catch (e) {
    console.error('Unexpected error in check-rewards:', e);
    return res.status(500).json({ error: 'An unexpected error occurred during processing.' });
  }
}

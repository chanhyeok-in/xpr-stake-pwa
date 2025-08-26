// No import for VercelRequest, VercelResponse types as they are not needed at runtime
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
// Removed nodeFetch import and usage
// const nodeFetch = require('node-fetch');
// const fetch = nodeFetch; // In CommonJS, node-fetch's default export is the fetch function itself

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

// Proton RPC Endpoint from user's provided data
const PROTON_RPC_ENDPOINT = process.env.PROTON_RPC_ENDPOINT || 'https://rpc.api.mainnet.metalx.com';

// Cooldown period in milliseconds (24 hours as per App.tsx logic)
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Function to get reward status from Proton blockchain
async function getProtonRewardStatus(xprAccount) { // Removed type annotation for xprAccount
  try {
    // Now using global fetch
    const response = await fetch(`${PROTON_RPC_ENDPOINT}/v1/chain/get_table_rows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
      const stakerInfo = data.rows[0].data; // Access the 'data' object within the row
      const lastClaimTimestampSeconds = stakerInfo.lastclaim; // This is in seconds
      
      // Convert seconds to milliseconds for Date object
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


module.exports = async function handler(req, res) { // Changed to module.exports and removed types
  // For security, you might want to add a secret key check here
  // to ensure only your cron job can trigger it.
  // e.g., if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) { return res.status(401).send('Unauthorized'); }

  try {
    // 1. Fetch all subscriptions from Supabase
    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch subscriptions.' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No subscriptions found.');
      return res.status(200).json({ message: 'No subscriptions to process.' });
    }

    console.log(`Processing ${subscriptions.length} subscriptions.`);

    // 2. Loop through each subscription and check XPR blockchain status
    for (const sub of subscriptions) {
      const { id, xpr_account, subscription_data } = sub;

      try {
        const rewardStatus = await getProtonRewardStatus(xpr_account);
        const now = new Date();

        let notificationPayload = {};
        let shouldSendNotification = false;

        if (rewardStatus && rewardStatus.nextClaimTime) {
          const timeUntilNextClaimMs = rewardStatus.nextClaimTime.getTime() - now.getTime();
          const remainingHours = Math.ceil(timeUntilNextClaimMs / (1000 * 60 * 60));

          if (timeUntilNextClaimMs <= 0) {
            notificationPayload = {
              title: 'XPR 보상 청구 가능!',
              body: '지금 바로 XPR 보상을 청구하세요!',
              url: 'https://xpr-stake-pwa.vercel.app/claim'
            };
            shouldSendNotification = true;
          } else if (remainingHours <= 12 && remainingHours > 0) {
            notificationPayload = {
              title: 'XPR 보상 청구 예정',
              body: `XPR 보상 청구까지 약 ${remainingHours}시간 남았습니다.`, // Use remainingHours
              url: 'https://xpr-stake-pwa.vercel.app/status'
            };
            shouldSendNotification = true;
          }
        } else {
          console.log(`Could not get reward status for ${xpr_account}. Skipping notification.`);
        }

        if (shouldSendNotification) {
          await webpush.sendNotification(
            subscription_data,
            JSON.stringify(notificationPayload)
          );
          console.log(`Notification sent to ${xpr_account}`);
        }

      } catch (notificationError) { // Removed type annotation
        console.error(`Error sending notification to ${xpr_account}:`, notificationError);

        if (notificationError.statusCode === 410 || notificationError.statusCode === 404) {
          console.log(`Subscription for ${xpr_account} is no longer valid. Deleting from DB.`);
          await supabase.from('subscriptions').delete().eq('id', id);
          console.log(`Deleted invalid subscription for ${xpr_account}.`);
        }
      }
    }

    return res.status(200).json({ message: 'Reward check and notifications processed.' });

  } catch (e) {
    console.error('Unexpected error in check-rewards:', e);
    return res.status(500).json({ error: 'An unexpected error occurred during processing.' });
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { fcmToken, xprAccount } = req.body;

  if (!fcmToken || !xprAccount) {
    return res.status(400).json({ error: 'Missing fcmToken or XPR account.' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/subscriptions`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal', // Don't return the inserted data
        },
        body: JSON.stringify({
          xpr_account: xprAccount,
          subscription_data: fcmToken, // Store the FCM token directly
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error saving subscription:', errorData);
      throw new Error(errorData.message || 'Failed to save subscription.');
    }

    return res.status(201).json({ message: 'Subscription saved successfully.' });

  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}

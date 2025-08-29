const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing subscription endpoint.' });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?subscription_data->>endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error deleting subscription:', errorData);
      throw new Error(errorData.message || 'Failed to delete subscription.');
    }

    return res.status(200).json({ message: 'Subscription deleted successfully.' });

  } catch (e) {
    console.error('Unexpected error:', e);
    return res.status(500).json({ error: e.message || 'An unexpected error occurred.' });
  }
}
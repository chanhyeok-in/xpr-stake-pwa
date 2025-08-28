// api/unsubscribe.cjs.ts
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint.' });
    }

    try {
      // Find and delete the subscription from the 'subscriptions' table
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('subscription_data->>endpoint', subscription.endpoint); // Match the endpoint field in the JSONB column

      if (error) {
        console.error('Error deleting subscription:', error);
        return res.status(500).json({ error: 'Failed to delete subscription.' });
      }

      console.log('Subscription deleted successfully');
      return res.status(200).json({ message: 'Subscription deleted successfully.' });

    } catch (e) {
      console.error('Unexpected error:', e);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }

  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
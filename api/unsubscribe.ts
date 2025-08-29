import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint.' });
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('subscription_data->>endpoint', subscription.endpoint);

      if (error) {
        console.error('Error deleting subscription:', error);
        return res.status(500).json({ error: 'Failed to delete subscription.' });
      }

      return res.status(200).json({ message: 'Subscription deleted successfully.' });

    } catch (e) {
      console.error('Unexpected error:', e);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }

  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
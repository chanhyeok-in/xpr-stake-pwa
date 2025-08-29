import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided as environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { subscription, xprAccount } = req.body;

    if (!subscription || !xprAccount) {
      return res.status(400).json({ error: 'Missing subscription or XPR account.' });
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          { xpr_account: xprAccount, subscription_data: subscription }
        ])
        .select();

      if (error) {
        console.error('Error saving subscription:', error);
        return res.status(500).json({ error: 'Failed to save subscription.' });
      }

      return res.status(201).json({ message: 'Subscription saved successfully.', data });

    } catch (e) {
      console.error('Unexpected error:', e);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }

  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

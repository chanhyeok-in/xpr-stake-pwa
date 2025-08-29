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
    const { xprAccount } = req.body;

    try {
      const { data: subscriptions, error: fetchError } = await supabase
        .from('subscriptions')
        .select('subscription_data') // Select only the data
        .eq('xpr_account', xprAccount);

      if (fetchError) {
        return res.status(500).json({ error: `Supabase error: ${fetchError.message}` });
      }

      if (!subscriptions || subscriptions.length === 0) {
        return res.status(404).json({ error: `No subscription found for account ${xprAccount}.` });
      }
      
      // Step 2: Just return the found subscriptions, don't try to send a push.
      res.status(200).json({ message: `Successfully fetched ${subscriptions.length} subscriptions.`, data: subscriptions });

    } catch (e) {
      res.status(500).json({ error: `Unexpected error: ${e.message}` });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
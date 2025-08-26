// No import for VercelRequest, VercelResponse types as they are not needed at runtime
const supabaseJs = require('@supabase/supabase-js'); // Changed import statement

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided as environment variables.');
}

const supabase = supabaseJs.createClient(supabaseUrl, supabaseAnonKey);

module.exports = async function handler(req, res) { // Changed to module.exports and removed types
  if (req.method === 'POST') {
    const { subscription, xprAccount } = req.body;

    if (!subscription || !xprAccount) {
      return res.status(400).json({ error: 'Missing subscription or XPR account.' });
    }

    try {
      // Insert subscription data into the 'subscriptions' table
      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          { xpr_account: xprAccount, subscription_data: subscription }
        ]);

      if (error) {
        console.error('Error saving subscription:', error);
        return res.status(500).json({ error: 'Failed to save subscription.' });
      }

      console.log('Subscription saved successfully:', data);
      return res.status(200).json({ message: 'Subscription received successfully.' });

    } catch (e) {
      console.error('Unexpected error:', e);
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }

  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

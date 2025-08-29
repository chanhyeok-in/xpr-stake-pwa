export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { xprAccount } = req.body;
    console.log(`Dummy test-push called for account: ${xprAccount}`);
    // This is a dummy endpoint to confirm deployment.
    // It does not actually send a push notification.
    res.status(200).json({ message: `Test endpoint is alive for ${xprAccount}` });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
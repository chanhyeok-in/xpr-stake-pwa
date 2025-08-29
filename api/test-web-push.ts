import * as webpush from 'web-push';

export default async function handler(req, res) {
  try {
    // Just try to access something from the imported library
    const version = webpush.version;
    res.status(200).json({ message: `Web-push library was imported successfully. Version: ${version}` });
  } catch (e) {
    res.status(500).json({ error: `Failed to import web-push: ${e.message}` });
  }
}
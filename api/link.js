import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
    const filename = 'shared-link.txt';

    if (req.method === 'POST') {
        const { link } = JSON.parse(req.body);
        // Use allowOverwrite to replace the existing file
        const blob = await put(filename, link, {
            access: 'public',
            addRandomSuffix: false, // Keep the URL predictable
            allowOverwrite: true
        });
        return res.status(200).json(blob);
    }

    if (req.method === 'GET') {
        const { blobs } = await list();
        const target = blobs.find(b => b.pathname === filename);
        if (!target) return res.status(404).json({ error: 'No link shared yet' });

        const response = await fetch(target.url);
        const link = await response.text();
        return res.status(200).json({ link });
    }
}

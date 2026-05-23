import { put, list } from '@vercel/blob';

const FILENAME = 'clipit.json';
const MAX_ENTRIES = 5;

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const { blobs } = await list();
        const target = blobs.find(b => b.pathname === FILENAME);
        if (!target) return res.status(200).json([]);
        const response = await fetch(target.url);
        const entries = await response.json();
        return res.status(200).json(entries);
    }

    if (req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const text = typeof body?.text === 'string' ? body.text.slice(0, 10000).trim() : null;
        if (!text) return res.status(400).json({ error: 'No text provided' });

        const { blobs } = await list();
        const target = blobs.find(b => b.pathname === FILENAME);
        let entries = [];
        if (target) {
            const response = await fetch(target.url);
            entries = await response.json();
        }

        // Deduplicate, prepend, cap at MAX_ENTRIES
        entries = [text, ...entries.filter(e => e !== text)].slice(0, MAX_ENTRIES);

        await put(FILENAME, JSON.stringify(entries), {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: 'application/json'
        });
        return res.status(200).json(entries);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

import { createServer } from 'node:http';
import { SignupStore } from './store.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN ?? '';
const WEBHOOK = process.env.SIGNUP_WEBHOOK_URL ?? '';
const store = new SignupStore(process.env.SIGNUP_FILE ?? 'data/signups.jsonl');

const hits = new Map();
function limited(ip) {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
	recent.push(now);
	hits.set(ip, recent);
	return recent.length > 10;
}

function send(res, status, body) {
	const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
	if (ALLOW_ORIGIN) headers['access-control-allow-origin'] = ALLOW_ORIGIN;
	res.writeHead(status, headers);
	res.end(JSON.stringify(body));
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on('data', (c) => {
			size += c.length;
			if (size > 4096) { reject(new Error('too large')); req.destroy(); return; }
			chunks.push(c);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});
}

async function forward(row) {
	if (!WEBHOOK) return;
	try {
		await fetch(WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row), signal: AbortSignal.timeout(5000) });
	} catch (err) {
		console.error('webhook failed:', err.message);
	}
}

createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://x');
	if (req.method === 'OPTIONS') return send(res, 204, {});
	if (req.method === 'GET' && url.pathname === '/api/signup/count') return send(res, 200, store.counts());
	if (req.method === 'POST' && url.pathname === '/api/signup') {
		const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
		if (limited(ip)) return send(res, 429, { error: 'Too many attempts. Try again in a minute.' });
		let input;
		try { input = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'Invalid request.' }); }
		if (input.company) return send(res, 200, { ok: true });
		const result = store.add(input);
		if (!result.ok) return send(res, result.status, { error: result.error });
		if (!result.duplicate) await forward(result.row);
		const { position, tier, path } = result.row;
		return send(res, result.status, { ok: true, duplicate: result.duplicate, position, tier, path });
	}
	send(res, 404, { error: 'Not found.' });
}).listen(PORT, HOST, () => console.log(`signup api on http://${HOST}:${PORT}`));

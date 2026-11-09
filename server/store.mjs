import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const BETA_SEATS = 100;
export const EARLY_SEATS = 500;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PATHS = new Set(['waitlist', 'self-deploy']);

export function tierFor(position) {
	if (position <= BETA_SEATS) return 'beta';
	if (position <= EARLY_SEATS) return 'early';
	return 'waitlist';
}

export class SignupStore {
	constructor(file) {
		this.file = file;
		this.rows = [];
		if (file && existsSync(file)) {
			this.rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
		}
	}

	counts() {
		const taken = this.rows.length;
		return { taken, betaLeft: Math.max(0, BETA_SEATS - taken), earlyLeft: Math.max(0, EARLY_SEATS - taken) };
	}

	add({ email, name = '', path = 'waitlist', note = '' }) {
		const clean = String(email ?? '').trim().toLowerCase();
		if (!EMAIL.test(clean)) return { ok: false, status: 400, error: 'Enter a valid email address.' };
		const existing = this.rows.find((r) => r.email === clean);
		if (existing) return { ok: true, status: 200, duplicate: true, row: existing };
		const position = this.rows.length + 1;
		const tier = tierFor(position);
		const row = {
			email: clean,
			name: String(name).trim().slice(0, 80),
			note: String(note).trim().slice(0, 300),
			// Only the first 500 get a choice; beta seats always get assisted deployment.
			path: tier === 'beta' ? 'assisted' : PATHS.has(path) ? path : 'waitlist',
			position,
			tier,
			at: new Date().toISOString()
		};
		this.rows.push(row);
		if (this.file) {
			mkdirSync(dirname(this.file), { recursive: true });
			appendFileSync(this.file, JSON.stringify(row) + '\n');
		}
		return { ok: true, status: 201, duplicate: false, row };
	}
}

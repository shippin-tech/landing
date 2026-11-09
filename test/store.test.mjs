import test from 'node:test';
import assert from 'node:assert/strict';
import { SignupStore, tierFor } from '../server/store.mjs';

test('tiers follow the first-100 and first-500 caps', () => {
	assert.equal(tierFor(1), 'beta');
	assert.equal(tierFor(100), 'beta');
	assert.equal(tierFor(101), 'early');
	assert.equal(tierFor(500), 'early');
	assert.equal(tierFor(501), 'waitlist');
});

test('rejects invalid email and dedupes case-insensitively', () => {
	const s = new SignupStore(null);
	assert.equal(s.add({ email: 'nope' }).status, 400);
	const a = s.add({ email: 'A@B.co' });
	const b = s.add({ email: 'a@b.CO' });
	assert.equal(a.row.position, 1);
	assert.equal(b.duplicate, true);
	assert.equal(s.counts().taken, 1);
});

test('beta seats are assisted; early seats may self-deploy', () => {
	const s = new SignupStore(null);
	for (let i = 1; i <= 100; i++) s.add({ email: `u${i}@x.io`, path: 'self-deploy' });
	assert.equal(s.rows[0].path, 'assisted');
	const r = s.add({ email: 'late@x.io', path: 'self-deploy' });
	assert.equal(r.row.tier, 'early');
	assert.equal(r.row.path, 'self-deploy');
	assert.equal(s.counts().betaLeft, 0);
});

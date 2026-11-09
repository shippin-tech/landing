interface SignupReply { ok?: boolean; error?: string; position?: number; tier?: string; path?: string; duplicate?: boolean }

const messages: Record<string, (r: SignupReply) => string> = {
	beta: (r) => `You are #${r.position}. Beta seat: we will help you deploy and support you directly.`,
	early: (r) => `You are #${r.position}. You are in the first 500: join the waitlist or deploy it yourself from GitHub.`,
	waitlist: (r) => `You are #${r.position} on the waitlist. We will email you as seats open.`
};

export function wireSignup(form: HTMLFormElement, status: HTMLElement, seats: HTMLElement | null): void {
	const endpoint = form.dataset.endpoint ?? '/api/signup';
	const countUrl = `${endpoint}/count`;
	fetch(countUrl).then((r) => r.json()).then((c: { betaLeft: number }) => {
		if (seats) seats.textContent = c.betaLeft > 0 ? `${c.betaLeft} of 100 beta seats left` : 'Beta seats are full. Waitlist is open.';
	}).catch(() => { if (seats) seats.textContent = 'First 100 get hands-on support.'; });

	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		const data = Object.fromEntries(new FormData(form).entries());
		const button = form.querySelector('button');
		if (button) button.disabled = true;
		status.textContent = 'Sending...';
		try {
			const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
			const body = (await res.json()) as SignupReply;
			if (!res.ok) throw new Error(body.error ?? 'Something went wrong.');
			status.textContent = body.duplicate ? 'You are already on the list.' : (messages[body.tier ?? 'waitlist'] ?? messages.waitlist)(body);
			form.reset();
		} catch (err) {
			status.textContent = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			if (button) button.disabled = false;
		}
	});
}

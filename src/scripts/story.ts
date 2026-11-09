export type Pt = [number, number];
export type Polyline = Pt[];
export interface Scene { name: string; polylines: Polyline[]; }
export interface SceneFile { version: 1; scenes: Scene[]; }

const PARTICLES = 1100;

const rect = (x: number, y: number, w: number, h: number, r = 0): Polyline => {
	const k = r;
	return [[x + k, y], [x + w - k, y], [x + w, y + k], [x + w, y + h - k], [x + w - k, y + h], [x + k, y + h], [x, y + h - k], [x, y + k], [x + k, y]];
};
const circle = (cx: number, cy: number, r: number, n = 40): Polyline =>
	Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r] as Pt);

// Coordinates are normalised to -1..1 so a real video-to-data export can use the same format.
export const proceduralScenes: Scene[] = [
	{ name: 'mail', polylines: [rect(-0.6, -0.38, 1.2, 0.76, 0.08), [[-0.6, -0.3], [0, 0.12], [0.6, -0.3]], [[-0.6, 0.3], [-0.2, -0.02]], [[0.6, 0.3], [0.2, -0.02]]] },
	{
		name: 'org',
		polylines: [
			circle(0, -0.55, 0.12), circle(-0.55, 0.05, 0.1), circle(0, 0.05, 0.1), circle(0.55, 0.05, 0.1),
			circle(-0.8, 0.62, 0.07), circle(-0.3, 0.62, 0.07), circle(-0.15, 0.62, 0.07), circle(0.15, 0.62, 0.07), circle(0.45, 0.62, 0.07), circle(0.8, 0.62, 0.07),
			[[0, -0.43], [-0.55, -0.05]], [[0, -0.43], [0, -0.05]], [[0, -0.43], [0.55, -0.05]],
			[[-0.55, 0.15], [-0.8, 0.55]], [[-0.55, 0.15], [-0.3, 0.55]], [[0, 0.15], [-0.15, 0.55]], [[0, 0.15], [0.15, 0.55]], [[0.55, 0.15], [0.45, 0.55]], [[0.55, 0.15], [0.8, 0.55]]
		]
	},
	{ name: 'drive', polylines: [rect(-0.55, -0.5, 0.7, 0.9, 0.05), rect(-0.35, -0.38, 0.7, 0.9, 0.05), rect(-0.15, -0.26, 0.7, 0.9, 0.05), [[0.0, 0.0], [0.4, 0.0]], [[0.0, 0.15], [0.4, 0.15]], [[0.0, 0.3], [0.28, 0.3]], circle(0.62, -0.5, 0.1)] },
	{ name: 'shield', polylines: [[[0, -0.7], [0.55, -0.45], [0.5, 0.15], [0, 0.72], [-0.5, 0.15], [-0.55, -0.45], [0, -0.7]], [[-0.22, 0.0], [-0.04, 0.2], [0.28, -0.2]], circle(0, 0, 0.9, 60)] },
	{ name: 'launch', polylines: [circle(0, 0, 0.25, 36), circle(0, 0, 0.5, 48), circle(0, 0, 0.75, 64), [[-0.9, 0], [0.9, 0]], [[0, -0.9], [0, 0.9]], [[-0.64, -0.64], [0.64, 0.64]], [[-0.64, 0.64], [0.64, -0.64]]] }
];

function length(p: Polyline): number {
	let d = 0;
	for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
	return d;
}

export function sample(scene: Scene, n: number): Float32Array {
	const out = new Float32Array(n * 2);
	const lens = scene.polylines.map(length);
	const total = lens.reduce((a, b) => a + b, 0) || 1;
	let k = 0;
	scene.polylines.forEach((poly, pi) => {
		const count = pi === scene.polylines.length - 1 ? n - k : Math.round((lens[pi] / total) * n);
		for (let j = 0; j < count && k < n; j++, k++) {
			let target = ((j + 0.5) / count) * lens[pi];
			let seg = 1;
			while (seg < poly.length - 1 && target > Math.hypot(poly[seg][0] - poly[seg - 1][0], poly[seg][1] - poly[seg - 1][1])) {
				target -= Math.hypot(poly[seg][0] - poly[seg - 1][0], poly[seg][1] - poly[seg - 1][1]);
				seg++;
			}
			const a = poly[seg - 1];
			const b = poly[seg];
			const sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
			const t = Math.min(1, target / sl);
			out[k * 2] = a[0] + (b[0] - a[0]) * t;
			out[k * 2 + 1] = a[1] + (b[1] - a[1]) * t;
		}
	});
	return out;
}

async function loadScenes(): Promise<Scene[]> {
	try {
		const res = await fetch('/data/scenes.json', { cache: 'force-cache' });
		if (!res.ok) return proceduralScenes;
		const file = (await res.json()) as SceneFile;
		return file.version === 1 && file.scenes.length ? file.scenes : proceduralScenes;
	} catch {
		return proceduralScenes;
	}
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export async function startStory(canvas: HTMLCanvasElement, sections: HTMLElement[]): Promise<void> {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const scenes = await loadScenes();
	const targets = scenes.map((s) => sample(s, PARTICLES));
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const pos = new Float32Array(PARTICLES * 2);
	const vel = new Float32Array(PARTICLES * 2);
	for (let i = 0; i < PARTICLES; i++) {
		pos[i * 2] = (Math.random() - 0.5) * 2;
		pos[i * 2 + 1] = (Math.random() - 0.5) * 2;
	}
	const pointer = { x: 9, y: 9 };
	let w = 0;
	let h = 0;
	const resize = () => {
		const dpr = Math.min(devicePixelRatio || 1, 2);
		w = canvas.clientWidth;
		h = canvas.clientHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};
	resize();
	addEventListener('resize', resize);
	addEventListener('pointermove', (e) => {
		const s = Math.min(w, h) * 0.42;
		pointer.x = (e.clientX - w / 2) / s;
		pointer.y = (e.clientY - h / 2) / s;
	});

	const progress = () => {
		const mid = innerHeight * 0.5;
		const centre = (el: HTMLElement) => {
			const r = el.getBoundingClientRect();
			return r.top + r.height / 2;
		};
		let idx = 0;
		let frac = 0;
		for (let i = 0; i < sections.length; i++) {
			if (centre(sections[i]) <= mid) {
				idx = i;
				const next = sections[i + 1];
				const span = next ? centre(next) - centre(sections[i]) : 1;
				frac = next ? Math.min(1, Math.max(0, (mid - centre(sections[i])) / span)) : 0;
			}
		}
		// Hold each scene while its section is near the middle, morph only in between.
		frac = Math.min(1, Math.max(0, (frac - 0.3) / 0.4));
		return { idx: Math.min(idx, targets.length - 1), frac };
	};

	const colors = ['#7dd3fc', '#e6a77c', '#f2c46d', '#22d3ee'];
	let t0 = performance.now();
	const frame = (now: number) => {
		const time = (now - t0) / 1000;
		const { idx, frac } = progress();
		const a = targets[idx];
		const b = targets[Math.min(idx + 1, targets.length - 1)];
		const e = smooth(frac);
		const s = Math.min(w, h) * 0.42;
		ctx.clearRect(0, 0, w, h);
		for (let i = 0; i < PARTICLES; i++) {
			const tx = a[i * 2] + (b[i * 2] - a[i * 2]) * e + Math.sin(time * 1.3 + i) * 0.006;
			const ty = a[i * 2 + 1] + (b[i * 2 + 1] - a[i * 2 + 1]) * e + Math.cos(time * 1.1 + i * 1.7) * 0.006;
			const dx = pos[i * 2] - pointer.x;
			const dy = pos[i * 2 + 1] - pointer.y;
			const d2 = dx * dx + dy * dy;
			if (d2 < 0.06) {
				const f = (0.06 - d2) * 0.8;
				vel[i * 2] += dx * f;
				vel[i * 2 + 1] += dy * f;
			}
			vel[i * 2] = (vel[i * 2] + (tx - pos[i * 2]) * 0.06) * 0.82;
			vel[i * 2 + 1] = (vel[i * 2 + 1] + (ty - pos[i * 2 + 1]) * 0.06) * 0.82;
			if (reduce) { pos[i * 2] = tx; pos[i * 2 + 1] = ty; } else { pos[i * 2] += vel[i * 2]; pos[i * 2 + 1] += vel[i * 2 + 1]; }
			ctx.fillStyle = colors[i % colors.length];
			ctx.globalAlpha = 0.85;
			ctx.fillRect(w / 2 + pos[i * 2] * s, h / 2 + pos[i * 2 + 1] * s, 2.2, 2.2);
		}
		if (!reduce) requestAnimationFrame(frame);
	};
	requestAnimationFrame(frame);
	if (reduce) addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
}

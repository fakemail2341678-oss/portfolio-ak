import { hashString, mulberry32 } from "../seeded-random";

/**
 * Seeded 2D simplex noise (Stefan Gustavson's formulation) for the generated
 * mountains. Only +, −, ×, ÷, floor and sqrt are used: IEEE 754 makes those
 * exact in every engine, so the server and every browser compute the same
 * heights and print the same SVG (no hydration mismatch). No sin, cos or exp.
 */

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRADIENTS = [
	[1, 1],
	[-1, 1],
	[1, -1],
	[-1, -1],
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
] as const;

export type Noise2 = (x: number, y: number) => number;

/** A noise function in [-1, 1] for this seed; the same seed always gives the same field. */
export function simplex2(seed: string): Noise2 {
	const random = mulberry32(hashString(seed));
	const permutation = Array.from({ length: 256 }, (_, index) => index);
	for (let index = 255; index > 0; index--) {
		const other = Math.floor(random() * (index + 1));
		[permutation[index], permutation[other]] = [permutation[other] as number, permutation[index] as number];
	}
	const perm = new Uint8Array(512);
	for (let index = 0; index < 512; index++) perm[index] = permutation[index & 255] as number;

	const corner = (gi: number, x: number, y: number) => {
		const t = 0.5 - x * x - y * y;
		if (t < 0) return 0;
		const [gx, gy] = GRADIENTS[gi % 8] as readonly [number, number];
		const t2 = t * t;
		return t2 * t2 * (gx * x + gy * y);
	};

	return (xin, yin) => {
		const s = (xin + yin) * F2;
		const i = Math.floor(xin + s);
		const j = Math.floor(yin + s);
		const t = (i + j) * G2;
		const x0 = xin - (i - t);
		const y0 = yin - (j - t);
		const i1 = x0 > y0 ? 1 : 0;
		const j1 = x0 > y0 ? 0 : 1;
		const x1 = x0 - i1 + G2;
		const y1 = y0 - j1 + G2;
		const x2 = x0 - 1 + 2 * G2;
		const y2 = y0 - 1 + 2 * G2;
		const ii = i & 255;
		const jj = j & 255;
		const n0 = corner(perm[ii + (perm[jj] as number)] as number, x0, y0);
		const n1 = corner(perm[ii + i1 + (perm[jj + j1] as number)] as number, x1, y1);
		const n2 = corner(perm[ii + 1 + (perm[jj + 1] as number)] as number, x2, y2);
		// 70 scales the sum to about [-1, 1].
		return 70 * (n0 + n1 + n2);
	};
}

/** Fractal noise: `octaves` layers, each at twice the frequency and half the amplitude. Result in about [-1, 1]. */
export function fbm(noise: Noise2, x: number, y: number, octaves = 4): number {
	let sum = 0;
	let amplitude = 1;
	let frequency = 1;
	let total = 0;
	for (let octave = 0; octave < octaves; octave++) {
		sum += amplitude * noise(x * frequency, y * frequency);
		total += amplitude;
		amplitude *= 0.5;
		frequency *= 2;
	}
	return sum / total;
}

/** Ridged fractal noise: sharp crests where the noise crosses zero, like a mountain range. Result in [0, 1]. */
export function ridged(noise: Noise2, x: number, y: number, octaves = 4): number {
	let sum = 0;
	let amplitude = 1;
	let frequency = 1;
	let total = 0;
	for (let octave = 0; octave < octaves; octave++) {
		const crest = 1 - Math.abs(noise(x * frequency, y * frequency));
		sum += amplitude * crest * crest;
		total += amplitude;
		amplitude *= 0.5;
		frequency *= 2;
	}
	return sum / total;
}

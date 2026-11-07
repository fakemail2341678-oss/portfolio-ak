/**
 * Deterministic pseudo-random numbers for generative art: the same seed gives
 * the same sequence on the server and in the browser, so SVG covers hydrate
 * without a mismatch.
 */

/** FNV-1a: a string to a 32-bit unsigned integer. */
export const hashString = (value: string): number => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
};

/** Mulberry32: a tiny, fast generator with good distribution for visuals. Returns numbers in [0, 1). */
export const mulberry32 = (seed: number): (() => number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** A seeded generator with helpers, from any string seed. */
export const seededRandom = (seed: string) => {
	const next = mulberry32(hashString(seed));
	return {
		next,
		/** A number in [min, max). */
		between: (min: number, max: number) => min + next() * (max - min),
		/** An integer in [min, max]. */
		int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
		/** True with probability `chance`. */
		chance: (chance: number) => next() < chance,
	};
};

/** Rounds SVG coordinates so server and client print identical attribute strings. */
export const round = (value: number): number => Math.round(value * 10) / 10;

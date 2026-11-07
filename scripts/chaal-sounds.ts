/**
 * Chaal's sounds, synthesized here so they are our own (PLAN 13.5: "CC0 or our own
 * sounds"; decision 0258). Writes public/chaal/sounds/*.wav: 22.05 kHz, 16-bit mono,
 * each under 22 kB. Deterministic: the noise comes from a seeded generator, so a rerun
 * writes the same bytes. The board plays them only after the player's first
 * interaction (Task 74).
 *
 * Run: pnpm chaal:sounds
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 22_050;
const OUT = "public/chaal/sounds";

type Voice = (t: number) => number;

/** A seeded generator (mulberry32), for the noise in a knock. */
function random(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const decay = (t: number, rate: number) => Math.exp(-t * rate);
const sine = (frequency: number, t: number) => Math.sin(2 * Math.PI * frequency * t);

/** A wooden knock: a low body that dies fast, under a short click of filtered noise. */
function knock(pitch: number, seed: number): Voice {
	const next = random(seed);
	let smooth = 0;
	return (t) => {
		smooth += (next() * 2 - 1 - smooth) * 0.35;
		return 0.9 * sine(pitch, t) * decay(t, 55) + 0.6 * sine(pitch * 2.7, t) * decay(t, 90) + smooth * decay(t, 260);
	};
}

/** A soft bell: a sine with one quiet overtone. */
const bell =
	(frequency: number, length = 9): Voice =>
	(t) =>
		(sine(frequency, t) + 0.25 * sine(frequency * 2, t)) * decay(t, length);

/** Voices at offsets (seconds), summed. */
const at =
	(...parts: ReadonlyArray<readonly [number, Voice]>): Voice =>
	(t) =>
		parts.reduce((sum, [start, voice]) => (t >= start ? sum + voice(t - start) : sum), 0);

const SOUNDS: Record<string, { seconds: number; voice: Voice }> = {
	move: { seconds: 0.12, voice: knock(190, 1) },
	capture: { seconds: 0.16, voice: at([0, knock(230, 2)], [0.035, knock(170, 3)]) },
	check: { seconds: 0.3, voice: at([0, knock(210, 4)], [0.05, bell(880, 14)]) },
	start: { seconds: 0.45, voice: at([0, bell(523.25)], [0.12, bell(783.99)]) },
	end: { seconds: 0.5, voice: at([0, bell(783.99)], [0.14, bell(523.25, 7)]) },
	"low-time": { seconds: 0.06, voice: (t) => sine(1320, t) * decay(t, 70) },
	notify: { seconds: 0.35, voice: bell(987.77, 11) },
	correct: { seconds: 0.4, voice: at([0, bell(659.25, 16)], [0.08, bell(880, 16)], [0.16, bell(1318.5, 12)]) },
	wrong: { seconds: 0.25, voice: (t) => (sine(146.83, t) + 0.5 * sine(155.56, t)) * decay(t, 14) },
};

/** 16-bit PCM WAV, normalized to a 0.6 peak, with 4 ms fades so nothing clicks. */
function wav(seconds: number, voice: Voice) {
	const count = Math.round(seconds * RATE);
	const samples = Array.from({ length: count }, (_, index) => voice(index / RATE));
	const peak = Math.max(...samples.map(Math.abs)) || 1;
	const fade = Math.round(0.004 * RATE);
	const data = Buffer.alloc(count * 2);
	samples.forEach((sample, index) => {
		const edge = Math.min(1, index / fade, (count - 1 - index) / fade);
		const value = Math.max(-1, Math.min(1, (sample / peak) * 0.6 * edge));
		data.writeInt16LE(Math.round(value * 32_767), index * 2);
	});
	const header = Buffer.alloc(44);
	header.write("RIFF", 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write("WAVE", 8);
	header.write("fmt ", 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(RATE, 24);
	header.writeUInt32LE(RATE * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36);
	header.writeUInt32LE(data.length, 40);
	return Buffer.concat([header, data]);
}

mkdirSync(OUT, { recursive: true });
for (const [name, { seconds, voice }] of Object.entries(SOUNDS)) {
	const file = join(OUT, `${name}.wav`);
	const bytes = wav(seconds, voice);
	writeFileSync(file, bytes);
	console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} kB`);
}

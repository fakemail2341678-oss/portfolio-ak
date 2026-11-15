/**
 * Chaal's sounds (decision 0258: our own, `pnpm chaal:sounds`). They load on first use and
 * stay silent until the visitor has interacted with the page (PLAN 13.5): the browser's
 * `navigator.userActivation` says so, and a browser without it lets `play()` refuse.
 */
export type ChaalSound = "move" | "capture" | "check" | "start" | "end" | "low-time" | "notify" | "correct" | "wrong";

const loaded = new Map<ChaalSound, HTMLAudioElement>();

/** Plays a sound at a volume of 0–100. */
export function playSound(sound: ChaalSound, volume: number) {
	if (typeof window === "undefined" || volume <= 0) return;
	if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
	let audio = loaded.get(sound);
	if (!audio) {
		audio = new Audio(`/chaal/sounds/${sound}.wav`);
		loaded.set(sound, audio);
	}
	audio.volume = Math.min(1, volume / 100);
	audio.currentTime = 0;
	void audio.play().catch(() => {});
}

/** The sound of a move, from its SAN: check outranks a capture. */
export const soundOfSan = (san: string): ChaalSound =>
	/[+#]/.test(san) ? "check" : san.includes("x") ? "capture" : "move";

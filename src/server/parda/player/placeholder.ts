import "@tanstack/react-start/server-only";
import { PLACEHOLDER_CUES, type PlaceholderCue } from "@/features/parda/admin/schema";
import { m } from "@/paraglide/messages";

/**
 * The placeholder player behind /parda/api (decision 0230). It plays no video: it counts
 * seconds and speaks the Viduki embed contract the owner's API follows (decision 0248):
 * `MEDIA_DATA` progress and `viduki:all-servers-failed`, and it obeys no command.
 * `?protocol=parda` speaks the `parda` adapter's protocol instead (events and commands),
 * which the e2e flows use for the code a commandable player reaches. `?cue=` rehearses
 * trouble: `fail` reports a failure, `stall` freezes the position, `silent` sends nothing.
 * In `parda`, the command `rehearse-stall` freezes it on demand and lets it go again.
 */

export type PlaceholderRequest = {
	server: number;
	media: "movie" | "tv";
	id: number;
	season: number | null;
	episode: number | null;
	start: number;
	cue: PlaceholderCue | null;
	lang: "en" | "ne";
	protocol: "viduki" | "parda";
};

const PATH = /^\/parda\/api\/([1-4])\/(?:movie\/(\d{1,9})|tv\/(\d{1,9})\/(\d{1,4})\/(\d{1,5}))\/?$/;
/** Simulated lengths: long enough for a resume to mean something. */
const DURATION = { movie: 7200, tv: 1500 } as const;

/** The request a URL names; null for any other path (a 404). */
export function parsePlaceholderUrl(url: URL): PlaceholderRequest | null {
	const match = PATH.exec(url.pathname);
	if (!match) return null;
	const [, server, movieId, tvId, season, episode] = match;
	const cue = url.searchParams.get("cue");
	const start = Number(url.searchParams.get("start"));
	return {
		server: Number(server),
		media: movieId ? "movie" : "tv",
		id: Number(movieId ?? tvId),
		season: season ? Number(season) : null,
		episode: episode ? Number(episode) : null,
		start: Number.isSafeInteger(start) && start > 0 ? start : 0,
		cue: PLACEHOLDER_CUES.find((known) => known === cue) ?? null,
		lang: url.searchParams.get("lang") === "ne" ? "ne" : "en",
		protocol: url.searchParams.get("protocol") === "parda" ? "parda" : "viduki",
	};
}

/** Runs in the frame: a clock that reports to the parent (and, in `parda`, obeys its commands). */
const SCRIPT = `
const config = JSON.parse(document.getElementById("config").textContent);
const button = document.getElementById("toggle");
const clock = document.getElementById("clock");
const parentOrigin = document.referrer ? new URL(document.referrer).origin : location.origin;
let position = config.start;
let playing = false;
let held = false;
let lastReport = 0;
const post = (message) => {
	if (config.cue === "silent" || window.parent === window) return;
	window.parent.postMessage(message, parentOrigin);
};
const media = () =>
	config.media === "movie"
		? { type: "movie", tmdbid: String(config.id) }
		: { type: "tv", tmdbid: String(config.id), season: String(config.season), episode: String(config.episode) };
const progress = () => ({ watched: position, duration: config.duration });
const mediaData = () => {
	const id = String(config.id);
	const entry =
		config.media === "movie"
			? { id, type: "movie", title: "Placeholder", progress: progress(), last_updated: Date.now() }
			: {
					id,
					type: "tv",
					title: "Placeholder",
					last_season_watched: String(config.season),
					last_episode_watched: String(config.episode),
					show_progress: {
						["s" + config.season + "e" + config.episode]: {
							season: String(config.season),
							episode: String(config.episode),
							progress: progress(),
							last_updated: Date.now(),
						},
					},
				};
	return { type: "MEDIA_DATA", data: { [id]: entry } };
};
// Viduki reports progress and total failure only; it has no ready, play, pause, seeked or ended.
const send = (name, extra) => {
	if (config.protocol === "parda") {
		post({ type: "parda.player", event: { name, position, duration: config.duration, ...extra } });
		return;
	}
	if (name === "failed") {
		post({
			type: "viduki:all-servers-failed",
			source: "viduki-api-" + config.server,
			stage: "initial",
			status: 404,
			message: "content not found 404",
			media: media(),
		});
	} else if (name === "position" && Date.now() - lastReport >= 1000) {
		lastReport = Date.now();
		post(mediaData());
	}
};
const render = () => {
	const total = Math.floor(position);
	const minutes = String(Math.floor(total / 60)).padStart(2, "0");
	const seconds = String(total % 60).padStart(2, "0");
	clock.textContent = minutes + ":" + seconds;
	button.textContent = playing ? config.pause : config.play;
};
const play = () => {
	if (playing) return;
	playing = true;
	send("play");
	render();
};
const pause = () => {
	if (!playing) return;
	playing = false;
	send("pause");
	render();
};
button.addEventListener("click", () => (playing ? pause() : play()));
window.addEventListener("message", (event) => {
	if (config.protocol !== "parda") return;
	if (event.source !== window.parent || event.origin !== parentOrigin) return;
	const message = event.data;
	if (!message || message.type !== "parda.command") return;
	if (message.action === "play") play();
	else if (message.action === "pause") pause();
	else if (message.action === "rehearse-stall") held = message.on === true;
	else if (message.action === "seek" && Number.isFinite(message.position)) {
		position = Math.min(Math.max(0, message.position), config.duration);
		send("seeked");
		render();
	}
});
setInterval(() => {
	if (!playing) return;
	const frozen = held || (config.cue === "stall" && position >= config.start + 5);
	if (!frozen) position += 0.25;
	if (position >= config.duration) {
		position = config.duration;
		playing = false;
		send("ended");
	} else send("position");
	render();
}, 250);
send("ready");
if (config.cue === "fail") send("failed", { reason: "placeholder-cue" });
else play();
render();
`;

const STYLE = `
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:grid;place-items:center;padding:1rem;background:#111;color:#f5f5f5;font:16px/1.5 system-ui,sans-serif;text-align:center}
h1{margin:0;font-size:1.125rem}
p{margin:.5rem 0}
#clock{font-size:1.5rem;font-variant-numeric:tabular-nums}
button{min-height:44px;min-width:96px;border:1px solid #f5f5f5;border-radius:0;background:transparent;color:inherit;font:inherit;cursor:pointer}
@media (max-height:280px){body{padding:.5rem;font-size:13px;line-height:1.35}h1{font-size:.9375rem}p{margin:.125rem 0}#clock{font-size:1.125rem}button{min-height:32px}}
`;

const attribute = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

export function renderPlaceholder(request: PlaceholderRequest, nonce: string): string {
	const locale = { locale: request.lang };
	const heading = m.pd_placeholder_heading({ server: request.server }, locale);
	const title =
		request.media === "movie"
			? m.pd_placeholder_movie({ id: request.id }, locale)
			: m.pd_placeholder_episode(
					{ id: request.id, season: request.season ?? 1, episode: request.episode ?? 1 },
					locale,
				);
	// Inside <script type="application/json">: only "<" could end it early.
	const config = JSON.stringify({
		protocol: request.protocol,
		server: request.server,
		media: request.media,
		id: request.id,
		season: request.season,
		episode: request.episode,
		start: request.start,
		cue: request.cue,
		duration: DURATION[request.media],
		play: m.pd_placeholder_play({}, locale),
		pause: m.pd_placeholder_pause({}, locale),
	}).replaceAll("<", "\\u003c");
	return `<!doctype html>
<html lang="${request.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${attribute(heading)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<main>
<h1>${attribute(heading)}</h1>
<p>${attribute(title)}</p>
<p>${attribute(m.pd_placeholder_note({}, locale))}</p>
<p id="clock">00:00</p>
<button id="toggle" type="button">${attribute(m.pd_placeholder_play({}, locale))}</button>
</main>
<script id="config" type="application/json" nonce="${nonce}">${config}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>`;
}

/** Its own policy: this document may be framed by this app, and loads nothing else. */
export const placeholderCsp = (nonce: string) =>
	[
		"default-src 'none'",
		`script-src 'nonce-${nonce}'`,
		`style-src 'nonce-${nonce}'`,
		"base-uri 'none'",
		"form-action 'none'",
		"frame-ancestors 'self'",
	].join("; ");

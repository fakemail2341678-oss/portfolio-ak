import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, ListVideoIcon, RectangleHorizontalIcon, ServerIcon, TvIcon } from "lucide-react";
import { type CSSProperties, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { localizedValue } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { pardaWatchQueryOptions } from "../library/queries";
import { HeartButton, ListIconButton } from "../library/save-buttons";
import { pardaLinks } from "../links";
import { WatchTogetherButton } from "../party/watch-together";
import { titleRouteParams } from "../search";
import { episodeCode } from "../title/title-hero";
import { VideoDialog } from "../title/video-dialog";
import { ADAPTERS } from "./adapters";
import { usePictureInPicture } from "./picture-in-picture";
import { FullscreenButton, PipButton, playerBox, ShieldControls } from "./player-chrome";
import { PlayerFrame } from "./player-frame";
import { useWatchPlayer, type WatchPlayer } from "./use-watch-player";
import { BlockerHint, EpisodesSheet, ReportDialog, UpNext } from "./watch-panels";
import type { WatchPageData } from "./watch-types";

/** The frame in a picture-in-picture window, which has none of the app's stylesheets. */
const FILL: CSSProperties = { display: "block", width: "100vw", height: "100vh", border: 0 };

const route = getRouteApi("/_parda/app/parda/watch/$type/$id");

type Data = Extract<WatchPageData, { configured: true }>;

/**
 * The server switcher: Auto, then the sources in their order. The server renders it from
 * the page's data, so it's there before the player picks (no shift); its label is the
 * pick, or Auto.
 */
function ServerMenu({ player, sources }: { player: WatchPlayer; sources: Data["sources"] }) {
	if (sources.length < 2) return null;
	const listed = player.order.length ? player.order : sources;
	const picked = player.picked ? listed.find((source) => source.id === player.picked) : undefined;
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" data-testid="server-menu">
					<ServerIcon aria-hidden />
					{picked ? localizedValue(picked.name) : m.pd_server_auto()}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{m.pd_server_label()}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup
					value={player.picked ?? "auto"}
					onValueChange={(value) => player.choose(value === "auto" ? null : value)}
				>
					<DropdownMenuRadioItem value="auto" data-testid="server-auto">
						{m.pd_server_auto()}
					</DropdownMenuRadioItem>
					{listed.map((source) => (
						<DropdownMenuRadioItem key={source.id} value={source.id} data-testid="server-option">
							{source.quality
								? m.pd_server_quality({ name: localizedValue(source.name), quality: source.quality })
								: localizedValue(source.name)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function Screen({ data }: { data: Data }) {
	const navigate = useNavigate();
	const frameRef = useRef<HTMLIFrameElement>(null);
	const wrapper = useRef<HTMLDivElement>(null);
	const player = useWatchPlayer(data, frameRef);
	const [theater, setTheater] = useState(false);
	const [episodesOpen, setEpisodesOpen] = useState(false);
	const [shielded, setShielded] = useState(true);
	const [upNextDismissed, setUpNextDismissed] = useState(false);
	const pip = usePictureInPicture();
	// A frame that moves between windows reloads, so it starts again from where the viewer is.
	const [moved, setMoved] = useState<{ base: string; url: string } | null>(null);
	const frameUrl = moved && moved.base === player.src ? moved.url : player.src;
	const resumeHere = () => {
		const url = player.resumeSrc();
		if (url && player.src) setMoved({ base: player.src, url });
	};
	const togglePip = () => {
		resumeHere();
		if (pip.host) {
			pip.close();
			return;
		}
		const box = wrapper.current?.getBoundingClientRect();
		void pip.open({ width: box?.width ?? 640, height: box?.height ?? 360 }, resumeHere);
	};
	const { title, episode } = data;
	const adapter = player.source ? ADAPTERS[player.source.adapter] : null;
	const canCommand = Boolean(adapter?.command) && player.ready;
	// Parda's controls take a row when the first source obeys commands, rendered from the server so the bar never grows.
	const firstSource = data.sources.find((source) => source.id === data.order.ok[0]);
	const controlsRow = firstSource ? ADAPTERS[firstSource.adapter].command !== null : false;
	const watchLink = (target: { season: number; episode: number }) =>
		pardaLinks.watch(title.media, title.id, title.slug, target);

	useHotkeys({
		n: () => data.next && void navigate(watchLink(data.next)),
		p: () => data.previous && void navigate(watchLink(data.previous)),
		e: () => episode && setEpisodesOpen((open) => !open),
		t: () => setTheater((on) => !on),
		escape: () => setTheater(false),
		k: () => canCommand && player.command({ action: player.playing ? "pause" : "play" }),
	});

	const heading = episode ? `${title.title} · ${episodeCode(episode.season, episode.episode)}` : title.title;
	const frameTitle = player.source
		? m.pd_player_frame({ title: heading, source: localizedValue(player.source.name) })
		: heading;

	return (
		<>
			<section aria-label={m.pd_watch_player()} className="bg-pd-mask" data-testid="watch-player">
				<div ref={wrapper} className={playerBox(theater)} data-testid="watch-box" data-status={player.status}>
					{frameUrl && player.source && pip.host ? (
						<>
							{createPortal(
								<PlayerFrame
									url={frameUrl}
									origins={player.source.origins}
									adapter={ADAPTERS[player.source.adapter]}
									sandbox={player.source.sandbox}
									title={frameTitle}
									frameRef={frameRef}
									onEvent={player.onEvent}
									target={player.target}
									host={pip.host}
									className=""
									style={FILL}
								/>,
								pip.host.document.body,
							)}
							<output
								className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-6 text-center text-pd-on-picture"
								data-testid="watch-pip"
							>
								<p className="text-sm">{m.pd_player_pip_active()}</p>
								<Button size="sm" variant="outline" onClick={togglePip}>
									{m.pd_player_pip_back()}
								</Button>
							</output>
						</>
					) : frameUrl && player.source ? (
						<PlayerFrame
							url={frameUrl}
							origins={player.source.origins}
							adapter={ADAPTERS[player.source.adapter]}
							sandbox={player.source.sandbox}
							title={frameTitle}
							frameRef={frameRef}
							onEvent={player.onEvent}
							target={player.target}
							className="absolute inset-0 size-full"
						/>
					) : (
						<TmdbImage
							image={tmdbImage(data.imageBase, episode?.still ?? title.backdrop, "backdrop")}
							alt=""
							label={title.title}
							aspect="backdrop"
							sizes="100vw"
							priority
						/>
					)}
					{canCommand && shielded && !pip.host ? (
						// The shield: the iframe never gets a click, so clicks can't open ads (PLAN 12.5).
						<button
							type="button"
							className="absolute inset-0 size-full cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
							onClick={() => player.command({ action: player.playing ? "pause" : "play" })}
							aria-label={player.playing ? m.pd_player_pause() : m.pd_player_play()}
							data-testid="click-shield"
						/>
					) : null}
					{player.clickHint && player.status === "loading" ? (
						<p className="pointer-events-none absolute inset-x-0 top-0 bg-pd-scrim/0 p-3 text-center text-pd-on-picture text-sm">
							<span className="bg-black/70 px-2 py-1">{m.pd_player_press_play()}</span>
						</p>
					) : null}
					{player.status === "unavailable" || player.status === "off" ? (
						<output
							className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center text-pd-on-picture"
							data-testid="watch-unavailable"
						>
							<p className="pd-display text-pd-head">
								{data.playback === "off" ? m.pd_watch_off() : m.pd_watch_unavailable()}
							</p>
							{data.playback === "off" ? null : <p className="text-sm">{m.pd_watch_unavailable_detail()}</p>}
							<div className="flex flex-wrap justify-center gap-2">
								{data.trailer ? (
									<VideoDialog video={data.trailer} title={title.title}>
										<Button size="sm">
											<TvIcon aria-hidden />
											{m.pd_action_trailer()}
										</Button>
									</VideoDialog>
								) : null}
								{data.playback === "off" ? null : <ReportDialog data={data} sourceId={null} variant="outline" />}
							</div>
						</output>
					) : null}
					{player.nearEnd && data.next && !upNextDismissed ? (
						<UpNext data={data} next={data.next} onCancel={() => setUpNextDismissed(true)} />
					) : null}
				</div>
				<div
					className={cn(
						"mx-auto flex flex-wrap items-center gap-1 px-2 py-2 sm:px-4",
						playerBox(theater),
						"aspect-auto bg-transparent",
					)}
					data-testid="player-bar"
				>
					{controlsRow ? (
						<ShieldControls
							player={player}
							enabled={canCommand}
							shielded={shielded}
							onShield={setShielded}
							wrapper={wrapper}
						/>
					) : (
						<FullscreenButton wrapper={wrapper} disabled={!player.src || Boolean(pip.host)} />
					)}
					<PipButton supported={pip.supported} active={Boolean(pip.host)} disabled={!player.src} onToggle={togglePip} />
					{episode ? (
						<Button variant="ghost" size="sm" onClick={() => setEpisodesOpen(true)} data-testid="watch-episodes-open">
							<ListVideoIcon aria-hidden />
							{m.pd_episodes_heading()}
						</Button>
					) : null}
					<Button
						variant="ghost"
						size="sm"
						aria-pressed={theater}
						onClick={() => setTheater((on) => !on)}
						className="max-md:hidden"
						data-testid="watch-theater"
					>
						<RectangleHorizontalIcon aria-hidden />
						{m.pd_watch_theater()}
					</Button>
					<ListIconButton title={{ media: title.media, id: title.id, title: title.title }} playerMounted />
					<HeartButton title={{ media: title.media, id: title.id, title: title.title }} playerMounted />
					{data.playback === "on" ? <ReportDialog data={data} sourceId={player.source?.id ?? null} /> : null}
					{data.party && data.playback === "on" ? <WatchTogetherButton data={data} position={player.position} /> : null}
					<ServerMenu player={player} sources={data.sources} />
				</div>
			</section>
			{theater ? null : (
				<section aria-labelledby="watch-heading" className="flex flex-col gap-2 px-4 pt-6 pb-4 sm:px-6 lg:px-8">
					<Link
						{...pardaLinks.title(title.media, title.id, title.slug)}
						className="inline-flex w-fit items-center gap-1 text-pd-muted text-sm hover:text-pd-ink"
						data-testid="watch-back"
					>
						<ArrowLeftIcon aria-hidden className="size-4" />
						{m.pd_watch_back()}
					</Link>
					<h1 id="watch-heading" className="pd-display text-pd-head" data-testid="watch-heading">
						{title.title}
						{episode ? (
							<span className="mt-1 block font-normal text-base text-pd-muted">
								{episodeCode(episode.season, episode.episode)}
								{episode.name ? ` · ${episode.name}` : null}
							</span>
						) : null}
					</h1>
					{title.overview ? (
						<p className="max-w-prose text-pd-muted text-sm leading-relaxed">{title.overview}</p>
					) : null}
					<p className="text-pd-muted text-xs">{controlsRow ? m.pd_watch_shortcuts_play() : m.pd_watch_shortcuts()}</p>
				</section>
			)}
			{episode ? <EpisodesSheet data={data} open={episodesOpen} onOpenChange={setEpisodesOpen} /> : null}
			<BlockerHint />
		</>
	);
}

/**
 * The watch page (PLAN Task 64, decision 0236), noindex: the player between the masks,
 * its bar (Parda's controls where the player obeys commands, the server, episodes,
 * theater mode, *Report a problem*), the title, and the ad-blocker hint.
 */
export function PardaWatchPage() {
	const params = titleRouteParams(route.useParams());
	const search = route.useSearch();
	const { data } = useSuspenseQuery(
		pardaWatchQueryOptions(getLocale(), params?.type ?? "movie", params?.id ?? 0, search.s, search.e),
	);
	return (
		// Named: a player's own document may hold a <main> too, and landmarks must differ.
		<main
			{...MAIN_CONTENT}
			aria-label={m.pd_watch_main()}
			className="flex flex-1 flex-col outline-none"
			data-testid="parda-watch"
		>
			{data.configured ? (
				// A new episode is a new player: its state starts over.
				<Screen key={`${data.title.id}:${data.episode?.season}:${data.episode?.episode}`} data={data} />
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}

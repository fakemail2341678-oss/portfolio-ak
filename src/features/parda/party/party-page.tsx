import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckIcon,
	CopyIcon,
	CrownIcon,
	LogOutIcon,
	PlayIcon,
	RefreshCwIcon,
	ServerIcon,
	XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
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
import { formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { CatalogUnconfigured } from "../home/catalog-unconfigured";
import { tmdbImage } from "../kit/image";
import { TmdbImage } from "../kit/tmdb-image";
import { pardaLinks } from "../links";
import { ADAPTERS } from "../player/adapters";
import { playerBox, ShieldControls } from "../player/player-chrome";
import { PlayerFrame } from "../player/player-frame";
import { episodeCode } from "../title/title-hero";
import { pardaPartyQueryOptions } from "./queries";
import { PARTY_MAX_MEMBERS, partyMode, partySource, takesStart } from "./source";
import { continueCandidate, DRIFT_S, groupPosition, type SyncState } from "./sync";
import type { PartyPageData } from "./types";
import { type PartyRoom, usePartyRoom } from "./use-party-room";

const route = getRouteApi("/_parda/app/parda/party/$code");

type Data = Extract<PartyPageData, { configured: true }>;

const memberName = (sync: SyncState, id: string) => sync.members.find((member) => member.id === id)?.name ?? "";

/** What's happening, in one line of the lower mask. */
function statusLine(room: PartyRoom, hostName: string): string {
	const { sync } = room;
	if (room.lost) return m.pd_party_reconnecting();
	if (room.status === "joining" || (room.status === "joined" && !room.connected)) return m.pd_party_connecting();
	if (sync.phase === "lobby") {
		if (!room.ready) return m.pd_party_lobby_tap();
		return sync.me === sync.host ? m.pd_party_lobby_host() : m.pd_party_lobby_guest({ name: hostName });
	}
	if (sync.phase === "countdown") {
		const seconds = Math.max(1, Math.ceil(((sync.startAt ?? room.now) - room.now) / 1000));
		return m.pd_party_starting({ seconds: formatNumber(seconds) });
	}
	if (!room.ready) return m.pd_party_late();
	if (sync.playerFailed) return m.pd_party_player_failed();
	if (sync.mode === "together") return m.pd_party_mode_together();
	const waiting = sync.stalls.find((stall) => stall.member !== sync.me);
	if (waiting) return m.pd_party_waiting_for({ name: memberName(sync, waiting.member) });
	if (sync.stalls.length > 0) return m.pd_party_you_buffering();
	return sync.shared.playing ? m.pd_party_in_sync() : m.pd_party_paused();
}

/** The server menu is the host's: everyone plays one source, because timecodes differ between sources. */
function ServerMenu({ room, sources }: { room: PartyRoom; sources: Data["watch"]["sources"] }) {
	const change = (sourceId: string) => {
		room.changeSource(sourceId).catch((error: unknown) => toast.error(errorMessage(error)));
	};
	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" data-testid="party-server-menu">
					<ServerIcon aria-hidden />
					{room.source ? localizedValue(room.source.name) : m.pd_server_label()}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{m.pd_server_label()}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={room.sync.sourceId ?? ""} onValueChange={change}>
					{sources.map((source) => (
						<DropdownMenuRadioItem key={source.id} value={source.id} data-testid="party-server-option">
							{localizedValue(source.name)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Who's here: the lobby's list, and the room's while it plays. */
function Members({ sync, ready }: { sync: SyncState; ready: boolean }) {
	return (
		<section aria-labelledby="party-members" className="flex min-h-20 flex-col gap-2 px-4 py-4 sm:px-6 lg:px-8">
			<h2 id="party-members" className="font-medium text-pd-ink text-sm">
				{m.pd_party_members()}
			</h2>
			<ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="party-members">
				{sync.members.map((member) => {
					const isMe = member.id === sync.me;
					const on = isMe ? ready : member.ready;
					return (
						<li key={member.id} className="inline-flex items-center gap-1.5" data-testid="party-member">
							{member.id === sync.host ? (
								<CrownIcon aria-label={m.pd_party_host_badge()} className="size-4 text-pd-action" />
							) : null}
							<span className="text-pd-ink">{isMe ? m.pd_party_you({ name: member.name }) : member.name}</span>
							<span className="text-pd-muted text-xs">
								{on ? m.pd_party_ready_badge() : m.pd_party_not_ready_badge()}
							</span>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function Room({ data }: { data: Data }) {
	const frameRef = useRef<HTMLIFrameElement>(null);
	const wrapper = useRef<HTMLDivElement>(null);
	const room = usePartyRoom(data, frameRef);
	const [shielded, setShielded] = useState(true);
	const { watch } = data;
	const { title, episode } = watch;
	const { sync, source } = room;
	const isHost = Boolean(sync.me) && sync.me === sync.host;
	const heading = episode ? `${title.title} · ${episodeCode(episode.season, episode.episode)}` : title.title;
	const titleLink = pardaLinks.title(title.media, title.id, title.slug);

	if (sync.phase === "ended") {
		return (
			<section className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="pd-display text-pd-head" data-testid="party-ended">
					{m.pd_party_ended()}
				</h1>
				<Button asChild>
					<Link {...titleLink}>{m.pd_watch_back()}</Link>
				</Button>
			</section>
		);
	}

	const canCommand = sync.mode === "full" && Boolean(source && ADAPTERS[source.adapter].command) && sync.playerReady;
	const controlled = sync.mode === "full" && sync.phase === "live";
	const group = groupPosition(sync, room.now);
	const behind = sync.playerPosition === null ? null : Math.round(group - sync.playerPosition);
	const continueFor = continueCandidate(sync, room.now);
	// The best source for sync, offered while this one can only start together.
	const best = sync.mode === "together" ? partySource(watch.sources, watch.order.ok) : null;
	const syncable = best && partyMode(best) === "full" ? best : null;
	const copy = () => {
		navigator.clipboard
			.writeText(window.location.href)
			.then(() => toast.success(m.pd_party_copied()))
			.catch(() => toast.error(m.pd_party_copy_failed()));
	};
	const change = (sourceId: string) => {
		room.changeSource(sourceId).catch((error: unknown) => toast.error(errorMessage(error)));
	};
	const end = () => {
		room.endParty().catch((error: unknown) => toast.error(errorMessage(error)));
	};

	return (
		<>
			<section aria-label={m.pd_watch_player()} className="bg-pd-mask" data-testid="party-player">
				<div
					ref={wrapper}
					className={playerBox(false)}
					data-testid="party-box"
					data-mode={sync.mode}
					data-phase={sync.phase}
				>
					{room.src && source ? (
						<PlayerFrame
							url={room.src}
							origins={source.origins}
							adapter={ADAPTERS[source.adapter]}
							sandbox={source.sandbox}
							title={m.pd_player_frame({ title: heading, source: localizedValue(source.name) })}
							frameRef={frameRef}
							onEvent={room.onEvent}
							target={{ media: title.media, id: title.id, season: episode?.season, episode: episode?.episode }}
							className="absolute inset-0 size-full"
						/>
					) : (
						<TmdbImage
							image={tmdbImage(watch.imageBase, episode?.still ?? title.backdrop, "backdrop")}
							alt=""
							label={title.title}
							aspect="backdrop"
							sizes="100vw"
							priority
						/>
					)}
					{canCommand && shielded && room.src ? (
						// The shield: the iframe never gets a click, so clicks can't open ads (PLAN 12.5).
						<button
							type="button"
							className="absolute inset-0 size-full cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
							onClick={() => room.control({ action: sync.playerPlaying ? "pause" : "play" })}
							aria-label={sync.playerPlaying ? m.pd_player_pause() : m.pd_player_play()}
							data-testid="party-shield"
						/>
					) : null}
				</div>
				<div
					className={cn(
						"mx-auto flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2 sm:px-4",
						playerBox(false),
						"aspect-auto bg-transparent",
					)}
					data-testid="party-bar"
				>
					{sync.mode === "full" ? (
						<ShieldControls
							player={{
								playing: sync.playerPlaying,
								position: room.position,
								duration: room.duration,
								command: room.control,
							}}
							enabled={canCommand && controlled}
							shielded={shielded}
							onShield={setShielded}
							wrapper={wrapper}
						/>
					) : null}
					<output
						aria-live="polite"
						className="min-h-8 flex-1 basis-full content-center px-2 text-pd-ink text-sm"
						data-testid="party-status"
					>
						{room.status === "full"
							? m.pd_party_full({ count: formatNumber(PARTY_MAX_MEMBERS) })
							: room.status === "failed"
								? m.pd_party_join_failed()
								: statusLine(room, data.hostName)}
					</output>
					{room.status === "failed" ? (
						<Button size="sm" onClick={room.retry}>
							{m.pd_party_retry()}
						</Button>
					) : null}
					{!room.ready && room.status !== "full" && room.status !== "failed" ? (
						<Button
							size="sm"
							onClick={() => void room.pressReady()}
							disabled={room.status === "joining"}
							data-testid="party-ready"
						>
							<CheckIcon aria-hidden />
							{sync.phase === "lobby" ? m.pd_party_ready() : m.pd_party_join_in()}
						</Button>
					) : null}
					{isHost && sync.phase === "lobby" ? (
						<Button
							size="sm"
							variant="outline"
							onClick={room.start}
							disabled={!room.connected}
							data-testid="party-start"
						>
							<PlayIcon aria-hidden />
							{m.pd_party_start()}
						</Button>
					) : null}
					{continueFor ? (
						<Button size="sm" onClick={() => room.continueWithout(continueFor)} data-testid="party-continue">
							{m.pd_party_continue_without({ name: memberName(sync, continueFor) })}
						</Button>
					) : null}
					{sync.mode === "together" && room.src && sync.phase === "live" ? (
						<>
							{behind !== null && behind > DRIFT_S ? (
								<span className="text-pd-muted text-xs tabular-nums" data-testid="party-behind">
									{m.pd_party_behind({ seconds: formatNumber(behind) })}
								</span>
							) : null}
							{source && takesStart(source) ? (
								<Button size="sm" variant="outline" onClick={room.resync} data-testid="party-resync">
									<RefreshCwIcon aria-hidden />
									{m.pd_party_resync()}
								</Button>
							) : null}
						</>
					) : null}
					{isHost && syncable ? (
						<Button size="sm" variant="outline" onClick={() => change(syncable.id)} data-testid="party-switch-sync">
							{m.pd_party_switch_to({ name: localizedValue(syncable.name) })}
						</Button>
					) : null}
					<span className="ml-auto flex flex-wrap items-center gap-1">
						{isHost && watch.sources.length > 1 ? <ServerMenu room={room} sources={watch.sources} /> : null}
						<Button variant="ghost" size="sm" onClick={copy} data-testid="party-copy">
							<CopyIcon aria-hidden />
							{m.pd_party_copy()}
						</Button>
						{isHost ? (
							<Button variant="ghost" size="sm" onClick={end} data-testid="party-end">
								<XIcon aria-hidden />
								{m.pd_party_end()}
							</Button>
						) : (
							<Button variant="ghost" size="sm" asChild>
								<Link {...titleLink} data-testid="party-leave">
									<LogOutIcon aria-hidden />
									{m.pd_party_leave()}
								</Link>
							</Button>
						)}
					</span>
				</div>
			</section>
			<section aria-labelledby="party-heading" className="flex flex-col gap-1 px-4 pt-6 sm:px-6 lg:px-8">
				<Link {...titleLink} className="inline-flex w-fit items-center gap-1 text-pd-muted text-sm hover:text-pd-ink">
					<ArrowLeftIcon aria-hidden className="size-4" />
					{m.pd_watch_back()}
				</Link>
				<h1 id="party-heading" className="pd-display text-pd-head" data-testid="party-heading">
					{heading}
				</h1>
				{data.hostName ? (
					<p className="text-pd-muted text-sm">{m.pd_party_hosted_by({ name: data.hostName })}</p>
				) : null}
			</section>
			<Members sync={sync} ready={room.ready} />
		</>
	);
}

/**
 * A watch party's page (PLAN Task 69a, decision 0243), noindex: the picture or the player
 * between the masks, what's happening and the room's controls in the lower mask, and who's here.
 */
export function PardaPartyPage() {
	const { code } = route.useParams();
	const { data } = useSuspenseQuery(pardaPartyQueryOptions(getLocale(), code));
	return (
		<main
			{...MAIN_CONTENT}
			aria-label={m.pd_party_main()}
			className="flex flex-1 flex-col outline-none"
			data-testid="parda-party"
		>
			{data.configured ? (
				<Room data={data} />
			) : (
				<>
					<h1 className="sr-only">{m.pd_catalog_unconfigured()}</h1>
					<CatalogUnconfigured />
				</>
			)}
		</main>
	);
}

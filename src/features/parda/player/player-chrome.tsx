import {
	CheckIcon,
	MaximizeIcon,
	MousePointerClickIcon,
	PauseIcon,
	PictureInPicture2Icon,
	PlayIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { PlayerCommand } from "./adapters/types";
import { formatClock } from "./machine";

/** What the watch page and the party share around a player (decisions 0236 and 0243). */

/** Clock digits in the page's language ("३४:१०" in Nepali). */
const clock = (seconds: number) => formatClock(seconds).replace(/\d/g, (digit) => formatNumber(Number(digit)));

/**
 * The player's box (PLAN 12.6, "Player size"): as wide as the height allows at 16:9,
 * never wider than the page; theater mode gives it the height the details took.
 */
export const playerBox = (theater: boolean) =>
	cn(
		"relative mx-auto aspect-video w-full bg-black",
		theater ? "max-w-[calc((100dvh-7.5rem)*16/9)]" : "max-w-[max(20rem,calc((100dvh-12rem)*16/9))]",
	);

/**
 * Parda's own controls, for a player that obeys commands (PLAN 12.5, "Click shield"):
 * play, pause, a seek bar and fullscreen on our wrapper. *Player menu* lifts the shield
 * for the player's own settings, and says clicks there may open ads.
 */
export function ShieldControls({
	player,
	shielded,
	onShield,
	wrapper,
	enabled,
}: {
	player: {
		playing: boolean;
		position: number;
		duration: number | null;
		command: (command: PlayerCommand) => void;
	};
	/** False until the player is ready (and for one that doesn't obey commands): shown, so nothing moves, but inert. */
	enabled: boolean;
	shielded: boolean;
	onShield: (on: boolean) => void;
	wrapper: React.RefObject<HTMLDivElement | null>;
}) {
	const toggle = () => player.command({ action: player.playing ? "pause" : "play" });
	return (
		<div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto" data-testid="shield-controls">
			<Button
				variant="ghost"
				size="icon"
				onClick={toggle}
				disabled={!enabled}
				aria-label={player.playing ? m.pd_player_pause() : m.pd_player_play()}
				data-testid="control-toggle"
			>
				{player.playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
			</Button>
			<span className="w-24 shrink-0 text-pd-muted text-xs tabular-nums sm:w-28" data-testid="control-time">
				{clock(player.position)}
				{player.duration ? ` / ${clock(player.duration)}` : null}
			</span>
			<input
				type="range"
				min={0}
				max={Math.max(1, Math.floor(player.duration ?? 0))}
				step={1}
				value={Math.floor(player.position)}
				disabled={!enabled || !player.duration}
				onChange={(event) => player.command({ action: "seek", position: Number(event.target.value) })}
				aria-label={m.pd_player_seek()}
				aria-valuetext={clock(player.position)}
				className="h-6 min-w-0 flex-1 accent--pd-action]"
				data-testid="control-seek"
			/>
			<FullscreenButton wrapper={wrapper} disabled={!enabled} />
			<Button
				variant="ghost"
				size="sm"
				aria-pressed={!shielded}
				onClick={() => onShield(!shielded)}
				disabled={!enabled}
				title={m.pd_player_menu_warning()}
				data-testid="control-player-menu"
			>
				{shielded ? <MousePointerClickIcon aria-hidden /> : <CheckIcon aria-hidden />}
				{shielded ? m.pd_player_menu() : m.pd_player_menu_done()}
			</Button>
		</div>
	);
}

/** Full screen on our wrapper, so Parda's overlays (Up next) stay on top. Works for any player. */
export function FullscreenButton({
	wrapper,
	disabled = false,
}: {
	wrapper: React.RefObject<HTMLDivElement | null>;
	disabled?: boolean;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => void wrapper.current?.requestFullscreen?.().catch(() => {})}
			disabled={disabled}
			aria-label={m.pd_player_fullscreen()}
			data-testid="control-fullscreen"
		>
			<MaximizeIcon aria-hidden />
		</Button>
	);
}

/**
 * Picture-in-picture (`picture-in-picture.ts`): rendered by the server so the bar never
 * shifts; disabled in a browser without Document Picture-in-Picture, and saying why.
 */
export function PipButton({
	supported,
	active,
	disabled,
	onToggle,
}: {
	supported: boolean;
	active: boolean;
	disabled: boolean;
	onToggle: () => void;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={onToggle}
			disabled={disabled || !supported}
			aria-pressed={active}
			aria-label={m.pd_player_pip()}
			title={supported ? m.pd_player_pip() : m.pd_player_pip_unsupported()}
			data-testid="control-pip"
		>
			<PictureInPicture2Icon aria-hidden />
		</Button>
	);
}

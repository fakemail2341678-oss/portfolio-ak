import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { CheckIcon, CircleAlertIcon, ExternalLinkIcon, Volume2Icon } from "lucide-react";
import { type ReactNode, useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { sessionQueryOptions } from "@/features/auth/queries";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { playSound } from "../board/sounds";
import { canConnect, connectionState, useConnectLichess } from "../connect/use-connect";
import { useDisconnectLichess } from "../connect/use-disconnect";
import type { ChaalFeature } from "../features";
import type { ConnectResult } from "../links";
import { chaalLinks } from "../links";
import { CHAAL_BOARD_THEMES } from "../look/board-themes";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import type { ChaalConnection } from "../schema";
import { chaalLocalKeys, clearChaalLocalData, subscribeLocal } from "./local";
import { CHAAL_NOTATIONS, type ChaalPreferences } from "./preferences";
import { useChaalPreferences } from "./use-preferences";

const route = getRouteApi("/_chaal/app/chaal/settings");

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const BOARD_NAMES: Readonly<Record<ChaalPreferences["board"], () => string>> = {
	diagram: m.ch_board_diagram,
	print: m.ch_board_print,
	stone: m.ch_board_stone,
};

const NOTATION_NAMES: Readonly<Record<ChaalPreferences["notation"], () => string>> = {
	figurine: m.ch_settings_notation_figurine,
	letters: m.ch_settings_notation_letters,
};

const RESULT_TEXT: Readonly<Record<ConnectResult, () => string>> = {
	connected: m.ch_connect_result_connected,
	denied: m.ch_connect_result_denied,
	taken: m.ch_connect_result_taken,
	blocked: m.ch_connect_result_blocked,
	off: m.ch_connect_result_off,
	expired: m.ch_connect_result_expired,
	failed: m.ch_connect_result_failed,
	"no-session": m.ch_connect_result_no_session,
};

const FEATURE_NAMES: Readonly<Record<ChaalFeature, () => string>> = {
	play: m.ch_feature_play,
	puzzles: m.ch_feature_puzzles,
	analysis: m.ch_feature_analysis,
	engine: m.ch_feature_engine,
	explorer: m.ch_feature_explorer,
	watch: m.ch_feature_watch,
	players: m.ch_feature_players,
	social: m.ch_feature_social,
	tournaments: m.ch_feature_tournaments,
	teams: m.ch_feature_teams,
	studies: m.ch_feature_studies,
	preferences: m.ch_feature_preferences,
};

/** A corner of the opening, enough to judge a board theme by. */
const SWATCH_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

function Section({
	id,
	title,
	description,
	children,
}: {
	id: string;
	title: string;
	description?: string;
	children: ReactNode;
}) {
	const headingId = `${id}-title`;
	return (
		<section id={id} aria-labelledby={headingId} className="ch-rule flex scroll-mt-20 flex-col gap-5 pt-4">
			<div className="flex flex-col gap-1">
				<h2 id={headingId} className="ch-display text-ch-head">
					{title}
				</h2>
				{description ? <p className="text-ch-muted text-sm">{description}</p> : null}
			</div>
			{children}
		</section>
	);
}

/** One on/off preference: the label and its line on the start, the switch on the end. */
function Toggle({
	label,
	description,
	checked,
	onChange,
	testId,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	testId: string;
}) {
	const id = useId();
	return (
		<div className="ch-hairline flex items-start justify-between gap-6 pb-4 last:border-b-0">
			<div className="flex flex-col gap-0.5">
				<Label htmlFor={id} className="font-medium text-base">
					{label}
				</Label>
				<p id={`${id}-description`} className="text-ch-muted text-sm">
					{description}
				</p>
			</div>
			<Switch
				id={id}
				checked={checked}
				onCheckedChange={onChange}
				aria-describedby={`${id}-description`}
				data-testid={testId}
			/>
		</div>
	);
}

function BoardSection({
	preferences,
	save,
}: {
	preferences: ChaalPreferences;
	save: (change: Partial<ChaalPreferences>) => void;
}) {
	return (
		<Section id="board" title={m.ch_settings_board_title()} description={m.ch_settings_board_description()}>
			<fieldset className="flex flex-col gap-3">
				<legend className="mb-3 font-medium">{m.ch_settings_board_theme()}</legend>
				<RadioGroup
					value={preferences.board}
					onValueChange={(value) => {
						const board = CHAAL_BOARD_THEMES.find((theme) => theme === value);
						if (board) save({ board });
					}}
					className="grid grid-cols-3 gap-3 sm:gap-5"
					data-testid="chaal-board-themes"
				>
					{CHAAL_BOARD_THEMES.map((theme) => {
						const id = `board-${theme}`;
						return (
							<Label
								key={theme}
								htmlFor={id}
								className="flex cursor-pointer flex-col items-stretch gap-2 border border-ch-hair bg-ch-plate p-2 has-[[data-state=checked]]:border-ch-ink has-[[data-state=checked]]:shadow-[inset_0_0_0_1px_var(--ch-ink)] sm:p-3"
							>
								<MiniBoard fen={SWATCH_FEN} theme={theme} coordinates={false} />
								<span className="flex items-center gap-2 font-medium">
									<RadioGroupItem id={id} value={theme} data-testid={`chaal-board-${theme}`} />
									{BOARD_NAMES[theme]()}
								</span>
							</Label>
						);
					})}
				</RadioGroup>
			</fieldset>
			<fieldset className="flex flex-col gap-3">
				<legend className="mb-3 font-medium">{m.ch_settings_notation()}</legend>
				<RadioGroup
					value={preferences.notation}
					onValueChange={(value) => {
						const notation = CHAAL_NOTATIONS.find((option) => option === value);
						if (notation) save({ notation });
					}}
					className="flex flex-wrap gap-x-8 gap-y-3"
				>
					{CHAAL_NOTATIONS.map((notation) => (
						<Label key={notation} className="flex cursor-pointer items-center gap-2 font-normal text-base">
							<RadioGroupItem value={notation} />
							{NOTATION_NAMES[notation]()}
							<span className="text-ch-muted" lang="en" dir="ltr">
								{notation === "figurine" ? "♘f3" : "Nf3"}
							</span>
						</Label>
					))}
				</RadioGroup>
			</fieldset>
			<Toggle
				label={m.ch_settings_coordinates()}
				description={m.ch_settings_coordinates_description()}
				checked={preferences.coordinates}
				onChange={(coordinates) => save({ coordinates })}
				testId="chaal-pref-coordinates"
			/>
		</Section>
	);
}

function MovesSection({
	preferences,
	save,
}: {
	preferences: ChaalPreferences;
	save: (change: Partial<ChaalPreferences>) => void;
}) {
	return (
		<Section id="moves" title={m.ch_settings_moves_title()} description={m.ch_settings_moves_description()}>
			<div className="flex flex-col gap-4">
				<Toggle
					label={m.ch_settings_auto_queen()}
					description={m.ch_settings_auto_queen_description()}
					checked={preferences.autoQueen}
					onChange={(autoQueen) => save({ autoQueen })}
					testId="chaal-pref-auto-queen"
				/>
				<Toggle
					label={m.ch_settings_premove()}
					description={m.ch_settings_premove_description()}
					checked={preferences.premove}
					onChange={(premove) => save({ premove })}
					testId="chaal-pref-premove"
				/>
				<Toggle
					label={m.ch_settings_confirm_moves()}
					description={m.ch_settings_confirm_moves_description()}
					checked={preferences.confirmMoves}
					onChange={(confirmMoves) => save({ confirmMoves })}
					testId="chaal-pref-confirm"
				/>
				<Toggle
					label={m.ch_settings_zen()}
					description={m.ch_settings_zen_description()}
					checked={preferences.zen}
					onChange={(zen) => save({ zen })}
					testId="chaal-pref-zen"
				/>
			</div>
		</Section>
	);
}

function SoundSection({
	preferences,
	save,
}: {
	preferences: ChaalPreferences;
	save: (change: Partial<ChaalPreferences>) => void;
}) {
	const [volume, setVolume] = useState<number | null>(null);
	const shown = volume ?? preferences.volume;
	return (
		<Section id="sound" title={m.ch_settings_sound_title()}>
			<div className="flex flex-col gap-4">
				<Toggle
					label={m.ch_settings_sounds()}
					description={m.ch_settings_sounds_description()}
					checked={preferences.sounds}
					onChange={(sounds) => save({ sounds })}
					testId="chaal-pref-sounds"
				/>
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between gap-4">
						<span className="font-medium">{m.ch_settings_volume()}</span>
						<span className="ch-figures text-ch-muted text-sm">{formatNumber(shown / 100, { style: "percent" })}</span>
					</div>
					<div className="flex items-center gap-4">
						<Slider
							thumbLabel={m.ch_settings_volume()}
							min={0}
							max={100}
							step={5}
							value={[shown]}
							disabled={!preferences.sounds}
							onValueChange={([next]) => setVolume(next ?? shown)}
							onValueCommit={([next]) => {
								setVolume(null);
								if (next !== undefined) save({ volume: next });
							}}
							className="flex-1"
						/>
						<Button
							variant="outline"
							size="sm"
							disabled={!preferences.sounds}
							onClick={() => playSound("move", shown)}
							className="shrink-0"
						>
							<Volume2Icon aria-hidden />
							{m.ch_settings_sound_try()}
						</Button>
					</div>
				</div>
			</div>
		</Section>
	);
}

function Scopes({ connection }: { connection: ChaalConnection }) {
	if (connection.scopes.length === 0) return <span className="text-ch-muted">{m.ch_settings_no_scopes()}</span>;
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label={m.ch_settings_scopes()}>
			{connection.scopes.map((scope) => (
				<li key={scope} className="border border-ch-hair px-1.5 py-0.5 font-mono text-xs" dir="ltr">
					{scope}
				</li>
			))}
		</ul>
	);
}

function ConnectionSection() {
	const { lichess: result } = route.useSearch();
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const { connect, pending } = useConnectLichess();
	const disconnect = useDisconnectLichess();
	const state = connectionState(connection);
	const allowed = canConnect(status);
	const guest = session?.isAnonymous === true;
	const profile = connection ? `https://lichess.org/@/${encodeURIComponent(connection.username)}` : null;

	return (
		<Section
			id="connection"
			title={m.ch_settings_connection_title()}
			description={m.ch_settings_connection_description()}
		>
			{result ? (
				<Alert data-testid="chaal-connect-result">
					{result === "connected" ? <CheckIcon aria-hidden /> : <CircleAlertIcon aria-hidden />}
					<AlertDescription className="text-ch-ink">{RESULT_TEXT[result]()}</AlertDescription>
				</Alert>
			) : null}
			{connection && profile ? (
				<dl className="flex flex-col" data-testid="chaal-connection">
					<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
						<dt className="text-ch-muted">{m.ch_settings_account()}</dt>
						<dd>
							<a
								href={profile}
								target="_blank"
								rel="nofollow ugc noopener"
								className={`inline-flex items-center gap-1 font-medium underline underline-offset-4 ${focusRing}`}
								dir="ltr"
								data-testid="chaal-connection-account"
							>
								{connection.title ? `${connection.title} ` : ""}
								{connection.username}
								<ExternalLinkIcon aria-hidden className="size-3.5" />
								<span className="sr-only">{m.ch_opens_new_tab()}</span>
							</a>
						</dd>
					</div>
					<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
						<dt className="text-ch-muted">{m.ch_settings_state()}</dt>
						<dd data-testid="chaal-connection-state-detail">
							{connection.revoked
								? m.ch_settings_state_revoked()
								: connection.needsScopesFor.length > 0
									? m.ch_settings_state_scopes({
											features: connection.needsScopesFor.map((feature) => FEATURE_NAMES[feature]()).join(", "),
										})
									: m.ch_settings_state_ok()}
						</dd>
					</div>
					<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
						<dt className="text-ch-muted">{m.ch_settings_scopes()}</dt>
						<dd>
							<Scopes connection={connection} />
						</dd>
					</div>
					<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-6">
						<dt className="text-ch-muted">{m.ch_settings_connected_at()}</dt>
						<dd>{formatDate(connection.connectedAt, { dateStyle: "long" })}</dd>
					</div>
				</dl>
			) : (
				<p data-testid="chaal-not-connected">{m.ch_settings_not_connected()}</p>
			)}
			{allowed ? null : <p className="text-ch-muted text-sm">{m.ch_settings_connect_off()}</p>}
			{guest && connection ? (
				<p className="text-ch-muted text-sm">
					{m.ch_settings_guest_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}{" "}
					<Link
						{...chaalLinks.signUp()}
						className={`font-medium text-ch-ink underline underline-offset-4 ${focusRing}`}
					>
						{m.guest_create_account()}
					</Link>
				</p>
			) : null}
			<div className="flex flex-wrap gap-3">
				{allowed && state !== "ok" ? (
					<Button onClick={() => void connect()} disabled={pending} data-testid="chaal-settings-connect">
						{state === "attention" ? m.ch_reconnect() : m.ch_connect()}
					</Button>
				) : null}
				{allowed && state === "ok" ? (
					<Button variant="outline" onClick={() => void connect()} disabled={pending}>
						{m.ch_reconnect()}
					</Button>
				) : null}
				{connection ? (
					<Button
						variant="outline"
						onClick={() => void disconnect.ask()}
						disabled={disconnect.pending}
						data-testid="chaal-settings-disconnect"
					>
						{m.ch_disconnect()}
					</Button>
				) : null}
			</div>
		</Section>
	);
}

/** On the server and during hydration nothing is known about this browser's storage. */
const noKeys = () => 0;
const keyCount = () => chaalLocalKeys().length;

function DeviceSection({ where }: { where: "account" | "device" }) {
	const confirm = useConfirm();
	const stored = useSyncExternalStore(subscribeLocal, keyCount, noKeys);
	const clear = async () => {
		const confirmed = await confirm({
			title: m.ch_settings_device_clear_title(),
			description: m.ch_settings_device_clear_description(),
			confirmLabel: m.ch_settings_device_clear(),
			destructive: true,
		});
		if (!confirmed) return;
		clearChaalLocalData();
		toast.success(m.ch_settings_device_cleared());
	};
	return (
		<Section id="device" title={m.ch_settings_device_title()}>
			<p>{where === "account" ? m.ch_settings_saved_account() : m.ch_settings_saved_device()}</p>
			<p className="text-ch-muted text-sm">{m.ch_settings_device_body()}</p>
			<div>
				<Button
					variant="outline"
					onClick={() => void clear()}
					disabled={stored === 0}
					data-testid="chaal-settings-clear-device"
				>
					{m.ch_settings_device_clear()}
				</Button>
			</div>
		</Section>
	);
}

/**
 * /app/chaal/settings (PLAN Task 73): the board, moves and sound, saved as soon as they
 * change (to the account with a session, else to this browser); the Lichess connection,
 * its scopes, Reconnect and Disconnect; and deleting what this browser keeps. Noindex.
 */
export function ChaalSettings() {
	const { preferences, save, where } = useChaalPreferences();
	const [announce, setAnnounce] = useState("");
	const change = (next: Partial<ChaalPreferences>) => {
		void save(next).then((saved) => {
			if (saved) setAnnounce(where === "account" ? m.ch_settings_saved_to_account() : m.ch_settings_saved_here());
		});
	};
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-settings">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 pt-10 pb-16 sm:px-6 lg:pt-14">
				<header className="flex flex-col gap-3">
					<h1 className="ch-display text-ch-title">{m.ch_settings_title()}</h1>
					<p className="text-ch-muted text-lg">
						{where === "account" ? m.ch_settings_intro_account() : m.ch_settings_intro_device()}
					</p>
				</header>
				<output className="sr-only">{announce}</output>
				<BoardSection preferences={preferences} save={change} />
				<MovesSection preferences={preferences} save={change} />
				<SoundSection preferences={preferences} save={change} />
				<ConnectionSection />
				<DeviceSection where={where} />
			</div>
		</main>
	);
}

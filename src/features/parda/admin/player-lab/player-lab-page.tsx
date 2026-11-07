import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { errorMessage } from "@/components/errors/error-page";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { ADAPTERS } from "../../player/adapters";
import type { PlayerCommand, PlayerEvent } from "../../player/adapters/types";
import { PlayerFrame } from "../../player/player-frame";
import { createStallDetector, type StallSummary } from "../../player/stall";
import { openLabPlayerMutationOptions, pardaLabSourcesQueryOptions } from "../queries";
import { type LabPlayer, type LabPlayerInput, PLACEHOLDER_CUES, type PlaceholderCue } from "../schema";

const route = getRouteApi("/_admin/admin/parda/player-lab");

/** A sample id: the placeholder player doesn't look it up. */
const SAMPLE_ID = 550;
const LOG_LIMIT = 200;
const TICK_MS = 250;

const CUE_LABELS: Readonly<Record<PlaceholderCue, () => string>> = {
	fail: m.pd_lab_cue_fail,
	stall: m.pd_lab_cue_stall,
	silent: m.pd_lab_cue_silent,
};

const numberField = (form: FormData, name: string) => Number(form.get(name));

function NumberField({ name, label, value, min }: { name: string; label: string; value: number; min: number }) {
	const id = useId();
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<Input id={id} name={name} type="number" min={min} defaultValue={value} required inputMode="numeric" />
		</div>
	);
}

/** One loaded player: remounted for each load, so its log and counters start clean. */
function LabPlayerPane({ player }: { player: LabPlayer }) {
	const frameRef = useRef<HTMLIFrameElement>(null);
	const [detector] = useState(createStallDetector);
	const [log, setLog] = useState<ReadonlyArray<{ seq: number; event: PlayerEvent }>>([]);
	const [position, setPosition] = useState<number | null>(null);
	const [stall, setStall] = useState<StallSummary>({ stalled: false, count: 0, ms: 0 });
	const adapter = ADAPTERS[player.adapter];
	const name = localizedValue(player.name);

	useEffect(() => {
		const timer = setInterval(() => {
			const now = performance.now();
			detector.tick(now);
			setStall(detector.summary(now));
		}, TICK_MS);
		return () => clearInterval(timer);
	}, [detector]);

	const onEvent = (event: PlayerEvent) => {
		detector.observe(event, performance.now());
		if (event.kind === "position") {
			// Four or more a second: the clock shows them, and the log would drown in them.
			setPosition(event.position);
			return;
		}
		setLog((rows) => [{ seq: (rows[0]?.seq ?? 0) + 1, event }, ...rows].slice(0, LOG_LIMIT));
	};

	const send = (command: PlayerCommand) => {
		const message = adapter.command?.(command);
		const frame = frameRef.current?.contentWindow;
		if (!message || !frame) return;
		detector.noteCommand(performance.now());
		frame.postMessage(message, new URL(player.url, window.location.origin).origin);
	};

	return (
		<section aria-label={name} className="grid gap-4">
			<PlayerFrame
				url={player.url}
				origins={player.origins}
				adapter={adapter}
				sandbox={player.sandbox}
				title={m.pd_lab_frame_title({ name })}
				frameRef={frameRef}
				onEvent={onEvent}
				target={player.target}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={stall.stalled ? "destructive" : "secondary"}>
					{stall.stalled ? m.pd_lab_stalled() : m.pd_lab_not_stalled()}
				</Badge>
				<span className="text-muted-foreground text-sm tabular-nums">
					{m.pd_lab_stall_counts({ count: formatNumber(stall.count), seconds: formatNumber(stall.ms / 1000) })}
				</span>
				<span className="text-muted-foreground text-sm tabular-nums" data-testid="pd-lab-position">
					{position === null ? m.pd_lab_no_position() : m.pd_lab_position({ seconds: formatNumber(position) })}
				</span>
				{adapter.command ? (
					<div className="ms-auto flex gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => send({ action: "play" })}>
							{m.pd_lab_play()}
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={() => send({ action: "pause" })}>
							{m.pd_lab_pause()}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => send({ action: "seek", position: (position ?? 0) + 60 })}
						>
							{m.pd_lab_seek()}
						</Button>
					</div>
				) : (
					<span className="ms-auto text-muted-foreground text-sm">{m.pd_lab_no_commands()}</span>
				)}
			</div>
			<div className="grid gap-2">
				<h2 className="font-medium text-sm">{m.pd_lab_log()}</h2>
				{log.length === 0 ? (
					<p className="text-muted-foreground text-sm">{m.pd_lab_log_empty()}</p>
				) : (
					<ScrollRegion
						label={m.pd_lab_log()}
						className="max-h-64 overflow-y-auto rounded-md border p-3 font-mono text-xs"
						data-testid="pd-lab-log"
					>
						<ol>
							{log.map((row) => (
								<li key={row.seq} dir="ltr">
									{JSON.stringify(row.event)}
								</li>
							))}
						</ol>
					</ScrollRegion>
				)}
			</div>
		</section>
	);
}

/** /admin/parda/player-lab: loads any source, enabled or not, and shows what it reports. */
export function PlayerLabPage() {
	const { data: sources } = useSuspenseQuery(pardaLabSourcesQueryOptions());
	// "Test in the lab" on the sources page names the row to start from.
	const { source: picked } = route.useSearch();
	const open = useMutation(openLabPlayerMutationOptions());
	const [load, setLoad] = useState(0);
	const sourceId = useId();
	const mediaId = useId();
	const cueId = useId();

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const cue = String(form.get("cue"));
		const input: LabPlayerInput = {
			sourceId: String(form.get("source")),
			media: form.get("media") === "tv" ? "tv" : "movie",
			id: numberField(form, "id"),
			season: numberField(form, "season"),
			episode: numberField(form, "episode"),
			start: numberField(form, "start"),
			cue: PLACEHOLDER_CUES.find((known) => known === cue) ?? null,
		};
		open.mutate(input, { onSuccess: () => setLoad((count) => count + 1) });
	};

	return (
		<Page width="admin">
			<PageHeader title={m.pd_lab_title()} description={m.pd_lab_description()} />
			<form method="post" onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="grid gap-1.5 sm:col-span-2">
					<Label htmlFor={sourceId}>{m.pd_lab_source()}</Label>
					<NativeSelect
						id={sourceId}
						name="source"
						required
						defaultValue={sources.some((source) => source.id === picked) ? picked : undefined}
					>
						{sources.map((source) => (
							<option key={source.id} value={source.id}>
								{source.enabled
									? localizedValue(source.name)
									: m.pd_lab_source_disabled({ name: localizedValue(source.name) })}
							</option>
						))}
					</NativeSelect>
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor={mediaId}>{m.pd_lab_media()}</Label>
					<NativeSelect id={mediaId} name="media" defaultValue="movie">
						<option value="movie">{m.pd_lab_media_movie()}</option>
						<option value="tv">{m.pd_lab_media_tv()}</option>
					</NativeSelect>
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor={cueId}>{m.pd_lab_cue()}</Label>
					<NativeSelect id={cueId} name="cue" defaultValue="">
						<option value="">{m.pd_lab_cue_none()}</option>
						{PLACEHOLDER_CUES.map((cue) => (
							<option key={cue} value={cue}>
								{CUE_LABELS[cue]()}
							</option>
						))}
					</NativeSelect>
				</div>
				<NumberField name="id" label={m.pd_lab_tmdb_id()} value={SAMPLE_ID} min={1} />
				<NumberField name="season" label={m.pd_lab_season()} value={1} min={0} />
				<NumberField name="episode" label={m.pd_lab_episode()} value={1} min={1} />
				<NumberField name="start" label={m.pd_lab_start()} value={0} min={0} />
				<div className="sm:col-span-2 lg:col-span-4">
					<Button type="submit" disabled={open.isPending || sources.length === 0}>
						{m.pd_lab_load()}
					</Button>
				</div>
			</form>
			{open.isError ? (
				<Alert variant="destructive">
					<AlertDescription>{errorMessage(open.error)}</AlertDescription>
				</Alert>
			) : null}
			{open.data ? <LabPlayerPane key={load} player={open.data} /> : null}
		</Page>
	);
}

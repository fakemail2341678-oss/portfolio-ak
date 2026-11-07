import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/data-display/copy-button";
import { DescriptionList } from "@/components/data-display/description-list";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { StatusBadge } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Page, PageHeader } from "@/components/page/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";
import { chaalKeys } from "../../keys";
import { CHAAL_EVENT_STREAM, type ConnectResult, connectHref } from "../../links";
import type { ChaalEvent } from "../../live/events";
import { ndjsonLines, parseLine } from "../../live/ndjson";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions, disconnectChaalMutationOptions } from "../../queries";
import type { ChaalConnection } from "../../schema";
import { chaalLabQueryOptions, checkPublicLaneMutationOptions } from "../queries";

const route = getRouteApi("/_admin/admin/chaal/lab");

const LAB_PATH = "/admin/chaal/lab";
const EVENT_LIMIT = 50;

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2>{title}</h2>
				</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">{children}</CardContent>
		</Card>
	);
}

const yesNo = (on: boolean, yes: string, no: string) => (
	<StatusBadge tone={on ? "success" : "neutral"}>{on ? yes : no}</StatusBadge>
);

function Scopes({ scopes }: { scopes: ReadonlyArray<string> }) {
	if (scopes.length === 0) return <span className="text-muted-foreground">{m.ch_lab_no_scopes()}</span>;
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label={m.ch_lab_scopes()}>
			{scopes.map((scope) => (
				<li key={scope}>
					<Badge variant="secondary" className="font-mono" dir="ltr">
						{scope}
					</Badge>
				</li>
			))}
		</ul>
	);
}

/** The setup on this server: never a key or token, only whether one is set. */
function SetupSection() {
	const { data: lab } = useSuspenseQuery(chaalLabQueryOptions());
	const { setup } = lab;
	return (
		<Section title={m.ch_lab_setup_title()} description={m.ch_lab_setup_description()}>
			{/* Stacked: the labels name env variables, too wide to sit beside the scopes on a tablet. */}
			<DescriptionList
				layout="stacked"
				items={[
					{
						label: m.ch_lab_token_key(),
						value: (
							<span className="flex flex-wrap items-center gap-2">
								{yesNo(setup.tokenKey, m.ch_lab_set(), m.ch_lab_not_set())}
								{setup.keyId ? (
									<span className="text-muted-foreground text-sm">
										{m.ch_lab_key_id()} <code dir="ltr">{setup.keyId}</code>
									</span>
								) : null}
							</span>
						),
						testId: "ch-lab-token-key",
					},
					{
						label: m.ch_lab_app_token(),
						value: yesNo(setup.appToken, m.ch_lab_set(), m.ch_lab_not_set()),
					},
					{ label: m.ch_lab_client_id(), value: <code dir="ltr">{setup.clientId}</code> },
					{ label: m.ch_lab_api_base(), value: <code dir="ltr">{setup.apiBase}</code> },
					{
						label: m.ch_lab_redirect_uri(),
						value: (
							<span className="flex min-w-0 items-center gap-2">
								<code dir="ltr" className="min-w-0 break-all">
									{setup.redirectUri}
								</code>
								<CopyButton value={setup.redirectUri} label={m.ch_lab_copy_redirect_uri()} />
							</span>
						),
					},
					{ label: m.ch_lab_scopes_asked(), value: <Scopes scopes={lab.scopes} /> },
					{
						label: m.ch_lab_stream_window(),
						value: m.ch_lab_seconds({ seconds: formatNumber(lab.streamWindowSeconds) }),
					},
					{
						label: m.ch_lab_public_cooldown(),
						value: lab.publicCooldownUntil
							? m.ch_lab_cooldown_until({ time: formatDateTime(lab.publicCooldownUntil) })
							: m.ch_lab_no_cooldown(),
					},
				]}
			/>
		</Section>
	);
}

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

function ConnectionDetails({ connection }: { connection: ChaalConnection }) {
	const profile = `https://lichess.org/@/${encodeURIComponent(connection.username)}`;
	return (
		<DescriptionList
			items={[
				{
					label: m.ch_lab_account(),
					value: (
						<a
							href={profile}
							target="_blank"
							rel="nofollow ugc noopener"
							className="font-medium underline-offset-4 hover:underline"
							dir="ltr"
						>
							{connection.title ? `${connection.title} ` : ""}
							{connection.username}
						</a>
					),
					testId: "ch-lab-account",
				},
				{
					label: m.ch_lab_state(),
					value: connection.revoked ? (
						<StatusBadge tone="danger">{m.ch_lab_state_revoked()}</StatusBadge>
					) : connection.needsScopesFor.length > 0 ? (
						<StatusBadge tone="warning">
							{m.ch_lab_state_scopes({ features: connection.needsScopesFor.join(", ") })}
						</StatusBadge>
					) : (
						<StatusBadge tone="success">{m.ch_lab_state_ok()}</StatusBadge>
					),
					testId: "ch-lab-state",
				},
				{ label: m.ch_lab_scopes(), value: <Scopes scopes={connection.scopes} /> },
				{ label: m.ch_lab_connected_at(), value: formatDateTime(connection.connectedAt) },
				{
					label: m.ch_lab_expires_at(),
					value: connection.expiresAt ? formatDateTime(connection.expiresAt) : m.ch_lab_never(),
				},
			]}
		/>
	);
}

/** The admin's own Lichess connection: connect, see it, disconnect. */
function ConnectionSection() {
	const { lichess: result } = route.useSearch();
	const { data: connection } = useSuspenseQuery(chaalConnectionQueryOptions());
	const { data: status } = useSuspenseQuery(chaalStatusQueryOptions());
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const disconnect = useMutation({
		...disconnectChaalMutationOptions(),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: chaalKeys.connection() });
			toast.success(m.ch_disconnected());
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const connectUrl = connectHref(localizeHref(LAB_PATH));
	const canConnect = status.connect === "on";

	const askDisconnect = async () => {
		if (
			await confirm({
				title: m.ch_disconnect_title(),
				description: m.ch_disconnect_description(),
				confirmLabel: m.ch_disconnect(),
				destructive: true,
			})
		) {
			disconnect.mutate();
		}
	};

	const connectButton = (label: string) =>
		canConnect ? (
			<Button asChild variant={connection ? "outline" : "default"}>
				<a href={connectUrl}>{label}</a>
			</Button>
		) : (
			<Button disabled>{label}</Button>
		);

	return (
		<Section title={m.ch_lab_connection_title()} description={m.ch_lab_connection_description()}>
			{result ? (
				<Alert variant={result === "connected" ? "success" : "warning"} data-testid="ch-lab-result">
					<AlertDescription>{RESULT_TEXT[result]()}</AlertDescription>
				</Alert>
			) : null}
			{connection ? (
				<ConnectionDetails connection={connection} />
			) : (
				<p className="text-muted-foreground" data-testid="ch-lab-not-connected">
					{m.ch_lab_not_connected()}
				</p>
			)}
			{canConnect ? null : <p className="text-muted-foreground text-sm">{m.ch_lab_connect_off()}</p>}
			<div className="flex flex-wrap gap-2">
				{connection ? connectButton(m.ch_reconnect()) : connectButton(m.ch_connect())}
				{connection ? (
					<Button variant="outline" onClick={askDisconnect} disabled={disconnect.isPending}>
						{m.ch_disconnect()}
					</Button>
				) : null}
			</div>
		</Section>
	);
}

/** An event as the log shows it: numbered, newest first. */
type LoggedEvent = { seq: number; event: ChaalEvent };

type StreamState =
	| { kind: "idle" }
	| { kind: "opening" }
	| { kind: "open"; firstByteMs: number; openedAt: number; keepalives: number; events: LoggedEvent[] }
	| { kind: "closed"; by: "server" | "lichess" | "you"; seconds: number; keepalives: number; events: LoggedEvent[] }
	| { kind: "refused"; status: number; reason: string | null };

/** Seconds since `since`, ticking once a second while shown. */
function useElapsed(since: number | null) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (since === null) return;
		const timer = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(timer);
	}, [since]);
	return since === null ? 0 : Math.max(0, Math.round((now - since) / 1000));
}

/** Opens the event stream through our server and times it: how soon it answers, and how long until the server closes it. */
function StreamSection() {
	const { data: connection } = useSuspenseQuery(chaalConnectionQueryOptions());
	const queryClient = useQueryClient();
	const [state, setState] = useState<StreamState>({ kind: "idle" });
	const abort = useRef<AbortController | null>(null);
	const elapsed = useElapsed(state.kind === "open" ? state.openedAt : null);

	useEffect(() => () => abort.current?.abort(), []);

	const open = async () => {
		const controller = new AbortController();
		abort.current = controller;
		const started = performance.now();
		const openedAt = Date.now();
		let keepalives = 0;
		let events: LoggedEvent[] = [];
		const closed = (by: "server" | "lichess" | "you") =>
			setState({ kind: "closed", by, seconds: Math.round((Date.now() - openedAt) / 1000), keepalives, events });
		setState({ kind: "opening" });
		try {
			const response = await fetch(CHAAL_EVENT_STREAM, {
				signal: controller.signal,
				headers: { accept: "application/x-ndjson" },
			});
			if (!response.ok || !response.body) {
				const body = (await response.json().catch(() => ({}))) as { reason?: string };
				setState({ kind: "refused", status: response.status, reason: body.reason ?? null });
				// A refused token is now marked revoked: show it.
				if (body.reason === "lichess-reconnect")
					await queryClient.invalidateQueries({ queryKey: chaalKeys.connection() });
				return;
			}
			setState({ kind: "open", firstByteMs: Math.round(performance.now() - started), openedAt, keepalives, events });
			for await (const text of ndjsonLines(response.body)) {
				const event = parseLine(text) as ChaalEvent | undefined;
				if (event?.type === "reconnect") return closed("server");
				if (event) events = [{ seq: (events[0]?.seq ?? 0) + 1, event }, ...events].slice(0, EVENT_LIMIT);
				else keepalives += 1;
				setState((current) => (current.kind === "open" ? { ...current, keepalives, events } : current));
			}
			closed("lichess");
		} catch {
			closed(controller.signal.aborted ? "you" : "lichess");
		}
	};

	const events = state.kind === "open" || state.kind === "closed" ? state.events : [];

	return (
		<Section title={m.ch_lab_stream_title()} description={m.ch_lab_stream_description()}>
			<div className="flex flex-wrap items-center gap-2">
				{state.kind === "open" || state.kind === "opening" ? (
					<Button variant="outline" onClick={() => abort.current?.abort()}>
						{m.ch_lab_stream_stop()}
					</Button>
				) : (
					<Button onClick={() => void open()} disabled={!connection}>
						{m.ch_lab_stream_open()}
					</Button>
				)}
				{connection ? null : (
					<span className="text-muted-foreground text-sm">{m.ch_lab_stream_needs_connection()}</span>
				)}
			</div>
			<p className="text-body" aria-live="polite" data-testid="ch-lab-stream-state">
				{state.kind === "idle"
					? m.ch_lab_stream_idle()
					: state.kind === "opening"
						? m.ch_lab_stream_opening()
						: state.kind === "open"
							? m.ch_lab_stream_open_state({ ms: formatNumber(state.firstByteMs) })
							: state.kind === "refused"
								? m.ch_lab_stream_refused({ status: String(state.status) })
								: state.by === "server"
									? m.ch_lab_stream_closed_server({ seconds: formatNumber(state.seconds) })
									: state.by === "you"
										? m.ch_lab_stream_closed_you({ seconds: formatNumber(state.seconds) })
										: m.ch_lab_stream_closed_lichess({ seconds: formatNumber(state.seconds) })}
			</p>
			{state.kind === "open" ? (
				<p className="text-muted-foreground text-sm tabular-nums" data-testid="ch-lab-stream-counts">
					{m.ch_lab_stream_counts({ seconds: formatNumber(elapsed), keepalives: formatNumber(state.keepalives) })}
				</p>
			) : null}
			<div className="grid gap-2">
				<h3 className="font-medium text-sm">{m.ch_lab_stream_events()}</h3>
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">{m.ch_lab_stream_no_events()}</p>
				) : (
					<ScrollRegion
						label={m.ch_lab_stream_events()}
						className="max-h-64 overflow-y-auto rounded-md border p-3 font-mono text-xs"
						data-testid="ch-lab-events"
					>
						<ol className="grid gap-1">
							{events.map((row) => (
								<li key={row.seq} dir="ltr" className="break-all">
									{JSON.stringify(row.event)}
								</li>
							))}
						</ol>
					</ScrollRegion>
				)}
			</div>
		</Section>
	);
}

/** This server's Lichess calls, and a check of the public lane through the client and the cache. */
function CallsSection() {
	const { data: lab } = useSuspenseQuery(chaalLabQueryOptions());
	const queryClient = useQueryClient();
	const check = useMutation({
		...checkPublicLaneMutationOptions(),
		onSettled: () => queryClient.invalidateQueries({ queryKey: chaalKeys.lab() }),
	});
	return (
		<Section title={m.ch_lab_calls_title()} description={m.ch_lab_calls_description()}>
			<div className="flex flex-wrap items-center gap-3">
				<Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
					{m.ch_lab_check_lane()}
				</Button>
				<span aria-live="polite" className="text-sm" data-testid="ch-lab-lane">
					{check.data
						? m.ch_lab_lane_ok({ id: check.data.puzzleId, ms: formatNumber(check.data.ms) })
						: check.error
							? errorMessage(check.error)
							: null}
				</span>
			</div>
			{lab.counters.length === 0 ? (
				<p className="text-muted-foreground text-sm">{m.ch_lab_no_calls()}</p>
			) : (
				<ScrollRegion label={m.ch_lab_calls_title()} className="overflow-x-auto">
					{/* A plain table: the region scrolls and is focusable; shadcn's <Table> would add a second, unfocusable scroller. */}
					<table className="w-full caption-bottom text-sm">
						<TableHeader>
							<TableRow>
								<TableHead>{m.ch_lab_endpoint()}</TableHead>
								<TableHead className="text-end">{m.ch_lab_calls()}</TableHead>
								<TableHead className="text-end">{m.ch_lab_errors()}</TableHead>
								<TableHead className="text-end">{m.ch_lab_rate_limited()}</TableHead>
								<TableHead className="text-end">{m.ch_lab_average_ms()}</TableHead>
								<TableHead className="text-end">{m.ch_lab_last_status()}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{lab.counters.map((row) => (
								<TableRow key={row.endpoint}>
									<TableCell className="font-mono text-xs" dir="ltr">
										{row.endpoint}
									</TableCell>
									<TableCell className="text-end tabular-nums">{formatNumber(row.calls)}</TableCell>
									<TableCell className="text-end tabular-nums">{formatNumber(row.errors)}</TableCell>
									<TableCell className="text-end tabular-nums">{formatNumber(row.rateLimited)}</TableCell>
									<TableCell className="text-end tabular-nums">{formatNumber(row.avgMs)}</TableCell>
									<TableCell className="text-end tabular-nums">{row.lastStatus || m.ch_lab_no_answer()}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</table>
				</ScrollRegion>
			)}
		</Section>
	);
}

/** /admin/chaal/lab (Task 71): connect Lichess, see the account and scopes, open and time the event stream. */
export function ChaalLabPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.ch_lab_title()} description={m.ch_lab_description()} />
			{/* One track that may shrink: the calls table scrolls inside its region instead of widening every card. */}
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6">
				<ConnectionSection />
				<StreamSection />
				<SetupSection />
				<CallsSection />
			</div>
		</Page>
	);
}

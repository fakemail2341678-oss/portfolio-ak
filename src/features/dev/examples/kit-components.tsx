import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BoldIcon, CheckCircle2Icon, InboxIcon, InfoIcon, ListChecksIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AreaChart, BarChart, DonutChart } from "@/components/charts";
import { ActivityFeed } from "@/components/data-display/activity-feed";
import { CopyButton } from "@/components/data-display/copy-button";
import { DescriptionList } from "@/components/data-display/description-list";
import { RelativeTime } from "@/components/data-display/relative-time";
import { StatCard } from "@/components/data-display/stat-card";
import { defineStatuses, StatusOf } from "@/components/data-display/status-badge";
import { UserCell } from "@/components/data-display/user-avatar";
import { useConfirm } from "@/components/dialogs/confirm";
import { FormDialog, FormSheet } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { EmptyState } from "@/components/page/empty-state";
import { DetailLayout } from "@/components/page/layouts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHotkeyLabel, useHotkeys } from "@/hooks/use-hotkeys";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatNumber, formatWeekdayShort } from "@/lib/i18n/intl";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { Demo, ExamplePage } from "./example-page";
import { PRIORITY_LABELS } from "./labels";
import { kitComponentsQueryOptions } from "./queries";
import type { ExampleTask } from "./schema";

/**
 * /dev/examples/components: every component of the admin kit (decision 0168),
 * on the example tasks. Each card names the component; the source of each is in
 * src/components (see docs/guides/design-system.md, "Components").
 */
/** Proper names for the sample activity (data, not UI text). */
const PEOPLE = [
	{ name: "Sita Rai", email: "sita@example.com" },
	{ name: "Ram Thapa", email: "ram@example.com" },
	{ name: "Gita Gurung", email: "gita@example.com" },
] as const;

const TASK_STATUS = defineStatuses<"open" | "done">({
	open: { tone: "info", label: m.examples_open },
	done: { tone: "success", label: m.examples_done },
});

/** Monday 5 January 2026 onwards: weekday labels from Intl, the same on the server and in the browser. */
const weekdays = () => Array.from({ length: 7 }, (_, day) => formatWeekdayShort(new Date(2026, 0, 5 + day)));
const CREATED = [4, 7, 5, 9, 12, 6, 3];
const DONE = [2, 5, 4, 6, 9, 5, 2];

export function KitComponentsExample() {
	const { data } = useSuspenseQuery(kitComponentsQueryOptions());
	const tasks = data.items;
	// The newest task is "now" for the server and the first browser render (RelativeTime).
	const now = tasks.reduce(
		(latest, task) => (task.createdAt > latest ? task.createdAt : latest),
		"1970-01-01T00:00:00Z",
	);
	return (
		<ExamplePage slug="components">
			<StatsAndCharts tasks={tasks} />
			<DataDisplay tasks={tasks} now={now} />
			<Dialogs />
			<Hooks />
			<Primitives />
		</ExamplePage>
	);
}

function StatsAndCharts({ tasks }: { tasks: ReadonlyArray<ExampleTask> }) {
	const [kind, setKind] = useState<"area" | "bar">("area");
	const done = tasks.filter((task) => task.done).length;
	const days = weekdays();
	const week = days.map((day, index) => ({ day, created: CREATED[index] ?? 0, done: DONE[index] ?? 0 }));
	const series = [
		{ key: "created", label: m.kit_series_created() },
		{ key: "done", label: m.kit_series_done() },
	];
	const byPriority = (["low", "medium", "high"] as const).map((priority) => ({
		priority: PRIORITY_LABELS[priority](),
		count: tasks.filter((task) => task.priority === priority).length,
	}));
	return (
		<Demo title={m.kit_stats_title()} note={m.kit_stats_note()}>
			<div className="grid gap-3 sm:grid-cols-3">
				<StatCard
					label={m.kit_stat_created()}
					value={CREATED.reduce((sum, value) => sum + value, 0)}
					icon={ListChecksIcon}
					delta={{ value: 3, label: m.dashboard_this_week() }}
					trend={CREATED}
				/>
				<StatCard
					label={m.kit_stat_done()}
					value={done}
					icon={CheckCircle2Icon}
					delta={{ value: -1, label: m.dashboard_this_week() }}
					trend={DONE}
				/>
				<StatCard label={m.kit_stat_open()} value={tasks.length - done} icon={InboxIcon} trend={[5, 5, 5, 5]} />
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-heading">{m.kit_chart_week()}</h3>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					value={kind}
					onValueChange={(value) => value && setKind(value === "bar" ? "bar" : "area")}
					aria-label={m.kit_chart_kind()}
				>
					<ToggleGroupItem value="area">{m.kit_chart_area()}</ToggleGroupItem>
					<ToggleGroupItem value="bar">{m.kit_chart_bar()}</ToggleGroupItem>
				</ToggleGroup>
			</div>
			{kind === "area" ? (
				<AreaChart label={m.kit_chart_week()} data={week} index="day" series={series} />
			) : (
				<BarChart label={m.kit_chart_week()} data={week} index="day" series={series} />
			)}
			<div className="grid gap-6 sm:grid-cols-2">
				<DonutChart
					label={m.kit_chart_priority()}
					data={byPriority}
					index="priority"
					series={[{ key: "count", label: m.kit_series_tasks() }]}
				/>
				<BarChart
					label={m.kit_chart_priority()}
					data={byPriority}
					index="priority"
					series={[{ key: "count", label: m.kit_series_tasks() }]}
				/>
			</div>
		</Demo>
	);
}

function DataDisplay({ tasks, now }: { tasks: ReadonlyArray<ExampleTask>; now: string }) {
	const [first] = tasks;
	return (
		<Demo title={m.kit_display_title()} note={m.kit_display_note()}>
			<DetailLayout
				aside={
					<section className="flex flex-col gap-3 rounded-lg border bg-surface-1 p-4">
						<h3 className="text-heading">{m.kit_detail_aside()}</h3>
						{first ? (
							<DescriptionList
								layout="stacked"
								items={[
									{
										label: m.examples_status(),
										value: <StatusOf status={first.done ? "done" : "open"} map={TASK_STATUS} />,
									},
									{ label: m.examples_priority(), value: PRIORITY_LABELS[first.priority]() },
									{ label: m.examples_created(), value: <RelativeTime value={first.createdAt} now={now} /> },
									{
										label: m.kit_detail_id(),
										value: (
											<span className="inline-flex min-w-0 items-center gap-1 font-mono text-caption">
												<span className="truncate">{first.id}</span>
												<CopyButton value={first.id} label={m.kit_copy_id()} />
											</span>
										),
									},
								]}
							/>
						) : null}
					</section>
				}
			>
				<h3 className="text-heading">{m.kit_activity()}</h3>
				<ActivityFeed
					now={now}
					events={tasks.slice(0, 5).map((task, index) => ({
						id: task.id,
						actor: PEOPLE[index % PEOPLE.length] ?? PEOPLE[0],
						action: task.done ? m.kit_activity_done() : m.kit_activity_created(),
						target: task.title,
						at: task.createdAt,
					}))}
				/>
				<h3 className="text-heading">{m.kit_people()}</h3>
				<ul className="flex flex-col gap-3">
					{PEOPLE.map((person) => (
						<li key={person.email} className="flex items-center justify-between gap-3">
							<UserCell name={person.name} email={person.email} />
							<HoverCard>
								<HoverCardTrigger asChild>
									<Link to="/dev/examples" className="text-caption underline underline-offset-4">
										{m.kit_hover_more()}
									</Link>
								</HoverCardTrigger>
								<HoverCardContent className="w-64">
									<UserCell name={person.name} email={person.email} detail={m.kit_hover_detail()} />
								</HoverCardContent>
							</HoverCard>
						</li>
					))}
				</ul>
			</DetailLayout>
			<div className="grid gap-3 md:grid-cols-2">
				<EmptyState
					icon={InboxIcon}
					title={m.kit_empty_title()}
					description={m.kit_empty_body()}
					primaryAction={<Button size="sm">{m.kit_empty_create()}</Button>}
					secondaryAction={
						<Button size="sm" variant="ghost" asChild>
							<Link to="/dev/examples">{m.kit_empty_learn()}</Link>
						</Button>
					}
				/>
				<EmptyState
					variant="no-matches"
					description={m.kit_no_matches()}
					primaryAction={
						<Button size="sm" variant="outline">
							{m.filters_clear_all()}
						</Button>
					}
				/>
			</div>
		</Demo>
	);
}

const nameSchema = () => z.object({ name: required({ max: 60 }) });

function Dialogs() {
	const confirm = useConfirm();
	const [open, setOpen] = useState<"dialog" | "sheet" | null>(null);
	useHotkeys({ "mod+j": () => setOpen("sheet") });
	const shortcut = useHotkeyLabel("mod+j");
	const ask = async () => {
		const confirmed = await confirm({
			title: m.kit_confirm_title(),
			description: m.kit_confirm_body(),
			confirmLabel: m.examples_delete(),
			destructive: true,
		});
		toast(confirmed ? m.kit_confirm_yes() : m.kit_confirm_no());
	};
	return (
		<Demo title={m.kit_dialogs_title()} note={m.kit_dialogs_note()}>
			<div className="flex flex-wrap items-center gap-2">
				<Button variant="destructive" onClick={() => void ask()}>
					{m.kit_confirm_open()}
				</Button>
				<Button variant="outline" onClick={() => setOpen("dialog")}>
					{m.kit_form_dialog()}
				</Button>
				<Button variant="outline" onClick={() => setOpen("sheet")}>
					{m.kit_form_sheet()}
					<Kbd className="w-12" aria-hidden>
						{shortcut}
					</Kbd>
				</Button>
			</div>
			{open ? <NameForm kind={open} onClose={() => setOpen(null)} /> : null}
		</Demo>
	);
}

function NameForm({ kind, onClose }: { kind: "dialog" | "sheet"; onClose: () => void }) {
	const form = useAppForm({
		defaultValues: { name: "" },
		validators: formValidators(nameSchema()),
		onSubmit: ({ value }) => {
			toast.success(m.kit_form_saved({ name: value.name }));
			onClose();
		},
	});
	const Overlay = kind === "dialog" ? FormDialog : FormSheet;
	return (
		<form.AppForm>
			<Overlay
				title={kind === "dialog" ? m.kit_form_dialog() : m.kit_form_sheet()}
				description={m.kit_form_description()}
				submitLabel={m.kit_form_save()}
				onClose={onClose}
				data-testid={`kit-form-${kind}`}
			>
				<form.AppField name="name">{(field) => <field.TextField label={m.examples_forms_name()} />}</form.AppField>
			</Overlay>
		</form.AppForm>
	);
}

function Hooks() {
	const [text, setText] = useState("");
	const debounced = useDebouncedValue(text, 400);
	const wide = useMediaQuery("(min-width: 1024px)");
	return (
		<Demo title={m.kit_hooks_title()} note={m.kit_hooks_note()}>
			<div className="flex max-w-md flex-col gap-2">
				<Input
					value={text}
					onChange={(event) => setText(event.target.value)}
					aria-label={m.kit_hooks_type()}
					placeholder={m.kit_hooks_type()}
				/>
				<DescriptionList
					items={[
						{ label: m.kit_hooks_debounced(), value: debounced || "—", testId: "debounced" },
						{ label: m.kit_hooks_media(), value: wide ? m.audit_value_yes() : m.audit_value_no() },
					]}
				/>
			</div>
		</Demo>
	);
}

function Primitives() {
	const [bold, setBold] = useState(false);
	return (
		<Demo title={m.kit_primitives_title()} note={m.kit_primitives_note()}>
			<div className="grid gap-3 md:grid-cols-2">
				<Alert variant="info">
					<InfoIcon aria-hidden />
					<AlertTitle>{m.kit_alert_info()}</AlertTitle>
					<AlertDescription>{m.kit_alert_body()}</AlertDescription>
				</Alert>
				<Alert variant="success">
					<CheckCircle2Icon aria-hidden />
					<AlertTitle>{m.kit_alert_success()}</AlertTitle>
					<AlertDescription>{m.kit_alert_body()}</AlertDescription>
				</Alert>
				<Alert variant="warning">
					<TriangleAlertIcon aria-hidden />
					<AlertTitle>{m.kit_alert_warning()}</AlertTitle>
					<AlertDescription>{m.kit_alert_body()}</AlertDescription>
				</Alert>
				<Alert variant="destructive">
					<TriangleAlertIcon aria-hidden />
					<AlertTitle>{m.kit_alert_danger()}</AlertTitle>
					<AlertDescription>{m.kit_alert_body()}</AlertDescription>
				</Alert>
			</div>
			<Tabs defaultValue="progress">
				<TabsList>
					<TabsTrigger value="progress">{m.kit_tab_progress()}</TabsTrigger>
					<TabsTrigger value="buttons">{m.kit_tab_buttons()}</TabsTrigger>
					<TabsTrigger value="scroll">{m.kit_tab_scroll()}</TabsTrigger>
				</TabsList>
				<TabsContent value="progress" className="flex flex-col gap-3 pt-2">
					<Progress value={60} aria-label={m.kit_progress_label()} />
					<span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
						<Spinner aria-hidden />
						{m.pending_loading()}
					</span>
				</TabsContent>
				<TabsContent value="buttons" className="flex flex-wrap items-center gap-3 pt-2">
					<ButtonGroup aria-label={m.kit_tab_buttons()}>
						<Button variant="outline">{m.pagination_previous()}</Button>
						<Button variant="outline">{m.pagination_next()}</Button>
					</ButtonGroup>
					<Toggle variant="outline" pressed={bold} onPressedChange={setBold} aria-label={m.rt_bold()}>
						<BoldIcon aria-hidden />
					</Toggle>
				</TabsContent>
				<TabsContent value="scroll" className="pt-2">
					<ScrollArea className="h-40 rounded-md border" label={m.kit_tab_scroll()}>
						<ol className="p-3 text-sm">
							{Array.from({ length: 30 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a static list of numbered lines.
								<li key={index} className="py-1">
									{m.list_field_item({ n: formatNumber(index + 1) })}
								</li>
							))}
						</ol>
					</ScrollArea>
				</TabsContent>
			</Tabs>
			<Accordion type="single" collapsible>
				<AccordionItem value="what">
					<AccordionTrigger>{m.kit_faq_what()}</AccordionTrigger>
					<AccordionContent>{m.kit_faq_what_body()}</AccordionContent>
				</AccordionItem>
				<AccordionItem value="where">
					<AccordionTrigger>{m.kit_faq_where()}</AccordionTrigger>
					<AccordionContent>{m.kit_faq_where_body()}</AccordionContent>
				</AccordionItem>
			</Accordion>
		</Demo>
	);
}

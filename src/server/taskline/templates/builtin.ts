import "@tanstack/react-start/server-only";
import { type TemplateDefinitionInput, type TemplateFile, templateFile } from "@/features/taskline/template-definition";
import type { BuiltinTemplate, StatusCategory, TasklineColor, TaskType } from "@/features/taskline/types";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";

/**
 * The templates in code (Task 57, decision 0224): five starting points, their words
 * messages, so a project starts in its creator's language. Each is checked by the same
 * schema as a saved template (a test parses all of them in both languages).
 */

type Words = { locale?: Locale };

/** Local ids (uuids a rule can name, as it names a project's); creating a project replaces them. */
const localIds = () => {
	let next = 0;
	return () => {
		next += 1;
		return `00000000-0000-4000-8000-${String(next).padStart(12, "0")}`;
	};
};

const builder = () => {
	const id = localIds();
	return {
		status: (name: string, category: StatusCategory, color: TasklineColor, wipLimit: number | null = null) => ({
			id: id(),
			name,
			category,
			color,
			wipLimit,
		}),
		label: (name: string, color: TasklineColor) => ({ id: id(), name, color }),
		milestone: (name: string, dueOffset: number) => ({ id: id(), name, dueOffset }),
		text: (name: string) => ({ id: id(), name, type: "text" as const }),
		number: (name: string) => ({ id: id(), name, type: "number" as const }),
		checkbox: (name: string) => ({ id: id(), name, type: "checkbox" as const }),
		select: (name: string, options: ReadonlyArray<{ name: string; color: TasklineColor }>) => ({
			id: id(),
			name,
			type: "select" as const,
			// Option ids are the field's own, kept when a project is made from the template.
			options: options.map((option, index) => ({ ...option, id: `o${String(index + 1).padStart(6, "0")}` })),
		}),
	};
};

type Row = { id: string };
const task = (
	title: string,
	status: Row,
	dueOffset: number,
	extra: {
		type?: TaskType;
		priority?: 0 | 1 | 2 | 3 | 4;
		labels?: ReadonlyArray<Row>;
		milestone?: Row;
		parent?: number;
		startOffset?: number;
		checklist?: string[];
		points?: number;
		estimateMinutes?: number;
	} = {},
) => ({
	title,
	status: status.id,
	dueOffset,
	type: extra.type,
	priority: extra.priority,
	labels: extra.labels?.map((label) => label.id),
	milestone: extra.milestone?.id,
	parent: extra.parent,
	startOffset: extra.startOffset,
	checklist: extra.checklist,
	points: extra.points,
	estimateMinutes: extra.estimateMinutes,
});

/** What most of the templates share: "a parent closes when its subtasks are done". */
const closeParents = (t: Words) => ({
	name: m.taskline_tpl_rule_close_parent({}, t),
	enabled: true,
	trigger: { type: "subtasks_done" as const },
	conditions: [],
	actions: [{ type: "set_status" as const, category: "completed" as const }],
});

/** "Remind the assignee two or three days ahead". */
const remind = (t: Words, days: 2 | 3) => ({
	name: days === 2 ? m.taskline_tpl_rule_remind_2({}, t) : m.taskline_tpl_rule_remind_3({}, t),
	enabled: true,
	trigger: { type: "due_soon" as const, days },
	conditions: [],
	actions: [
		{
			type: "notify" as const,
			to: "assignee",
			message: days === 2 ? m.taskline_tpl_rule_remind_2_message({}, t) : m.taskline_tpl_rule_remind_3_message({}, t),
		},
	],
});

/** "Tell the lead when a task reaches a status". */
const tellLead = (status: Row, name: string) => ({
	name,
	enabled: true,
	trigger: { type: "status_changed" as const, statusId: status.id },
	conditions: [],
	actions: [{ type: "notify" as const, to: "lead", message: name }],
});

type Built = { name: string; description: string; definition: TemplateDefinitionInput };

function scrum(t: Words): Built {
	const make = builder();
	const backlog = make.status(m.taskline_status_backlog({}, t), "backlog", "gray");
	const todo = make.status(m.taskline_status_todo({}, t), "unstarted", "blue");
	const doing = make.status(m.taskline_status_in_progress({}, t), "started", "amber");
	const review = make.status(m.taskline_tpl_status_review({}, t), "started", "violet");
	const done = make.status(m.taskline_status_done({}, t), "completed", "green");
	const canceled = make.status(m.taskline_status_canceled({}, t), "canceled", "red");
	const bug = make.label(m.taskline_tpl_label_bug({}, t), "red");
	const feature = make.label(m.taskline_tpl_label_feature({}, t), "blue");
	const debt = make.label(m.taskline_tpl_label_debt({}, t), "amber");
	const release = make.milestone(m.taskline_tpl_milestone_release({}, t), 28);
	return {
		name: m.taskline_tpl_scrum_name({}, t),
		description: m.taskline_tpl_scrum_description({}, t),
		definition: {
			statuses: [backlog, todo, doing, review, done, canceled],
			labels: [bug, feature, debt],
			fields: [
				make.select(m.taskline_tpl_field_severity({}, t), [
					{ name: m.taskline_tpl_option_low({}, t), color: "gray" },
					{ name: m.taskline_tpl_option_medium({}, t), color: "amber" },
					{ name: m.taskline_tpl_option_high({}, t), color: "red" },
				]),
			],
			automations: [
				closeParents(t),
				{
					name: m.taskline_tpl_rule_bug_label({}, t),
					enabled: true,
					trigger: { type: "task_created" },
					conditions: [{ type: "task_type", in: ["bug"] }],
					actions: [{ type: "add_label", labelId: bug.id }],
				},
			],
			settings: { sprints: true, time: true, estimation: "points" },
			milestones: [release],
			tasks: [
				task(m.taskline_tpl_scrum_task_goal({}, t), todo, 3, { type: "story", priority: 3, points: 2 }),
				task(m.taskline_tpl_scrum_task_backlog({}, t), todo, 5, { points: 3, labels: [feature] }),
				task(m.taskline_tpl_scrum_task_setup({}, t), backlog, 10, { points: 5, labels: [debt], milestone: release }),
				task(m.taskline_tpl_scrum_task_release({}, t), backlog, 28, { type: "story", points: 8, milestone: release }),
			],
		},
	};
}

function kanban(t: Words): Built {
	const make = builder();
	const backlog = make.status(m.taskline_status_backlog({}, t), "backlog", "gray");
	const todo = make.status(m.taskline_status_todo({}, t), "unstarted", "blue");
	const doing = make.status(m.taskline_status_in_progress({}, t), "started", "amber", 3);
	const done = make.status(m.taskline_status_done({}, t), "completed", "green");
	const canceled = make.status(m.taskline_status_canceled({}, t), "canceled", "red");
	const urgent = make.label(m.taskline_tpl_label_urgent({}, t), "red");
	return {
		name: m.taskline_tpl_kanban_name({}, t),
		description: m.taskline_tpl_kanban_description({}, t),
		definition: {
			statuses: [backlog, todo, doing, done, canceled],
			labels: [urgent],
			automations: [remind(t, 2), closeParents(t)],
			settings: {},
			tasks: [
				task(m.taskline_tpl_kanban_task_first({}, t), todo, 2, { priority: 2 }),
				task(m.taskline_tpl_kanban_task_limit({}, t), todo, 5),
				task(m.taskline_tpl_kanban_task_review({}, t), backlog, 14),
			],
		},
	};
}

function marketing(t: Words): Built {
	const make = builder();
	const ideas = make.status(m.taskline_tpl_status_ideas({}, t), "backlog", "gray");
	const planned = make.status(m.taskline_tpl_status_planned({}, t), "unstarted", "blue");
	const doing = make.status(m.taskline_status_in_progress({}, t), "started", "amber");
	const review = make.status(m.taskline_tpl_status_review({}, t), "started", "violet");
	const published = make.status(m.taskline_tpl_status_published({}, t), "completed", "green");
	const dropped = make.status(m.taskline_tpl_status_dropped({}, t), "canceled", "red");
	const social = make.label(m.taskline_tpl_label_social({}, t), "pink");
	const email = make.label(m.taskline_tpl_label_email({}, t), "blue");
	const brief = make.milestone(m.taskline_tpl_milestone_brief({}, t), 7);
	const launch = make.milestone(m.taskline_tpl_milestone_launch({}, t), 28);
	return {
		name: m.taskline_tpl_marketing_name({}, t),
		description: m.taskline_tpl_marketing_description({}, t),
		definition: {
			statuses: [ideas, planned, doing, review, published, dropped],
			labels: [social, email],
			fields: [
				make.select(m.taskline_tpl_field_channel({}, t), [
					{ name: m.taskline_tpl_label_social({}, t), color: "pink" },
					{ name: m.taskline_tpl_label_email({}, t), color: "blue" },
					{ name: m.taskline_tpl_option_web({}, t), color: "teal" },
				]),
				make.number(m.taskline_tpl_field_budget({}, t)),
			],
			automations: [tellLead(review, m.taskline_tpl_rule_review({}, t))],
			settings: {},
			milestones: [brief, launch],
			tasks: [
				task(m.taskline_tpl_marketing_task_brief({}, t), planned, 5, { priority: 3, milestone: brief }),
				task(m.taskline_tpl_marketing_task_audience({}, t), planned, 7, { milestone: brief }),
				task(m.taskline_tpl_marketing_task_social({}, t), ideas, 21, { labels: [social], milestone: launch }),
				task(m.taskline_tpl_marketing_task_email({}, t), ideas, 24, { labels: [email], milestone: launch }),
				task(m.taskline_tpl_marketing_task_results({}, t), ideas, 42),
			],
		},
	};
}

function client(t: Words): Built {
	const make = builder();
	const intake = make.status(m.taskline_tpl_status_intake({}, t), "backlog", "gray");
	const todo = make.status(m.taskline_status_todo({}, t), "unstarted", "blue");
	const doing = make.status(m.taskline_status_in_progress({}, t), "started", "amber");
	const withClient = make.status(m.taskline_tpl_status_with_client({}, t), "started", "violet");
	const done = make.status(m.taskline_status_done({}, t), "completed", "green");
	const canceled = make.status(m.taskline_status_canceled({}, t), "canceled", "red");
	const change = make.label(m.taskline_tpl_label_change({}, t), "orange");
	const kickoff = make.milestone(m.taskline_tpl_milestone_kickoff({}, t), 3);
	const delivery = make.milestone(m.taskline_tpl_milestone_delivery({}, t), 30);
	return {
		name: m.taskline_tpl_client_name({}, t),
		description: m.taskline_tpl_client_description({}, t),
		definition: {
			statuses: [intake, todo, doing, withClient, done, canceled],
			labels: [change],
			fields: [make.text(m.taskline_tpl_field_contact({}, t)), make.checkbox(m.taskline_tpl_field_invoice({}, t))],
			automations: [tellLead(withClient, m.taskline_tpl_rule_with_client({}, t))],
			settings: { time: true, estimation: "time" },
			milestones: [kickoff, delivery],
			tasks: [
				task(m.taskline_tpl_client_task_kickoff({}, t), todo, 3, {
					priority: 3,
					milestone: kickoff,
					estimateMinutes: 60,
				}),
				task(m.taskline_tpl_client_task_scope({}, t), todo, 7, { estimateMinutes: 240 }),
				task(m.taskline_tpl_client_task_draft({}, t), intake, 21, { estimateMinutes: 960, milestone: delivery }),
				task(m.taskline_tpl_client_task_handover({}, t), intake, 30, { estimateMinutes: 120, milestone: delivery }),
			],
		},
	};
}

function event(t: Words): Built {
	const make = builder();
	const toBook = make.status(m.taskline_tpl_status_to_book({}, t), "backlog", "gray");
	const planning = make.status(m.taskline_tpl_status_planning({}, t), "unstarted", "blue");
	const confirmed = make.status(m.taskline_tpl_status_confirmed({}, t), "started", "teal");
	const done = make.status(m.taskline_status_done({}, t), "completed", "green");
	const canceled = make.status(m.taskline_status_canceled({}, t), "canceled", "red");
	const venueLabel = make.label(m.taskline_tpl_label_venue({}, t), "teal");
	const speakers = make.label(m.taskline_tpl_label_speakers({}, t), "violet");
	const venue = make.milestone(m.taskline_tpl_milestone_venue({}, t), 14);
	const invitations = make.milestone(m.taskline_tpl_milestone_invitations({}, t), 30);
	const day = make.milestone(m.taskline_tpl_milestone_event_day({}, t), 60);
	return {
		name: m.taskline_tpl_event_name({}, t),
		description: m.taskline_tpl_event_description({}, t),
		definition: {
			statuses: [toBook, planning, confirmed, done, canceled],
			labels: [venueLabel, speakers],
			fields: [make.text(m.taskline_tpl_field_vendor({}, t)), make.number(m.taskline_tpl_field_cost({}, t))],
			automations: [remind(t, 3)],
			settings: { time: false },
			milestones: [venue, invitations, day],
			tasks: [
				task(m.taskline_tpl_event_task_venue({}, t), toBook, 14, {
					priority: 3,
					labels: [venueLabel],
					milestone: venue,
					checklist: [m.taskline_tpl_event_check_shortlist({}, t), m.taskline_tpl_event_check_visit({}, t)],
				}),
				task(m.taskline_tpl_event_task_speakers({}, t), toBook, 21, { labels: [speakers] }),
				task(m.taskline_tpl_event_task_invitations({}, t), planning, 30, { milestone: invitations }),
				task(m.taskline_tpl_event_task_rehearse({}, t), planning, 58, { milestone: day }),
				task(m.taskline_tpl_event_task_thanks({}, t), planning, 63),
			],
		},
	};
}

const BUILDERS: Record<BuiltinTemplate, (t: Words) => Built> = { scrum, kanban, marketing, client, event };

/** One built-in, in `locale` (the caller's when omitted). */
export const builtinTemplate = (id: BuiltinTemplate, locale?: Locale): TemplateFile =>
	templateFile.parse(BUILDERS[id](locale ? { locale } : {}));

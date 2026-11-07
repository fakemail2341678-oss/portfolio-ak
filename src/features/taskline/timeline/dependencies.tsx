import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { findTasksQueryOptions, tasklineKeys, tasklineMutations } from "../queries";
import { TASK_REF_PATTERN } from "../schema";
import type { DependencyRelation, LinkedTask, TaskDetail } from "../types";

/**
 * A task's dependencies (Task 54): what blocks it and what it blocks, in any project of
 * the workspace the caller may see (the rest are counted). Editors add one by
 * reference or by searching the workspace's tasks, and remove one. A loop, or a task
 * on itself, is refused by the server, which says why.
 */
export function TaskDependencies({
	task,
	userId,
	ws,
	editable,
	heading: Heading,
}: {
	task: TaskDetail;
	userId: string;
	ws: string;
	editable: boolean;
	heading: "h2" | "h3";
}) {
	const queryClient = useQueryClient();
	const headingId = useId();
	const { blockedBy, blocks, hidden, blockCompletion } = task.dependencies;
	const open = blockedBy.filter((each) => !each.closed);
	const remove = useDependencyWrite(queryClient, userId, ws, task, "remove");
	const empty = blockedBy.length === 0 && blocks.length === 0;
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3" data-testid="task-dependencies">
			<Heading id={headingId} className="flex items-center gap-2 font-medium text-body">
				{m.taskline_dependencies()}
				{task.blocked ? (
					<span className="rounded-full bg-warning-subtle px-2 text-caption text-warning">{m.taskline_blocked()}</span>
				) : null}
			</Heading>
			{task.blocked && blockCompletion ? (
				<p className="text-caption text-muted-foreground" data-testid="task-blocked-rule">
					{m.taskline_dependencies_rule()}
				</p>
			) : null}
			{empty && hidden === 0 ? <p className="text-muted-foreground text-sm">{m.taskline_dependencies_none()}</p> : null}
			{(
				[
					["blocked_by", blockedBy, m.taskline_dependencies_blocked_by()],
					["blocks", blocks, m.taskline_dependencies_blocks()],
				] as const
			).map(([relation, links, title]) =>
				links.length === 0 ? null : (
					<div key={relation} className="flex flex-col gap-1.5">
						<span className="text-caption font-medium text-muted-foreground">
							{title}
							{relation === "blocked_by" && open.length > 0 ? (
								<span className="ms-1 tabular-nums">
									{m.taskline_dependencies_open({ count: formatNumber(open.length) })}
								</span>
							) : null}
						</span>
						<ul className="flex flex-col divide-y rounded-md border" data-testid={`task-${relation}`}>
							{links.map((link) => (
								<LinkedRow
									key={link.id}
									link={link}
									ws={ws}
									editable={editable}
									pending={remove.isPending}
									onRemove={() => remove.mutate({ relation, other: link.ref })}
								/>
							))}
						</ul>
					</div>
				),
			)}
			{hidden > 0 ? (
				<p className="text-caption text-muted-foreground">
					{m.taskline_dependencies_hidden({ count: formatNumber(hidden) })}
				</p>
			) : null}
			{editable ? <AddDependency task={task} userId={userId} ws={ws} /> : null}
		</section>
	);
}

/** A dependency's write, refreshing the task (and everything else of the caller's) after. */
function useDependencyWrite(
	queryClient: QueryClient,
	userId: string,
	ws: string,
	task: TaskDetail,
	action: "add" | "remove",
) {
	const options =
		action === "add"
			? tasklineMutations.addDependency(queryClient, userId)
			: tasklineMutations.removeDependency(queryClient, userId);
	const mutation = useMutation({
		...options,
		onSuccess: (saved) => queryClient.setQueryData(tasklineKeys.task(userId, ws, task.ref), saved),
		onError: (error) => toast.error(errorMessage(error)),
	});
	return {
		...mutation,
		mutate: (input: { relation: DependencyRelation; other: string }, callbacks?: { onSuccess?: () => void }) =>
			mutation.mutate({ ws, ref: task.ref, ...input }, callbacks),
	};
}

function LinkedRow({
	link,
	ws,
	editable,
	pending,
	onRemove,
}: {
	link: LinkedTask;
	ws: string;
	editable: boolean;
	pending: boolean;
	onRemove: () => void;
}) {
	return (
		<li className="flex items-center gap-2 px-3 py-2 text-body" data-testid="task-dependency" data-ref={link.ref}>
			<span className="font-mono text-caption text-muted-foreground">{link.ref}</span>
			<Link
				{...tasklineLinks.task(ws, link.ref)}
				className={cn("min-w-0 flex-1 truncate hover:underline", link.closed && "text-muted-foreground line-through")}
			>
				{link.title}
			</Link>
			{link.elsewhere ? <span className="text-caption text-muted-foreground">{link.projectName}</span> : null}
			{link.closed ? (
				<span className="text-caption text-muted-foreground">{m.taskline_dependencies_done()}</span>
			) : null}
			{editable ? (
				<Button type="button" variant="ghost" size="icon" disabled={pending} onClick={onRemove}>
					<XIcon aria-hidden />
					<span className="sr-only">{m.taskline_dependencies_remove({ task: link.ref })}</span>
				</Button>
			) : null}
		</li>
	);
}

/** "Blocked by" or "Blocks", and the other task: a reference typed in, or one of the workspace's tasks found by words. */
function AddDependency({ task, userId, ws }: { task: TaskDetail; userId: string; ws: string }) {
	const queryClient = useQueryClient();
	const id = useId();
	const [relation, setRelation] = useState<DependencyRelation>("blocked_by");
	const [text, setText] = useState("");
	const q = useDebouncedValue(text.trim(), 250);
	const add = useDependencyWrite(queryClient, userId, ws, task, "add");
	const exact = TASK_REF_PATTERN.test(text.trim().toUpperCase()) ? text.trim().toUpperCase() : null;
	const { data: found } = useQuery({ ...findTasksQueryOptions(userId, q), enabled: q.length >= 2 && exact === null });
	const linked = new Set([...task.dependencies.blockedBy, ...task.dependencies.blocks].map((each) => each.ref));
	const options = (found ?? [])
		.filter((each) => each.project.ws === ws && each.ref !== task.ref && !linked.has(each.ref))
		.slice(0, 6);
	const submit = (other: string) => add.mutate({ relation, other }, { onSuccess: () => setText("") });
	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (exact) submit(exact);
		else if (options[0]) submit(options[0].ref);
	};
	return (
		<form method="post" onSubmit={onSubmit} className="flex flex-col gap-2" data-testid="task-add-dependency">
			<div className="flex flex-wrap gap-2">
				<label htmlFor={`${id}-relation`} className="sr-only">
					{m.taskline_dependencies_relation()}
				</label>
				<NativeSelect
					id={`${id}-relation`}
					value={relation}
					onChange={(event) => setRelation(event.target.value as DependencyRelation)}
					className="w-auto"
					data-testid="task-dependency-relation"
				>
					<option value="blocked_by">{m.taskline_dependencies_blocked_by()}</option>
					<option value="blocks">{m.taskline_dependencies_blocks()}</option>
				</NativeSelect>
				<label htmlFor={`${id}-task`} className="sr-only">
					{m.taskline_dependencies_task()}
				</label>
				<Input
					id={`${id}-task`}
					value={text}
					onChange={(event) => setText(event.target.value)}
					placeholder={m.taskline_dependencies_placeholder()}
					autoComplete="off"
					className="min-w-0 flex-1 basis-40"
					data-testid="task-dependency-input"
				/>
				<Button type="submit" variant="outline" disabled={add.isPending || (!exact && options.length === 0)}>
					<PlusIcon aria-hidden />
					{m.taskline_add()}
				</Button>
			</div>
			{options.length > 0 ? (
				<ul className="flex flex-col rounded-md border" aria-label={m.taskline_dependencies_found()}>
					{options.map((option) => (
						<li key={option.id}>
							<button
								type="button"
								className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-body hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
								onClick={() => submit(option.ref)}
								data-testid="task-dependency-option"
							>
								<LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
								<span className="font-mono text-caption text-muted-foreground">{option.ref}</span>
								<span className="min-w-0 flex-1 truncate">{option.title}</span>
							</button>
						</li>
					))}
				</ul>
			) : null}
		</form>
	);
}

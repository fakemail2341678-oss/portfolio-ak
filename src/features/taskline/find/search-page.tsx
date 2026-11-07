import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useId } from "react";
import { Pagination } from "@/components/navigation/pagination";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { searchQueryOptions } from "../queries";
import { ProjectDot } from "../shell/taskline-sidebar";
import { StatusName, TaskTypeIcon } from "../task/task-bits";
import type { FoundTask } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/search");

/**
 * /app/taskline/$ws/search (Task 51): a plain GET form (it works without JavaScript,
 * and searches only when submitted, so typing "WEB-1" on the way to "WEB-12" goes
 * nowhere) and the workspace's matching tasks, best first, open before closed.
 */
export function SearchPage() {
	const { session } = route.useRouteContext();
	const { ws } = route.useParams();
	const { q, page } = route.useSearch();
	const navigate = useNavigate();
	const inputId = useId();
	// The loader filled it on the server (an empty question asks nothing).
	const { data } = useQuery({ ...searchQueryOptions(session.user.id, ws, q, page), enabled: q !== "" });
	const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
	return (
		<Page width="narrow" data-testid="taskline-search-page">
			<PageHeader title={m.taskline_nav_search()} description={m.taskline_search_description()} />
			<search aria-label={m.taskline_nav_search()}>
				<form
					method="get"
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						const value = new FormData(event.currentTarget).get("q");
						void navigate(tasklineLinks.search(ws, typeof value === "string" ? value.trim() : ""));
					}}
				>
					<label htmlFor={inputId} className="sr-only">
						{m.taskline_search_label()}
					</label>
					<Input
						key={q}
						id={inputId}
						name="q"
						type="search"
						defaultValue={q}
						placeholder={m.taskline_search_placeholder()}
						autoComplete="off"
						maxLength={80}
						className="flex-1"
						data-testid="search-input"
					/>
					<Button type="submit" data-testid="search-submit">
						<SearchIcon aria-hidden />
						{m.taskline_search_submit()}
					</Button>
				</form>
			</search>
			{q === "" ? (
				<EmptyState icon={SearchIcon} description={m.taskline_search_start()} />
			) : data && data.items.length === 0 ? (
				<EmptyState variant="no-matches" description={m.taskline_search_none({ q })} data-testid="search-empty" />
			) : data ? (
				<section aria-labelledby="search-results" className="flex flex-col gap-3">
					<h2 id="search-results" className="text-caption text-muted-foreground" aria-live="polite">
						{m.taskline_search_count({ count: formatNumber(data.total), q })}
					</h2>
					<ul className="flex flex-col divide-y rounded-lg border bg-surface-1" data-testid="search-results">
						{data.items.map((task) => (
							<FoundRow key={task.id} task={task} />
						))}
					</ul>
					{pageCount > 1 ? <Pagination page={page} pageCount={pageCount} total={data.total} /> : null}
				</section>
			) : null}
		</Page>
	);
}

function FoundRow({ task }: { task: FoundTask }) {
	return (
		<li className="flex flex-col gap-1 px-4 py-3" data-testid="search-result">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<TaskTypeIcon type={task.type} />
				<span className="font-mono text-caption text-muted-foreground">{task.ref}</span>
				<Link
					{...tasklineLinks.task(task.project.ws, task.ref)}
					className={cn("min-w-0 flex-1 truncate font-medium text-body hover:underline", task.closed && "line-through")}
				>
					{task.title}
				</Link>
				<StatusName status={task.status} className="text-caption text-muted-foreground" />
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<ProjectDot project={task.project} className="size-2 rounded-sm" />
					{task.project.name}
				</span>
				{task.excerpt ? <span className="line-clamp-1 min-w-0 flex-1">{task.excerpt}</span> : null}
			</div>
		</li>
	);
}

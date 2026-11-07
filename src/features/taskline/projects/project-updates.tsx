import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { MegaphoneIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { StatusOf } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { RichTextContent } from "@/components/rich-text-content";
import { Button } from "@/components/ui/button";
import type { SafeHtml } from "@/lib/safe-html";
import { m } from "@/paraglide/messages";
import { PROJECT_HEALTH } from "../labels";
import { projectUpdatesQueryOptions, tasklineMutations } from "../queries";
import type { ProjectDetail } from "../types";

const ProjectUpdateDialog = lazy(() => import("./project-update-dialog"));

/**
 * The overview's updates (Task 57): how the project is doing, newest first. Whoever may
 * run it posts one (the dialog, with its editor, loads when opened) or deletes one.
 */
export function ProjectUpdates({
	userId,
	ws,
	project,
	now,
}: {
	userId: string;
	ws: string;
	project: ProjectDetail;
	now: number;
}) {
	const { key } = project;
	const { data: updates } = useSuspenseQuery(projectUpdatesQueryOptions(userId, ws, key));
	const queryClient = useQueryClient();
	const remove = useMutation(tasklineMutations.deleteProjectUpdate(queryClient, userId));
	const confirm = useConfirm();
	const [posting, setPosting] = useState(false);
	const canPost = project.can.manage && !project.archived;
	return (
		<section aria-labelledby="project-updates" className="flex flex-col gap-3" data-testid="project-updates">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="project-updates" className="flex items-center gap-2 text-heading">
					<MegaphoneIcon className="size-4 text-muted-foreground" aria-hidden />
					{m.taskline_update_title()}
				</h2>
				{canPost ? (
					<Button variant="outline" size="sm" onClick={() => setPosting(true)} data-testid="project-update-new">
						<PlusIcon aria-hidden />
						{m.taskline_update_new()}
					</Button>
				) : null}
			</div>
			{updates.length === 0 ? (
				<EmptyState icon={MegaphoneIcon} description={m.taskline_update_empty()} />
			) : (
				<ol className="flex flex-col gap-3">
					{updates.map((update) => (
						<li key={update.id} className="flex flex-col gap-2 rounded-md border p-3" data-testid="project-update">
							<div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
								<StatusOf status={update.health} map={PROJECT_HEALTH} />
								<span>{update.author ?? m.taskline_activity_admin()}</span>
								<RelativeTime value={update.at} now={now} />
								{canPost ? (
									<Button
										variant="ghost"
										size="icon"
										className="ms-auto size-7"
										aria-label={m.taskline_update_delete()}
										disabled={remove.isPending}
										onClick={async () => {
											const ok = await confirm({
												title: m.taskline_update_delete(),
												description: m.taskline_update_delete_confirm(),
												confirmLabel: m.crud_delete(),
												destructive: true,
											});
											if (!ok) return;
											remove.mutate(
												{ ws, key, id: update.id },
												{ onError: (error) => toast.error(errorMessage(error)) },
											);
										}}
										data-testid="project-update-delete"
									>
										<Trash2Icon aria-hidden />
									</Button>
								) : null}
							</div>
							{/* Sanitized when saved (rules.ts, richText). */}
							<RichTextContent html={update.body as SafeHtml} />
						</li>
					))}
				</ol>
			)}
			<Suspense fallback={null}>
				{posting ? (
					<ProjectUpdateDialog
						ws={ws}
						projectKey={key}
						userId={userId}
						health={project.health}
						onClose={() => setPosting(false)}
					/>
				) : null}
			</Suspense>
		</section>
	);
}

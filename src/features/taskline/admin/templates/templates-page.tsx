import { useSuspenseQuery } from "@tanstack/react-query";
import { CopyIcon, DownloadIcon, FileUpIcon, LayoutTemplateIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { downloadJson } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type TemplateFile, templateCounts } from "../../template-definition";
import type { TemplateCounts } from "../../types";
import { ALL_TASKLINE_ADMIN } from "../keys";
import { adminTemplatesQueryOptions, tasklineAdminMutations } from "../queries";
import type { AdminTemplate } from "../schema";
import type { TemplateDialogStart } from "./template-dialog";

const TemplateDialog = lazy(() => import("./template-dialog"));

/** What a template holds, in a line. */
export const countsLine = (counts: TemplateCounts) =>
	m.taskline_template_counts({
		statuses: formatNumber(counts.statuses),
		fields: formatNumber(counts.fields),
		automations: formatNumber(counts.automations),
		milestones: formatNumber(counts.milestones),
		tasks: formatNumber(counts.tasks),
	});

/** A template as its file: what "Import" reads back. */
function exportFile({ name, description, definition }: AdminTemplate) {
	const file: TemplateFile = { name, description, definition };
	const slug =
		name
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-|-$/g, "") || "template";
	downloadJson(`${slug}.json`, JSON.stringify(file, null, 2));
}

/**
 * /admin/taskline/templates (Task 57, decision 0224; `taskline:configure`): what new
 * projects can start from. The built-ins read only (copy one to change it); the team's
 * are written, imported, exported and deleted here, or saved from a project's page.
 */
export function TasklineTemplatesPage() {
	const { data } = useSuspenseQuery(adminTemplatesQueryOptions());
	const remove = useCrudMutation(tasklineAdminMutations.deleteTemplate(), { invalidate: ALL_TASKLINE_ADMIN });
	const confirm = useConfirm();
	const [dialog, setDialog] = useState<TemplateDialogStart | null>(null);

	const row = (template: AdminTemplate) => (
		<li
			key={template.id}
			className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
			data-testid="template-row"
		>
			<div className="flex min-w-0 flex-col gap-1">
				<span className="font-medium">{template.name}</span>
				{template.description ? <span className="text-body text-muted-foreground">{template.description}</span> : null}
				<span className="text-caption text-muted-foreground">{countsLine(templateCounts(template.definition))}</span>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => exportFile(template)}
					aria-label={m.taskline_template_export_named({ name: template.name })}
					data-testid="template-export"
				>
					<DownloadIcon aria-hidden />
					{m.taskline_template_export()}
				</Button>
				{template.builtin ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setDialog({ mode: "copy", template })}
						aria-label={m.taskline_template_copy_named({ name: template.name })}
						data-testid="template-copy"
					>
						<CopyIcon aria-hidden />
						{m.taskline_template_copy()}
					</Button>
				) : (
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setDialog({ mode: "edit", template })}
							aria-label={m.taskline_template_edit_named({ name: template.name })}
							data-testid="template-edit"
						>
							<PencilIcon aria-hidden />
							{m.crud_edit()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={remove.isPending}
							aria-label={m.taskline_template_delete_named({ name: template.name })}
							onClick={async () => {
								const ok = await confirm({
									title: m.taskline_template_delete_named({ name: template.name }),
									description: m.taskline_template_delete_confirm(),
									confirmLabel: m.crud_delete(),
									destructive: true,
								});
								if (ok) {
									remove.mutate({ id: template.id }, { onSuccess: () => toast.success(m.taskline_template_deleted()) });
								}
							}}
							data-testid="template-delete"
						>
							<Trash2Icon aria-hidden />
							{m.crud_delete()}
						</Button>
					</>
				)}
			</div>
		</li>
	);

	return (
		<Page width="admin" data-testid="taskline-admin-templates">
			<PageHeader
				title={m.taskline_admin_templates_title()}
				description={m.taskline_admin_templates_description()}
				actions={
					<>
						<Button variant="outline" onClick={() => setDialog({ mode: "import" })} data-testid="template-import">
							<FileUpIcon aria-hidden />
							{m.taskline_template_import()}
						</Button>
						<Button onClick={() => setDialog({ mode: "new" })} data-testid="template-new">
							<PlusIcon aria-hidden />
							{m.taskline_template_new()}
						</Button>
					</>
				}
			/>
			<section aria-labelledby="templates-team" className="flex flex-col gap-3">
				<h2 id="templates-team" className="text-heading">
					{m.taskline_template_team()}
				</h2>
				{data.templates.length === 0 ? (
					<EmptyState icon={LayoutTemplateIcon} description={m.taskline_template_team_empty()} />
				) : (
					<ul className="flex flex-col gap-2" data-testid="team-templates">
						{data.templates.map(row)}
					</ul>
				)}
			</section>
			<section aria-labelledby="templates-builtin" className="flex flex-col gap-3">
				<h2 id="templates-builtin" className="text-heading">
					{m.taskline_template_builtin()}
				</h2>
				<ul className="flex flex-col gap-2" data-testid="builtin-templates">
					{data.builtins.map(row)}
				</ul>
			</section>
			<Suspense fallback={null}>
				{dialog ? <TemplateDialog start={dialog} onClose={() => setDialog(null)} /> : null}
			</Suspense>
		</Page>
	);
}

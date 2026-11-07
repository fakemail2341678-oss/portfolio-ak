import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { CrudListPending } from "@/components/crud/crud-list-page";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { projectColumns } from "../columns";
import { projectDetailQueryOptions } from "../queries";
import { ProjectForm } from "./project-form";
import { NewProjectButton } from "./project-list";
import { PreviewLink } from "./shared";

const editRoute = getRouteApi("/_admin/admin/portfolio/projects/$id");

/** The list's pendingComponent: its header and a table skeleton. */
export function ProjectsPending() {
	return (
		<CrudListPending
			title={m.portfolio_admin_projects_title()}
			description={m.portfolio_admin_projects_description()}
			actions={<NewProjectButton />}
			columns={projectColumns.length}
		/>
	);
}

/** /admin/portfolio/projects/new */
export function ProjectNewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.portfolio_admin_projects_new()} />
			<ProjectForm />
		</Page>
	);
}

/** /admin/portfolio/projects/$id: the project from the loader's cache; a reloaded newer version remounts the form. */
export function ProjectEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(projectDetailQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader
				title={m.portfolio_admin_projects_edit()}
				description={item.title}
				actions={
					<Button variant="outline" asChild>
						<PreviewLink kind="work" slug={item.slug}>
							{item.status === "published" ? m.portfolio_admin_view() : m.portfolio_admin_preview()}
						</PreviewLink>
					</Button>
				}
			/>
			<ProjectForm key={crudFormKey(item)} item={item} />
		</Page>
	);
}

import { getRouteApi, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { patchRow, useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { useListPage } from "@/hooks/use-list-page";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { POSTS_TABLE_ID, type PortfolioStatus, type PostListItem } from "../../schema";
import { postColumns } from "../columns";
import { PostFilterControls, postFilters } from "../filters";
import { postKeys } from "../keys";
import { postListQueryOptions, postMutations } from "../queries";
import { PreviewLink } from "./shared";

const route = getRouteApi("/_admin/admin/portfolio/journal/");

/** "New post", for users who may write. */
export function NewPostButton() {
	return (
		<NewButton to="/admin/portfolio/journal/new" permission="portfolio:write">
			{m.portfolio_admin_posts_new()}
		</NewButton>
	);
}

/** The list's pendingComponent: its header and a table skeleton. */
export function PostsPending() {
	return (
		<CrudListPending
			title={m.portfolio_admin_posts_title()}
			description={m.portfolio_admin_posts_description()}
			actions={<NewPostButton />}
			columns={postColumns.length}
		/>
	);
}

/** /admin/portfolio/journal (docs/guides/crud.md): the articles, newest first; publish and delete show at once. */
export function PostList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: POSTS_TABLE_ID, search, query: postListQueryOptions });

	const remove = useCrudMutation(postMutations.delete(), {
		invalidate: [postKeys.all],
		optimistic: { queryKey: postKeys.lists(), update: withoutRows<PostListItem> },
	});
	const setStatus = useCrudMutation(postMutations.setStatus(), {
		invalidate: [postKeys.all],
		optimistic: {
			queryKey: postKeys.lists(),
			update: patchRow((row: PostListItem, { status }: { id: string; status: PortfolioStatus }) => ({
				...row,
				status,
			})),
		},
	});
	const publish = (row: PostListItem) => {
		const status = row.status === "published" ? "draft" : "published";
		setStatus.mutate(
			{ id: row.id, status },
			{
				onSuccess: () =>
					toast.success(
						status === "published" ? m.portfolio_admin_toast_published() : m.portfolio_admin_toast_unpublished(),
					),
			},
		);
	};

	const rowActions = (row: PostListItem): RowAction[] => [
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "portfolio:write",
			render: (label) => (
				<Link to="/admin/portfolio/journal/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
		{
			id: "preview",
			label: m.portfolio_admin_preview(),
			render: (label) => (
				<PreviewLink kind="journal" slug={row.slug}>
					{label}
				</PreviewLink>
			),
		},
		{
			id: "publish",
			label: row.status === "published" ? m.portfolio_admin_unpublish() : m.portfolio_admin_publish(),
			permission: "portfolio:publish",
			onSelect: () => publish(row),
		},
	];

	return (
		<CrudListPage
			title={m.portfolio_admin_posts_title()}
			description={m.portfolio_admin_posts_description()}
			actions={<NewPostButton />}
			tableId={POSTS_TABLE_ID}
			list={list}
			columns={postColumns}
			getRowLabel={(row) => localizedValue(row.title)}
			search={search}
			filters={{ controls: <PostFilterControls search={search} />, ...postFilters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "portfolio:write", run: (ids) => remove.mutateAsync(ids) }}
			empty={{
				description: m.portfolio_admin_posts_empty(),
				filtered: m.portfolio_admin_empty_filtered(),
				action: <NewPostButton />,
			}}
			exportName="journal"
			data-testid="posts-table"
		/>
	);
}

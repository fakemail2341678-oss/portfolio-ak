import { getRouteApi } from "@tanstack/react-router";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { onRows, useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { useListPage } from "@/hooks/use-list-page";
import { m } from "@/paraglide/messages";
import { shortUrl } from "../../format";
import { linkModerationColumns } from "../columns";
import { LinkModerationFilterControls, linkModerationFilters } from "../filters";
import { linkModerationKeys } from "../keys";
import { linkModerationMutations, linkModerationQueryOptions } from "../queries";
import type { BlockLinksInput, LinkModerationItem } from "../schema";
import { LINK_MODERATION_TABLE_ID } from "../search";

const route = getRouteApi("/_admin/admin/links");

/**
 * /admin/links (decision 0191): every user's short links, for moderation. Blocking
 * stops a link at once (its owner can't turn it back on); deleting removes it and its
 * clicks. Both are audited, and show at once, rolling back if the server refuses.
 */
export function LinksModeration() {
	const search = route.useSearch();
	const list = useListPage({ tableId: LINK_MODERATION_TABLE_ID, search, query: linkModerationQueryOptions });
	const confirm = useConfirm();

	const block = useCrudMutation(linkModerationMutations.block(), {
		invalidate: [linkModerationKeys.all],
		optimistic: {
			queryKey: linkModerationKeys.lists(),
			update: onRows((rows: LinkModerationItem[], input: BlockLinksInput) =>
				rows.map((row) =>
					input.ids.includes(row.id)
						? { ...row, blocked: input.blocked, state: input.blocked ? "blocked" : row.state }
						: row,
				),
			),
		},
	});
	const remove = useCrudMutation(linkModerationMutations.delete(), {
		invalidate: [linkModerationKeys.all],
		optimistic: { queryKey: linkModerationKeys.lists(), update: withoutRows<LinkModerationItem> },
	});

	const setBlocked = async (row: LinkModerationItem, blocked: boolean) => {
		if (blocked) {
			const confirmed = await confirm({
				title: m.links_block_title({ slug: row.slug }),
				description: m.links_block_body(),
				confirmLabel: m.links_block(),
				destructive: true,
			});
			if (!confirmed) return;
		}
		block.mutate(
			{ ids: [row.id], blocked },
			{ onSuccess: () => toast.success(blocked ? m.links_toast_blocked() : m.links_toast_unblocked()) },
		);
	};

	const rowActions = (row: LinkModerationItem): RowAction[] => [
		{
			id: "open",
			label: m.links_open_target(),
			render: (label) => (
				<a href={row.target} rel="noopener noreferrer nofollow" target="_blank">
					{label}
				</a>
			),
		},
		{
			id: "block",
			label: row.blocked ? m.links_unblock() : m.links_block(),
			permission: "links:moderate",
			onSelect: () => void setBlocked(row, !row.blocked),
		},
	];

	return (
		<CrudListPage
			title={m.links_moderation_title()}
			description={m.links_moderation_description()}
			tableId={LINK_MODERATION_TABLE_ID}
			list={list}
			columns={linkModerationColumns}
			getRowLabel={(row) => shortUrl(row.slug)}
			search={search}
			filters={{ controls: <LinkModerationFilterControls search={search} />, ...linkModerationFilters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "links:moderate", run: (ids) => remove.mutateAsync(ids) }}
			empty={{ description: m.links_moderation_empty(), filtered: m.links_moderation_empty_filtered() }}
			exportName="links"
			data-testid="links-moderation-table"
		/>
	);
}

import { BookOpenIcon, CheckCheckIcon, type LucideIcon, ReceiptIcon, SearchXIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/page/empty-state";
import { m } from "@/paraglide/messages";

export const KHARCHA_EMPTY = ["page", "people", "todo", "spend", "search"] as const;
export type KharchaEmptyKind = (typeof KHARCHA_EMPTY)[number];

const EMPTY: Record<KharchaEmptyKind, { icon: LucideIcon; title: () => string; description: () => string }> = {
	page: {
		icon: BookOpenIcon,
		title: () => m.kharcha_empty_page_title(),
		description: () => m.kharcha_empty_page_body(),
	},
	people: {
		icon: UsersIcon,
		title: () => m.kharcha_empty_people_title(),
		description: () => m.kharcha_empty_people_body(),
	},
	todo: {
		icon: CheckCheckIcon,
		title: () => m.kharcha_empty_todo_title(),
		description: () => m.kharcha_empty_todo_body(),
	},
	spend: {
		icon: ReceiptIcon,
		title: () => m.kharcha_empty_spend_title(),
		description: () => m.kharcha_empty_spend_body(),
	},
	search: {
		icon: SearchXIcon,
		title: () => m.kharcha_empty_search_title(),
		description: () => m.kharcha_empty_search_body(),
	},
};

/**
 * Kharcha's empty states, on the shared `EmptyState`: a page with nothing on it yet, no
 * friends or groups, nothing to do, no spending, and a search that matches nothing. The
 * page passes its own next step (`action`): add an expense, add a friend, clear filters.
 */
export function KharchaEmpty({
	kind,
	action,
	className,
}: {
	kind: KharchaEmptyKind;
	action?: ReactNode;
	className?: string;
}) {
	const { icon, title, description } = EMPTY[kind];
	return (
		<EmptyState
			variant={kind === "search" ? "no-matches" : "empty"}
			icon={icon}
			title={<span className="kh-display text-kh-head">{title()}</span>}
			description={description()}
			{...(action ? { primaryAction: action } : {})}
			{...(className ? { className } : {})}
			data-testid={`kharcha-empty-${kind}`}
		/>
	);
}

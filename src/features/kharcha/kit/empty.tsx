import {
	BookOpenIcon,
	ChartPieIcon,
	CheckCheckIcon,
	type LucideIcon,
	ReceiptIcon,
	RepeatIcon,
	SearchXIcon,
	TargetIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/page/empty-state";
import { m } from "@/paraglide/messages";

export const KHARCHA_EMPTY = ["page", "people", "todo", "spend", "search", "budgets", "recurring", "insights"] as const;
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
	budgets: {
		icon: TargetIcon,
		title: () => m.kharcha_empty_budgets_title(),
		description: () => m.kharcha_empty_budgets_body(),
	},
	recurring: {
		icon: RepeatIcon,
		title: () => m.kharcha_empty_recurring_title(),
		description: () => m.kharcha_empty_recurring_body(),
	},
	insights: {
		icon: ChartPieIcon,
		title: () => m.kharcha_empty_insights_title(),
		description: () => m.kharcha_empty_insights_body(),
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

import { CircleDashedIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { appColor } from "../../colors";
import { CATEGORY_ICON_COMPONENTS } from "../icons";
import type { ExpenseCategory } from "../types";

/** A category's icon on its colour (decorative: the name says it). */
export function CategoryIconMark({ category, className }: { category: ExpenseCategory | null; className?: string }) {
	const Icon = category ? CATEGORY_ICON_COMPONENTS[category.icon] : CircleDashedIcon;
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-md text-white",
				!category && "bg-surface-2 text-muted-foreground",
				className,
			)}
			style={category ? { backgroundColor: appColor(category.color) } : undefined}
		>
			<Icon className="size-4" />
		</span>
	);
}

/** A category's mark and name; null is "Uncategorized". */
export function CategoryLabel({ category, className }: { category: ExpenseCategory | null; className?: string }) {
	return (
		<span className={cn("flex min-w-0 items-center gap-2", className)}>
			<CategoryIconMark category={category} className="size-6 rounded-sm [&_svg]:size-3.5" />
			<span className="truncate">{category?.name ?? m.expenses_uncategorized()}</span>
		</span>
	);
}

import { CopyIcon, type LucideIcon, ReceiptTextIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { FixKind } from "../types";

const FIXES: Record<FixKind, { icon: LucideIcon; label: () => string }> = {
	uncategorized: { icon: TagIcon, label: () => m.kharcha_kit_fix_uncategorized() },
	duplicate: { icon: CopyIcon, label: () => m.kharcha_kit_fix_duplicate() },
	receipt: { icon: ReceiptTextIcon, label: () => m.kharcha_kit_fix_receipt() },
};

/**
 * What an expense still needs (PLAN 14.5): hatched in the owe colour, with an icon and
 * words, so a problem never rides on colour alone.
 */
export function FixBadge({ kind, className }: { kind: FixKind; className?: string }) {
	const { icon: Icon, label } = FIXES[kind];
	return (
		<span
			className={cn(
				"kh-hatch inline-flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap rounded-sm border border-current px-1.5 py-px font-semibold text-[0.75rem] text-kh-owe leading-5",
				className,
			)}
			data-fix={kind}
		>
			<Icon className="size-3 shrink-0" aria-hidden />
			<span className="truncate">{label()}</span>
		</span>
	);
}

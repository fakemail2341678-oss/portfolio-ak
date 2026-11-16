import { Kbd } from "@/components/ui/kbd";
import { type ShortcutRow, useRegisteredShortcuts } from "@/hooks/use-shortcuts";
import { cn } from "@/lib/utils";

/** A row a shortcuts dialog adds by hand: keys a widget handles itself (arrow keys in a list, a drag handle's moves). */
export type ShortcutExtraRow = { keys: string[]; name: string };

/**
 * The body of a shortcuts dialog: every shortcut that is bound right now (`useShortcuts`
 * registers them with their names, decision 0299), under its group's heading when there is
 * more than one group, then the rows the caller adds for keys that are not shortcuts.
 * A product's dialog supplies the frame, the title and its own row style.
 */
export function ShortcutsList({
	extra = [],
	extraTitle,
	rowClassName = "border-b last:border-b-0",
	className,
}: {
	extra?: ShortcutExtraRow[];
	/** The heading above `extra` when the bound shortcuts have headings too. */
	extraTitle?: string;
	rowClassName?: string;
	className?: string;
}) {
	const bound = useRegisteredShortcuts();
	const groups = new Map<string, Array<Pick<ShortcutRow, "name" | "keys">>>();
	for (const row of bound) groups.set(row.group, [...(groups.get(row.group) ?? []), row]);
	const headings = groups.size > 1;
	const sections = [...groups.entries()].map(([title, rows]) => ({ title, rows }));
	if (extra.length > 0) {
		const last = sections.at(-1);
		// One group and no headings: the extra rows simply follow.
		if (last && !headings) last.rows = [...last.rows, ...extra];
		else sections.push({ title: extraTitle ?? "", rows: extra });
	}
	return (
		<div className={cn("flex flex-col gap-4 text-body", className)} data-testid="shortcuts-list">
			{sections.map((section) => (
				<section key={section.title} className="flex flex-col">
					{headings && section.title ? (
						<h3 className="pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">{section.title}</h3>
					) : null}
					<dl className="flex flex-col">
						{section.rows.map((row) => (
							<div key={row.name} className={cn("flex items-center justify-between gap-4 py-2", rowClassName)}>
								<dt>{row.name}</dt>
								<dd className="flex shrink-0 gap-1" dir="ltr">
									{row.keys.map((key) => (
										<Kbd key={key}>{key}</Kbd>
									))}
								</dd>
							</div>
						))}
					</dl>
				</section>
			))}
		</div>
	);
}

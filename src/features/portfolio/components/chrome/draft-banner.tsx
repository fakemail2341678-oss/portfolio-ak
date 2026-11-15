import { m } from "@/paraglide/messages";

/** Says a previewed page is a draft: only people who may read drafts see it, and visitors don't yet. */
export function DraftNotice() {
	return (
		<p role="note" className="hm-field-rhodo px-(--hm-margin) py-3 text-center font-semibold">
			{m.portfolio_preview_draft()}
		</p>
	);
}

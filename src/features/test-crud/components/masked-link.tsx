import { Link } from "@tanstack/react-router";
import { EyeIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

/**
 * Links that open an item in a dialog over its list: masked routes. The real
 * location is the list with a search param (`?edit=<id>`, `?view=<slug>`); the
 * address bar shows the item's own URL, which is also the link's href.
 *
 * - Reload, a shared link, "open in new tab" or no JavaScript: the item's full page.
 * - Back/forward move between the list and the dialog.
 * - `unmaskOnReload` is required with SSR: the server only ever sees the shown
 *   URL, so a reload must render that page in the browser too, or hydration
 *   would mismatch.
 */

type AnchorProps = Omit<ComponentProps<"a">, "href">;

/** Admin: edit form in a dialog over /admin/test-crud, shown as /admin/test-crud/<id>. */
export function EditItemLink({ id, ...props }: { id: string } & AnchorProps) {
	return (
		<Link
			from="/admin/test-crud/"
			to="."
			search={(prev) => ({ ...prev, edit: id })}
			mask={{ to: "/admin/test-crud/$id", params: { id }, unmaskOnReload: true }}
			{...props}
		/>
	);
}

/** Dev reference: quick view over /dev/test-crud, shown as the canonical /dev/test-crud/<slug>. */
export function QuickViewLink({ slug, ...props }: { slug: string } & AnchorProps) {
	return (
		<Link
			from="/dev/test-crud/"
			to="."
			search={(prev) => ({ ...prev, view: slug })}
			mask={{ to: "/dev/test-crud/$slug", params: { slug }, unmaskOnReload: true }}
			{...props}
		/>
	);
}

/** The small "Quick view" button on a card (stacked above the card's stretched link). */
export function QuickViewButton({ slug, title }: { slug: string; title: string }) {
	return (
		<Button asChild size="sm" variant="secondary" className="absolute end-2 top-2 z-10 shadow-sm">
			<QuickViewLink slug={slug} aria-label={m.test_crud_quick_view_of({ title })}>
				<EyeIcon aria-hidden />
				{m.test_crud_quick_view()}
			</QuickViewLink>
		</Button>
	);
}

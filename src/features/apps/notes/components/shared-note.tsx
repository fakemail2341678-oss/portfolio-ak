import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { NotebookTextIcon } from "lucide-react";
import { Page, PageHeader } from "@/components/page/page";
import { RichTextContent } from "@/components/rich-text-content";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { sharedNoteQueryOptions } from "../queries";

const route = getRouteApi("/_apps/apps/notes/s/$token");

/**
 * /apps/notes/s/$token (decision 0190): a note its owner shared, read only, for
 * anyone with the link. Never indexed (noindex and X-Robots-Tag); it names no owner.
 */
export function SharedNotePage() {
	const { token } = route.useParams();
	const { data: note } = useSuspenseQuery(sharedNoteQueryOptions(token));
	return (
		<Page width="narrow" data-testid="shared-note">
			<p className="flex items-center gap-2 text-caption text-muted-foreground">
				<NotebookTextIcon className="size-4" aria-hidden />
				{m.notes_shared_kicker({ date: formatDate(note.updatedAt, { dateStyle: "long" }) })}
			</p>
			<PageHeader title={note.title} />
			{note.body ? <RichTextContent html={note.body} /> : null}
			{note.images.length > 0 ? (
				<ul className="grid gap-4 sm:grid-cols-2">
					{note.images.map((image) => (
						<li key={image.id}>
							<CloudImage
								image={image}
								sizes="(min-width: 640px) 22rem, 100vw"
								className="h-auto w-full rounded-lg border"
								loading="lazy"
							/>
						</li>
					))}
				</ul>
			) : null}
			<p className="border-t pt-6 text-muted-foreground text-sm">
				{m.notes_shared_footer()}{" "}
				<Link to="/apps/notes" className="font-medium text-foreground underline underline-offset-4">
					{m.notes_shared_try()}
				</Link>
			</p>
		</Page>
	);
}

import { Page } from "@/components/page/page";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/page/skeletons";
import { m } from "@/paraglide/messages";
import { STACK_PAGE_SIZE } from "../schema";

/**
 * Skeleton shown while a client-side navigation loads the list. It lives here, not in the
 * route file: the page renders it too, and a binding that two split parts of a route share
 * goes into every page's JavaScript since router-plugin 1.169 (0299).
 */
export function StackPending() {
	return (
		<Page className="gap-8" aria-busy="true">
			<output className="sr-only">{m.pending_loading()}</output>
			<PageHeaderSkeleton size="display" />
			<ListSkeleton
				count={STACK_PAGE_SIZE}
				item={<div className="h-40 w-full animate-pulse rounded-xl bg-muted" />}
				className="gap-4 sm:grid-cols-2 lg:grid-cols-3"
			/>
		</Page>
	);
}

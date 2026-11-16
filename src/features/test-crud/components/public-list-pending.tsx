import { Page } from "@/components/page/page";
import { ListSkeleton, PageHeaderSkeleton } from "@/components/page/skeletons";
import { m } from "@/paraglide/messages";
import { TEST_CRUD_PUBLIC_PAGE_SIZE } from "../search";
import { PublicCardSkeleton } from "./public-card";

/**
 * Card-shaped placeholders while a client-side navigation loads (SSR never shows this). It
 * lives here, not in the route file: the page renders it too, and a binding that two split
 * parts of a route share goes into every page's JavaScript since router-plugin 1.169 (0299).
 */
export function PublicListPending() {
	return (
		<Page width="wide" className="gap-8" aria-busy="true">
			<output className="sr-only">{m.test_crud_public_loading()}</output>
			<PageHeaderSkeleton size="display" extra />
			<ListSkeleton
				count={Math.min(6, TEST_CRUD_PUBLIC_PAGE_SIZE)}
				item={<PublicCardSkeleton />}
				className="sm:grid-cols-2 lg:grid-cols-3"
			/>
		</Page>
	);
}

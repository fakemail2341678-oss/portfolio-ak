import type { LinkOptions } from "@tanstack/react-router";
import { SegmentNav } from "@/components/navigation/segment-nav";
import type { PardaPage } from "../search";
import { PAGE_LABELS } from "./labels";
import { PARDA_PAGES } from "./search";

/** Which of Parda's pages (the home or a hub) a list or a layout shows. */
export function PageNav({
	label,
	current,
	link,
}: {
	label: string;
	current: PardaPage;
	link: (page: PardaPage) => LinkOptions;
}) {
	return (
		<SegmentNav
			label={label}
			items={PARDA_PAGES.map((page) => ({ value: page, label: PAGE_LABELS[page]() }))}
			current={current}
			link={link}
			testId="parda-page-nav"
		/>
	);
}

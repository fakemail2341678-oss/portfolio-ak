import { Link, type LinkOptions } from "@tanstack/react-router";
import { BookOpenIcon, type LucideIcon, MegaphoneIcon, PuzzleIcon, RadioTowerIcon, TrophyIcon } from "lucide-react";
import type { Localized } from "@/lib/i18n/localized";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { chaalLinks } from "../links";
import type { ChaalFeaturedItem, ChaalFeaturedKind, ChaalFeaturedSection } from "./curation";

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Where a featured item opens in Chaal. */
const linkOf = (item: ChaalFeaturedItem): LinkOptions => {
	switch (item.kind) {
		case "broadcast":
			return chaalLinks.broadcast(item.ref);
		case "arena":
			return chaalLinks.tournament(item.ref);
		case "swiss":
			return chaalLinks.tournament(item.ref, { kind: "swiss" });
		case "study":
			return chaalLinks.study(item.ref);
		case "theme":
			return chaalLinks.puzzles({ mode: "train", theme: item.ref });
	}
};

const KIND: Readonly<Record<ChaalFeaturedKind, { icon: LucideIcon; label: () => string }>> = {
	broadcast: { icon: RadioTowerIcon, label: m.ch_home_kind_broadcast },
	arena: { icon: TrophyIcon, label: m.ch_home_kind_arena },
	swiss: { icon: TrophyIcon, label: m.ch_home_kind_swiss },
	study: { icon: BookOpenIcon, label: m.ch_home_kind_study },
	theme: { icon: PuzzleIcon, label: m.ch_home_kind_theme },
};

const TITLES: Readonly<Record<ChaalFeaturedSection, () => string>> = {
	broadcasts: m.ch_home_section_broadcasts,
	tournaments: m.ch_home_section_tournaments,
	studies: m.ch_home_section_studies,
	themes: m.ch_home_section_themes,
};

const SECTION = "mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8";

/** A featured section of the home (PLAN Task 84): the admin's picks in their order, each a ruled tile. */
export function FeaturedSection({ section, items }: { section: ChaalFeaturedSection; items: ChaalFeaturedItem[] }) {
	const id = `chaal-home-${section}`;
	return (
		<section aria-labelledby={id} className={SECTION} data-testid={id}>
			<h2 id={id} className="ch-display ch-rule pt-4 text-ch-head">
				{TITLES[section]()}
			</h2>
			<ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
				{items.map((item) => {
					const { icon: Icon, label } = KIND[item.kind];
					return (
						<li key={item.id} className="flex">
							<Link
								{...linkOf(item)}
								className={`ch-press flex flex-1 items-start gap-4 border border-ch-hair bg-ch-plate p-5 transition-colors hover:border-ch-ink ${focusRing}`}
							>
								<Icon aria-hidden className="mt-0.5 size-6 shrink-0" strokeWidth={1.5} />
								<span className="flex min-w-0 flex-col gap-1">
									<span className="font-semibold">{localizedValue(item.title)}</span>
									<span className="text-ch-muted text-sm">{label()}</span>
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

/** The admin's announcement (PLAN Task 84): a ruled note, in the reader's language when there's one. */
export function Announcement({ text }: { text: Localized }) {
	return (
		<section aria-labelledby="chaal-home-announcement" className={SECTION} data-testid="chaal-home-announcement">
			<div className="flex items-start gap-4 border-ch-ink border-s-2 bg-ch-plate p-5">
				<MegaphoneIcon aria-hidden className="mt-0.5 size-6 shrink-0" strokeWidth={1.5} />
				<div className="flex flex-col gap-1">
					<h2 id="chaal-home-announcement" className="font-semibold">
						{m.ch_home_section_announcement()}
					</h2>
					<p className="max-w-prose whitespace-pre-line">{localizedValue(text)}</p>
				</div>
			</div>
		</section>
	);
}

import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { m } from "@/paraglide/messages";
import { AD_BLOCKER_SECTION, BLOCKER_STORES } from "../player/blocker";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	const headingId = `${id}-title`;
	return (
		<section id={id} aria-labelledby={headingId} className="flex scroll-mt-20 flex-col gap-3">
			<h2 id={headingId} className="pd-display text-pd-head">
				{title}
			</h2>
			{children}
		</section>
	);
}

const external =
	"inline-flex items-center gap-1 underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * /app/parda/about, the notice page (PLAN 12.2, "Legal"): what Parda is, where its
 * information comes from (Parda's catalogue, JustWatch's attribution; 0249), that no
 * video plays yet (decision 0228), that players bring their own ads and trackers, and
 * how to block them.
 */
export function PardaAbout() {
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-about">
			<div className="bg-pd-mask px-4 pt-10 pb-8 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-3xl flex-col gap-3">
					<h1 className="pd-display text-pd-title">{m.pd_about_title()}</h1>
					<p className="text-lg text-pd-muted">{m.pd_about_intro()}</p>
				</div>
			</div>
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 leading-relaxed sm:px-6 lg:px-0">
				<Section id="catalogue" title={m.pd_about_catalogue_title()}>
					<p>{m.pd_about_catalogue_body()}</p>
					<p className="text-pd-muted">{m.pd_about_justwatch()}</p>
				</Section>
				<Section id="playback" title={m.pd_about_playback_title()}>
					<p>{m.pd_about_playback_body()}</p>
					<p className="text-pd-muted">{m.pd_about_players_body()}</p>
				</Section>
				<Section id={AD_BLOCKER_SECTION} title={m.pd_about_blocker_title()}>
					<p>{m.pd_about_blocker_body()}</p>
					<ul className="flex flex-col gap-2">
						{BLOCKER_STORES.map((store) => (
							<li key={store.browser}>
								<a href={store.href} target="_blank" rel="noopener" className={external}>
									{m.pd_about_blocker_store({ browser: store.browser })}
									<ExternalLinkIcon aria-hidden className="size-3.5" />
									<span className="sr-only">{m.pd_opens_new_tab()}</span>
								</a>
							</li>
						))}
					</ul>
					<p className="text-pd-muted">{m.pd_about_blocker_phones()}</p>
					<p className="text-pd-muted">{m.pd_about_blocker_caveat()}</p>
				</Section>
				<Section id="takedowns" title={m.pd_about_takedowns_title()}>
					<p>{m.pd_about_takedowns_body()}</p>
				</Section>
			</div>
		</main>
	);
}

import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { m } from "@/paraglide/messages";
import { ENGINE_LICENCE } from "../engine/files";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	const headingId = `${id}-title`;
	return (
		<section id={id} aria-labelledby={headingId} className="ch-rule flex scroll-mt-20 flex-col gap-3 pt-4">
			<h2 id={headingId} className="ch-display text-ch-head">
				{title}
			</h2>
			{children}
		</section>
	);
}

const link = "underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A link to another site: it says so, and opens in a new tab. */
function External({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a href={href} target="_blank" rel="noopener" className={`inline-flex items-center gap-1 ${link}`}>
			{children}
			<ExternalLinkIcon aria-hidden className="size-3.5" />
			<span className="sr-only">{m.ch_opens_new_tab()}</span>
		</a>
	);
}

/** One credit: what it is, who made it, its licence, and where to read it. */
function Credit({ what, by, licence, href }: { what: string; by: string; licence: string; href: string }) {
	return (
		<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
			<dt className="font-semibold">{what}</dt>
			<dd className="flex flex-col gap-0.5">
				<span>{by}</span>
				<span className="text-ch-muted text-sm">
					{licence} · <External href={href}>{m.ch_about_read_licence()}</External>
				</span>
			</dd>
		</div>
	);
}

/**
 * /app/chaal/about (PLAN Task 73): what Chaal is, that it's powered by Lichess and not
 * affiliated (PLAN 13.6), what connecting shares, the credits and licences (the cburnett
 * pieces under BSD 3-clause, our own sounds, the typefaces), and Stockfish's source.
 * Indexable.
 */
export function ChaalAbout() {
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-about">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 pt-10 pb-16 leading-relaxed sm:px-6 lg:pt-14">
				<header className="flex flex-col gap-3">
					<h1 className="ch-display text-ch-title">{m.ch_about_title()}</h1>
					<p className="text-ch-muted text-lg">{m.ch_about_intro()}</p>
				</header>
				<Section id="lichess" title={m.ch_about_lichess_title()}>
					<p>{m.ch_about_lichess_body()}</p>
					<p>{m.ch_about_not_affiliated()}</p>
					<p className="text-ch-muted">{m.ch_about_fair_play()}</p>
					<p>
						<External href="https://lichess.org/api">{m.ch_about_lichess_api()}</External>
					</p>
				</Section>
				<Section id="account" title={m.ch_about_account_title()}>
					<p>{m.ch_about_account_body()}</p>
					<p className="text-ch-muted">{m.ch_about_account_token()}</p>
				</Section>
				<Section id="credits" title={m.ch_about_credits_title()}>
					<dl className="flex flex-col">
						<Credit
							what={m.ch_about_credit_pieces()}
							by={m.ch_about_credit_pieces_by()}
							licence={m.ch_about_licence_bsd3()}
							href="/chaal/pieces/cburnett/LICENSE.txt"
						/>
						<div className="ch-hairline grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
							<dt className="font-semibold">{m.ch_about_credit_sounds()}</dt>
							<dd>{m.ch_about_credit_sounds_by()}</dd>
						</div>
						<Credit
							what={m.ch_about_credit_display_type()}
							by={m.ch_about_credit_display_type_by()}
							licence={m.ch_about_licence_ofl()}
							href="https://openfontlicense.org"
						/>
						<Credit
							what={m.ch_about_credit_text_type()}
							by={m.ch_about_credit_text_type_by()}
							licence={m.ch_about_licence_ofl()}
							href="https://openfontlicense.org"
						/>
					</dl>
				</Section>
				<Section id="stockfish" title={m.ch_about_stockfish_title()}>
					<p>{m.ch_about_stockfish_body()}</p>
					<ul className="flex flex-col gap-2">
						<li>
							<External href="https://github.com/official-stockfish/Stockfish">
								{m.ch_about_stockfish_source()}
							</External>
						</li>
						<li>
							<External href="https://github.com/nmrugg/stockfish.js">{m.ch_about_stockfish_build()}</External>
						</li>
						<li>
							<External href="https://www.gnu.org/licenses/gpl-3.0.html">{m.ch_about_stockfish_licence()}</External>
						</li>
						<li>
							{/* The copy shipped beside the engine's files (pnpm engine:copy, decision 0263). */}
							<a href={ENGINE_LICENCE} className="underline underline-offset-4">
								{m.ch_about_stockfish_copying()}
							</a>
						</li>
					</ul>
				</Section>
			</div>
		</main>
	);
}

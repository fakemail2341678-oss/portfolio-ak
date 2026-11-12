import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LedgerLine, LedgerPage, SystemLine } from "../kit/ledger";
import { Money } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";

/**
 * A page of the book, drawn for the landing and the sign-in pages (decorative: the words
 * beside it say the same). A trip's lines dated in the margin, a payment struck through in
 * red ink, and the balance ruled twice: the look's memorable moment (decision 0281).
 */
export function KharchaArt({ className }: { className?: string }) {
	const lines = [
		{ day: "2026-10-03", who: "Asha", color: "violet", title: m.kharcha_art_bus(), amount: 360_000 },
		{ day: "2026-10-04", who: "Bikash", color: "indigo", title: m.kharcha_art_hotel(), amount: 900_000 },
		{ day: "2026-10-05", who: "Sita", color: "pink", title: m.kharcha_art_dinner(), amount: 486_550 },
	] as const;
	return (
		<div
			aria-hidden
			className={cn("overflow-hidden rounded-md border border-kh-hair bg-kh-page shadow-sm", className)}
			data-testid="kharcha-art"
		>
			<div className="flex items-baseline justify-between gap-3 border-kh-hair border-b px-4 py-3 sm:px-6">
				<span className="kh-display text-kh-head">{m.kharcha_art_title()}</span>
				<span className="text-caption text-kh-muted">{m.kharcha_art_people()}</span>
			</div>
			<LedgerPage>
				{lines.map((line) => (
					<LedgerLine key={line.day} day={line.day}>
						<div className="flex items-center gap-3">
							<PersonAvatar name={line.who} color={line.color} size="sm" />
							<span className="min-w-0 flex-1 truncate">{line.title}</span>
							<Money amountMinor={line.amount} currency="NPR" size="sm" />
						</div>
					</LedgerLine>
				))}
				<LedgerLine day="2026-10-06">
					<div className="flex items-center gap-3">
						<SystemLine>{m.kharcha_art_paid()}</SystemLine>
						<Money amountMinor={300_000} currency="NPR" size="sm" struck className="ms-auto" />
					</div>
				</LedgerLine>
				<LedgerLine>
					<div className="flex items-baseline justify-between gap-3 py-1">
						<span className="text-caption text-kh-muted">{m.kharcha_art_owed()}</span>
						<Money amountMinor={186_667} currency="NPR" tone="owed" className="kh-double" />
					</div>
				</LedgerLine>
			</LedgerPage>
		</div>
	);
}

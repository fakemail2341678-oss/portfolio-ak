import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon } from "lucide-react";
import { formatMoney } from "@/lib/i18n/currency";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import type { Amount } from "../types";

/**
 * Kharcha's kit (decision 0281, the guide's "The look"): money, people and the lines of a
 * page, in "Bahi Khata". Amounts are integer minor units of their own currency (0278).
 */

export type MoneyTone = "owed" | "owe" | "muted";

const TONES: Record<MoneyTone, string> = {
	owed: "text-kh-owed",
	owe: "text-kh-owe",
	muted: "text-kh-muted",
};

const SIZES = {
	sm: "text-caption",
	md: "text-body",
	lg: "kh-display text-kh-head",
	hero: "kh-display text-kh-hero",
} as const;

/**
 * An amount, the one way money is drawn: tabular figures in the locale's digits, coloured
 * only together with words somewhere beside it (`BalancePill` and the cards say who owes),
 * struck through in red ink once it is settled.
 */
export function Money({
	amountMinor,
	currency,
	tone,
	size = "md",
	struck = false,
	className,
}: {
	amountMinor: number;
	currency: string;
	tone?: MoneyTone;
	size?: keyof typeof SIZES;
	/** Settled: a payment that cleared it. */
	struck?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"kh-figures whitespace-nowrap font-semibold",
				SIZES[size],
				tone && TONES[tone],
				struck && "kh-struck text-kh-muted",
				className,
			)}
		>
			{formatMoney(amountMinor, currency)}
		</span>
	);
}

type Direction = "owed" | "owe";

const DIRECTION = {
	owed: { icon: ArrowDownLeftIcon, words: () => m.kharcha_kit_owed_to_you() },
	owe: { icon: ArrowUpRightIcon, words: () => m.kharcha_kit_you_owe() },
} as const;

/**
 * A balance in words, per currency: "NPR 4,250.00 ↙ owed to you", "NPR 1,180.00 ↗ you owe",
 * or "settled up" when every currency is at zero. `balances` are signed: above zero, the
 * caller is owed. `stack` puts the words under the amount (a list's right edge); `inline`
 * keeps them on one line (a page's header on a phone).
 */
export function BalancePill({
	balances,
	layout = "stack",
	size = "md",
	double = false,
	className,
}: {
	balances: ReadonlyArray<Amount>;
	layout?: "stack" | "inline";
	size?: "md" | "lg";
	/** A total: ruled twice under the amount. */
	double?: boolean;
	className?: string;
}) {
	const open = balances.filter((balance) => balance.amountMinor !== 0);
	if (open.length === 0) {
		return (
			<span className={cn("inline-flex items-center gap-1 text-caption text-kh-muted", className)}>
				<CheckIcon className="size-3.5" aria-hidden />
				{m.kharcha_kit_settled()}
			</span>
		);
	}
	return (
		<span className={cn("inline-flex flex-col gap-1", layout === "stack" && "items-end text-end", className)}>
			{open.map(({ currency, amountMinor }) => {
				const direction: Direction = amountMinor > 0 ? "owed" : "owe";
				const { icon: Icon, words } = DIRECTION[direction];
				return (
					<span
						key={currency}
						className={cn(
							"flex",
							layout === "stack" ? "flex-col items-end" : "items-baseline gap-2",
							direction === "owed" ? "text-kh-owed" : "text-kh-owe",
						)}
						data-direction={direction}
					>
						<Money
							amountMinor={Math.abs(amountMinor)}
							currency={currency}
							size={size === "lg" ? "lg" : "md"}
							className={cn(double && "kh-double")}
						/>
						<span className="inline-flex items-center gap-0.5 font-medium text-caption">
							<Icon className="size-3.5" aria-hidden />
							{words()}
						</span>
					</span>
				);
			})}
		</span>
	);
}

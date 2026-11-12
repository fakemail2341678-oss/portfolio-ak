import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeyLabel } from "@/hooks/use-hotkeys";
import { isoDateInstant, todayInZone } from "@/lib/i18n/date-only";
import { formatDate, formatMonthShort, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { LedgerLine, LedgerPage } from "../kit/ledger";
import { Money } from "../kit/money";
import { kharchaHomeQueryOptions, kharchaMeQueryOptions } from "../queries";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import { CreateMenu } from "../shell/create-menu";
import type { Amount, KharchaHome as Home } from "../types";
import { OnboardingCard } from "./onboarding";
import { recentSentence } from "./recent-line";

/**
 * Home (PLAN 14.5 "UX"): a to-do list first (each later task adds its kinds), then what the
 * caller is owed and owes per currency, this month's spending against last month's, and
 * recent activity. "Split with people" puts the balances first, "track my spending" the
 * month; on a laptop the to-dos hold the left column. Onboarding sits above it all until done.
 */
export function KharchaHome() {
	const userId = useKharchaUserId();
	const { data: me } = useSuspenseQuery(kharchaMeQueryOptions(userId));
	const { data: home } = useSuspenseQuery(kharchaHomeQueryOptions(userId));
	const { openPalette } = useKharchaActions();
	const palette = useHotkeyLabel("mod+k");
	const name = me.isGuest ? m.guest_label() : me.person.name;
	const summary =
		me.profile.start === "split"
			? [<Balances key="balances" home={home} />, <Month key="month" home={home} />]
			: [<Month key="month" home={home} />, <Balances key="balances" home={home} />];
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-home">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h1 className="kh-display truncate text-kh-title">{m.kharcha_home_greeting({ name })}</h1>
					<p className="text-caption text-kh-muted">
						{formatDate(isoDateInstant(me.today), { dateStyle: "full", timeZone: "UTC" })}
					</p>
				</div>
				<div className="ms-auto hidden items-center gap-2 md:flex">
					<button
						type="button"
						onClick={openPalette}
						className="kh-ease flex h-9 w-56 items-center gap-2 rounded-md border border-kh-hair bg-kh-ground px-2.5 text-kh-muted text-sm outline-none hover:border-kh-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:w-72"
						aria-keyshortcuts="Control+K Meta+K"
					>
						<SearchIcon className="size-4" aria-hidden />
						<span className="flex-1 truncate text-start">{m.kharcha_home_search()}</span>
						<Kbd>{palette}</Kbd>
					</button>
					<CreateMenu>
						<Button data-testid="kharcha-new">
							<PlusIcon aria-hidden />
							{m.kharcha_create_button()}
						</Button>
					</CreateMenu>
				</div>
			</header>
			{me.profile.onboarded ? null : (
				<div className="px-4 pt-4 sm:px-8 sm:pt-6">
					<OnboardingCard me={me} userId={userId} />
				</div>
			)}
			<div className="grid flex-1 content-start gap-4 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
				<Sheet className="lg:col-start-2" testId="kharcha-home-summary">
					{summary}
				</Sheet>
				<Sheet className="self-start lg:col-start-1 lg:row-span-2 lg:row-start-1" testId="kharcha-home-todo">
					<SheetHead title={m.kharcha_home_todo()} count={home.todos.length} />
					<KharchaEmpty kind="todo" className="border-0 py-10" />
				</Sheet>
				<Sheet className="self-start lg:col-start-2" testId="kharcha-home-recent">
					<SheetHead title={m.kharcha_home_recent()} />
					{home.recent.length === 0 ? (
						<p className="px-4 py-6 text-center text-kh-muted text-sm sm:px-5">{m.kharcha_home_recent_empty()}</p>
					) : (
						<LedgerPage aria-label={m.kharcha_home_recent()}>
							{home.recent.map((line, index) => {
								const day = todayInZone(me.profile.timeZone, new Date(line.at));
								const previous = home.recent[index - 1];
								const sameDay = previous && todayInZone(me.profile.timeZone, new Date(previous.at)) === day;
								return (
									<LedgerLine key={line.id} {...(sameDay ? {} : { day })}>
										<p className="text-sm">{recentSentence(line)}</p>
									</LedgerLine>
								);
							})}
						</LedgerPage>
					)}
				</Sheet>
			</div>
		</main>
	);
}

function Sheet({ children, className, testId }: { children: ReactNode; className?: string; testId: string }) {
	return (
		<section
			className={cn("overflow-hidden rounded-lg border border-kh-hair bg-kh-page", className)}
			data-testid={testId}
		>
			{children}
		</section>
	);
}

function SheetHead({ title, count }: { title: string; count?: number }) {
	return (
		<div className="flex items-baseline gap-2 border-kh-hair border-b px-4 py-3 sm:px-5">
			<h2 className="kh-display text-kh-head">{title}</h2>
			{count ? <span className="text-caption text-kh-muted">{formatNumber(count)}</span> : null}
		</div>
	);
}

/** What the caller is owed and owes, per currency, in words and arrows as well as colour; ruled twice. */
function Balances({ home }: { home: Home }) {
	const { owed, owe } = home.balances;
	if (owed.length === 0 && owe.length === 0) {
		return (
			<div className="flex items-center gap-2 px-4 py-4 text-kh-muted text-sm sm:px-5" data-testid="kharcha-settled">
				<CheckIcon className="size-4" aria-hidden />
				{m.kharcha_home_settled()}
			</div>
		);
	}
	return (
		<div className="border-kh-hair border-b last:border-b-0">
			<div className="grid grid-cols-2 divide-x divide-kh-hair rtl:divide-x-reverse">
				<Side direction="owed" amounts={owed} />
				<Side direction="owe" amounts={owe} />
			</div>
			<p className="border-kh-hair border-t px-4 py-2 text-caption text-kh-muted sm:px-5">
				{home.openWith === 1
					? m.kharcha_home_open_with_one()
					: m.kharcha_home_open_with_other({ people: formatNumber(home.openWith) })}
			</p>
		</div>
	);
}

function Side({ direction, amounts }: { direction: "owed" | "owe"; amounts: ReadonlyArray<Amount> }) {
	const Icon = direction === "owed" ? ArrowDownLeftIcon : ArrowUpRightIcon;
	const [first, ...rest] = amounts;
	return (
		<div className="flex min-w-0 flex-col gap-1 px-4 py-4 sm:px-5" data-testid={`kharcha-home-${direction}`}>
			<p
				className={cn(
					"flex items-center gap-1 font-semibold text-caption",
					direction === "owed" ? "text-kh-owed" : "text-kh-owe",
				)}
			>
				<Icon className="size-3.5" aria-hidden />
				{direction === "owed" ? m.kharcha_home_owed() : m.kharcha_home_owe()}
			</p>
			{first ? (
				<Money
					amountMinor={first.amountMinor}
					currency={first.currency}
					tone={direction}
					size="lg"
					className="kh-double self-start"
				/>
			) : (
				<span className="text-kh-muted text-sm">{m.kharcha_home_nothing()}</span>
			)}
			{rest.map((amount) => (
				<Money
					key={amount.currency}
					amountMinor={amount.amountMinor}
					currency={amount.currency}
					tone={direction}
					size="sm"
				/>
			))}
		</div>
	);
}

/**
 * This month's spending against last month's, per currency (the caller's share; a refund
 * counts against it): two bars on one scale, the amounts written beside them.
 */
function Month({ home }: { home: Home }) {
	const { current, previous, spent } = home.month;
	return (
		<div className="border-kh-hair border-b px-4 py-4 last:border-b-0 sm:px-5" data-testid="kharcha-home-month">
			<p className="font-semibold text-caption">{m.kharcha_home_month()}</p>
			{spent.length === 0 ? (
				<p className="mt-2 text-kh-muted text-sm">{m.kharcha_home_month_empty()}</p>
			) : (
				<div className="mt-3 flex flex-col gap-4">
					{spent.map((row) => {
						const scale = Math.max(row.current, row.previous, 1);
						const bars = [
							{ month: current, value: row.current, now: true },
							{ month: previous, value: row.previous, now: false },
						];
						return (
							<dl key={row.currency} className="flex flex-col gap-1.5">
								{bars.map((bar) => (
									<div
										key={bar.month}
										className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 text-caption"
									>
										<dt className={bar.now ? "font-medium" : "text-kh-muted"}>{formatMonthShort(bar.month)}</dt>
										<span aria-hidden className="h-2.5 overflow-hidden rounded-sm bg-kh-rule">
											<span
												className={cn("block h-full rounded-sm", bar.now ? "bg-kh-ink" : "bg-kh-muted/50")}
												style={{ width: `${Math.max(0, (bar.value / scale) * 100)}%` }}
											/>
										</span>
										<dd>
											<Money
												amountMinor={bar.value}
												currency={row.currency}
												size="sm"
												{...(bar.now ? {} : { tone: "muted" as const })}
											/>
										</dd>
									</div>
								))}
							</dl>
						);
					})}
				</div>
			)}
		</div>
	);
}

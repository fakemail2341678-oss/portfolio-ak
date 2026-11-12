import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatMoney, toMajor } from "@/lib/i18n/currency";
import { currencySymbol } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { SPLIT_METHOD_LABELS } from "../groups/labels";
import { Money } from "../kit/money";
import type { Debt } from "../money/ledger";
import { splitProblemMessage } from "../money/problem";
import { itemizedExtras, SPLIT_METHODS } from "../money/split";
import type { ExpenseKind, KharchaPerson } from "../types";
import { type BuiltSplit, buildSplit, linesSubtotal, newLine, type SplitDraft } from "./split-model";

/**
 * The split editor (Task 90, PLAN 14.5; lazy, inside the expense dialog): who paid (one
 * person or several), how it is split (equal, exact amounts, percentages, shares,
 * adjustments, an itemized bill with the service-charge and VAT presets, or one person
 * owing all of it), each person's share live, and under it either what is left to assign
 * or the sentence the split makes ("You paid NPR 3,000.00; Asha owes you NPR 1,000.00").
 * Every control is native (radios, checkboxes, selects, text fields), so it works from the
 * keyboard alone: Tab between them, arrow keys between methods.
 */
export default function SplitEditor({
	draft,
	onChange,
	people,
	amountMinor,
	currency,
	kind,
}: {
	draft: SplitDraft;
	onChange: (draft: SplitDraft) => void;
	/** Everyone on it, the caller among them (`isMe`). */
	people: ReadonlyArray<KharchaPerson>;
	amountMinor: number;
	currency: string;
	kind: ExpenseKind;
}) {
	const id = useId();
	const person = (personId: string) => people.find((each) => each.id === personId);
	const nameOf = (personId: string) => {
		const found = person(personId);
		return found?.isMe ? m.kharcha_you_subject() : (found?.name ?? m.kharcha_someone());
	};
	const built = amountMinor > 0 ? buildSplit(draft, amountMinor, currency, kind) : null;
	const shareOf = (personId: string) =>
		built?.ok ? (built.shares.find((share) => share.person === personId)?.owed ?? 0) : null;
	const set = (patch: Partial<SplitDraft>) => onChange({ ...draft, ...patch });
	const setValue = (key: "exact" | "percent" | "shares" | "adjust" | "paid", personId: string, value: string) =>
		set({ [key]: { ...draft[key], [personId]: value } });
	const symbol = currencySymbol(currency);

	return (
		<fieldset
			className="flex flex-col gap-4 rounded-lg border border-kh-hair bg-kh-ground/60 p-3 sm:p-4"
			data-testid="kharcha-split-editor"
		>
			<legend className="px-1 font-semibold text-sm">{m.kharcha_split_title()}</legend>

			<div className="flex flex-col gap-2">
				<label htmlFor={`${id}-payer`} className="font-medium text-sm">
					{m.kharcha_split_paid_by()}
				</label>
				<NativeSelect
					id={`${id}-payer`}
					value={draft.several ? "several" : draft.payer}
					onChange={(event) =>
						event.target.value === "several"
							? set({ several: true })
							: set({ several: false, payer: event.target.value })
					}
					data-testid="kharcha-split-payer"
				>
					{draft.people.map((personId) => (
						<option key={personId} value={personId}>
							{nameOf(personId)}
						</option>
					))}
					<option value="several">{m.kharcha_split_several()}</option>
				</NativeSelect>
				{draft.several ? (
					<PeopleRows
						people={draft.people}
						nameOf={nameOf}
						render={(personId) => (
							<NumberInput
								label={m.kharcha_split_paid_label({ name: nameOf(personId) })}
								suffix={symbol}
								value={draft.paid[personId] ?? ""}
								onChange={(value) => setValue("paid", personId, value)}
								testId="kharcha-split-paid"
							/>
						)}
					/>
				) : null}
			</div>

			<fieldset className="flex flex-col gap-2">
				<legend className="mb-2 font-medium text-sm">{m.kharcha_split_how()}</legend>
				<div className="flex flex-wrap gap-1" data-testid="kharcha-split-methods">
					{SPLIT_METHODS.map((method) => (
						<label
							key={method}
							className="kh-ease cursor-pointer rounded-md border border-kh-hair bg-kh-page px-2.5 py-1.5 text-sm outline-none has-[:checked]:border-kh-ink has-[:checked]:bg-kh-sel has-[:checked]:font-semibold has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
						>
							<input
								type="radio"
								name={`${id}-method`}
								value={method}
								checked={draft.method === method}
								onChange={() => set({ method })}
								className="sr-only"
							/>
							{SPLIT_METHOD_LABELS[method]()}
						</label>
					))}
				</div>
			</fieldset>

			<MethodBody
				draft={draft}
				set={set}
				setValue={setValue}
				nameOf={nameOf}
				shareOf={shareOf}
				currency={currency}
				symbol={symbol}
			/>

			<SplitStatus built={built} currency={currency} kind={kind} nameOf={nameOf} people={people} />
		</fieldset>
	);
}

type SetValue = (key: "exact" | "percent" | "shares" | "adjust" | "paid", personId: string, value: string) => void;

function MethodBody({
	draft,
	set,
	setValue,
	nameOf,
	shareOf,
	currency,
	symbol,
}: {
	draft: SplitDraft;
	set: (patch: Partial<SplitDraft>) => void;
	setValue: SetValue;
	nameOf: (personId: string) => string;
	shareOf: (personId: string) => number | null;
	currency: string;
	symbol: string;
}) {
	const id = useId();
	const share = (personId: string) => {
		const owed = shareOf(personId);
		return owed === null ? null : <Money amountMinor={owed} currency={currency} size="sm" />;
	};
	switch (draft.method) {
		case "equal":
			return (
				<PeopleRows
					people={draft.people}
					nameOf={nameOf}
					share={share}
					render={(personId) => (
						<input
							type="checkbox"
							className="size-4 accent-[var(--kh-act)]"
							checked={draft.included.includes(personId)}
							onChange={(event) =>
								set({
									included: event.target.checked
										? draft.people.filter((each) => each === personId || draft.included.includes(each))
										: draft.included.filter((each) => each !== personId),
								})
							}
							aria-label={m.kharcha_split_include({ name: nameOf(personId) })}
							data-testid="kharcha-split-include"
						/>
					)}
				/>
			);
		case "exact":
		case "percent":
		case "shares":
		case "adjustment": {
			const key = draft.method === "adjustment" ? "adjust" : draft.method;
			const suffix =
				draft.method === "percent" ? "%" : draft.method === "shares" ? m.kharcha_split_shares_unit() : symbol;
			const label = (personId: string) =>
				draft.method === "exact"
					? m.kharcha_split_amount_label({ name: nameOf(personId) })
					: draft.method === "percent"
						? m.kharcha_split_percent_label({ name: nameOf(personId) })
						: draft.method === "shares"
							? m.kharcha_split_shares_label({ name: nameOf(personId) })
							: m.kharcha_split_adjust_label({ name: nameOf(personId) });
			return (
				<div className="flex flex-col gap-2">
					{draft.method === "adjustment" ? (
						<p className="text-caption text-kh-muted">{m.kharcha_split_adjust_help()}</p>
					) : null}
					<PeopleRows
						people={draft.people}
						nameOf={nameOf}
						share={draft.method === "exact" ? undefined : share}
						render={(personId) => (
							<NumberInput
								label={label(personId)}
								suffix={suffix}
								value={draft[key][personId] ?? ""}
								onChange={(value) => setValue(key, personId, value)}
								allowNegative={draft.method === "adjustment"}
								testId={`kharcha-split-${draft.method}`}
							/>
						)}
					/>
				</div>
			);
		}
		case "itemized":
			return <Itemized draft={draft} set={set} nameOf={nameOf} share={share} currency={currency} symbol={symbol} />;
		case "full":
			return (
				<div className="flex flex-col gap-2">
					<label htmlFor={`${id}-owes`} className="font-medium text-sm">
						{m.kharcha_split_owes_all()}
					</label>
					<NativeSelect
						id={`${id}-owes`}
						value={draft.owesAll}
						onChange={(event) => set({ owesAll: event.target.value })}
						data-testid="kharcha-split-owes-all"
					>
						{draft.people.map((personId) => (
							<option key={personId} value={personId}>
								{nameOf(personId)}
							</option>
						))}
					</NativeSelect>
				</div>
			);
	}
}

/** An itemized bill: lines with who had each, then the service charge and VAT, with presets on the subtotal. */
function Itemized({
	draft,
	set,
	nameOf,
	share,
	currency,
	symbol,
}: {
	draft: SplitDraft;
	set: (patch: Partial<SplitDraft>) => void;
	nameOf: (personId: string) => string;
	share: (personId: string) => React.ReactNode;
	currency: string;
	symbol: string;
}) {
	const id = useId();
	const setLine = (key: string, patch: Partial<SplitDraft["lines"][number]>) =>
		set({ lines: draft.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)) });
	const subtotal = linesSubtotal(draft, currency);
	const presets = Number.isSafeInteger(subtotal) && subtotal > 0 ? itemizedExtras(subtotal) : null;
	/** A preset as the field's text: major units, ungrouped. */
	const text = (minor: number) => String(toMajor(minor, currency));
	return (
		<div className="flex flex-col gap-3" data-testid="kharcha-split-itemized">
			<ol className="flex flex-col gap-3">
				{draft.lines.map((line, index) => (
					<li
						key={line.key}
						className="flex flex-col gap-2 rounded-md border border-kh-hair bg-kh-page p-2.5"
						data-testid="kharcha-split-line"
					>
						<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto] items-end gap-2">
							<span className="flex flex-col gap-1 text-caption">
								<label htmlFor={`${id}-${line.key}`}>{m.kharcha_split_line_label({ number: String(index + 1) })}</label>
								<Input
									id={`${id}-${line.key}`}
									value={line.label}
									maxLength={80}
									onChange={(event) => setLine(line.key, { label: event.target.value })}
								/>
							</span>
							<NumberInput
								label={m.kharcha_split_line_amount({ number: String(index + 1) })}
								visibleLabel
								suffix={symbol}
								value={line.amount}
								onChange={(value) => setLine(line.key, { amount: value })}
								testId="kharcha-split-line-amount"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								disabled={draft.lines.length === 1}
								onClick={() => set({ lines: draft.lines.filter((each) => each.key !== line.key) })}
							>
								<Trash2Icon aria-hidden />
								<span className="sr-only">{m.kharcha_split_line_remove({ number: String(index + 1) })}</span>
							</Button>
						</div>
						<fieldset className="flex flex-wrap gap-1">
							<legend className="sr-only">{m.kharcha_split_line_who({ number: String(index + 1) })}</legend>
							{draft.people.map((personId) => (
								<label
									key={personId}
									className="kh-ease flex cursor-pointer items-center gap-1.5 rounded-full border border-kh-hair px-2.5 py-1 text-caption has-[:checked]:border-kh-ink has-[:checked]:bg-kh-sel has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
								>
									<input
										type="checkbox"
										className="size-3.5 accent-[var(--kh-act)]"
										checked={line.people.includes(personId)}
										onChange={(event) =>
											setLine(line.key, {
												people: event.target.checked
													? draft.people.filter((each) => each === personId || line.people.includes(each))
													: line.people.filter((each) => each !== personId),
											})
										}
									/>
									{nameOf(personId)}
								</label>
							))}
						</fieldset>
					</li>
				))}
			</ol>
			<div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => set({ lines: [...draft.lines, newLine(draft.people)] })}
					data-testid="kharcha-split-add-line"
				>
					<PlusIcon aria-hidden />
					{m.kharcha_split_add_line()}
				</Button>
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex flex-col gap-1">
					<NumberInput
						label={m.kharcha_split_service()}
						visibleLabel
						suffix={symbol}
						value={draft.service}
						onChange={(value) => set({ service: value })}
						testId="kharcha-split-service"
					/>
					{presets ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto self-start px-0"
							onClick={() => set({ service: text(presets.service) })}
							data-testid="kharcha-split-service-preset"
						>
							{m.kharcha_split_service_preset()}
						</Button>
					) : null}
				</div>
				<div className="flex flex-col gap-1">
					<NumberInput
						label={m.kharcha_split_tax()}
						visibleLabel
						suffix={symbol}
						value={draft.tax}
						onChange={(value) => set({ tax: value })}
						testId="kharcha-split-tax"
					/>
					{presets ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto self-start px-0"
							onClick={() => set({ service: text(presets.service), tax: text(presets.tax) })}
							data-testid="kharcha-split-tax-preset"
						>
							{m.kharcha_split_tax_preset()}
						</Button>
					) : null}
				</div>
			</div>
			<PeopleRows people={draft.people} nameOf={nameOf} share={share} />
		</div>
	);
}

/** One row per person: their name, a control, and their share once the split adds up. */
function PeopleRows({
	people,
	nameOf,
	render,
	share,
}: {
	people: ReadonlyArray<string>;
	nameOf: (personId: string) => string;
	render?: (personId: string) => React.ReactNode;
	share?: ((personId: string) => React.ReactNode) | undefined;
}) {
	return (
		<ul className="flex flex-col divide-y divide-kh-rule rounded-md border border-kh-hair bg-kh-page">
			{people.map((personId) => (
				<li
					key={personId}
					className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-1.5"
					data-testid="kharcha-split-person"
				>
					<span className="truncate text-sm">{nameOf(personId)}</span>
					{render ? render(personId) : <span />}
					<span className="min-w-20 text-end">{share ? share(personId) : null}</span>
				</li>
			))}
		</ul>
	);
}

/** A number typed as text (Devanagari digits read): the core says what is wrong with it. */
function NumberInput({
	label,
	visibleLabel = false,
	suffix,
	value,
	onChange,
	allowNegative = false,
	testId,
}: {
	label: string;
	visibleLabel?: boolean;
	suffix: string;
	value: string;
	onChange: (value: string) => void;
	allowNegative?: boolean;
	testId: string;
}) {
	const id = useId();
	return (
		<span className="flex flex-col gap-1">
			<label htmlFor={id} className={cn("text-caption", !visibleLabel && "sr-only")}>
				{label}
			</label>
			<span className="flex items-center gap-1.5">
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					inputMode={allowNegative ? "text" : "decimal"}
					autoComplete="off"
					className="kh-figures w-24 text-end"
					data-testid={testId}
				/>
				<span className="text-caption text-kh-muted" aria-hidden>
					{suffix}
				</span>
			</span>
		</span>
	);
}

/**
 * What is left to assign, live (hatched, the book's mark for a problem), or the sentence the
 * split makes. A live region, so a screen reader hears it as the numbers are typed.
 */
function SplitStatus({
	built,
	currency,
	kind,
	nameOf,
	people,
}: {
	built: BuiltSplit | null;
	currency: string;
	kind: ExpenseKind;
	nameOf: (personId: string) => string;
	people: ReadonlyArray<KharchaPerson>;
}) {
	const text = !built
		? m.kharcha_split_need_amount()
		: built.ok
			? splitSentence(built, currency, kind, nameOf, people)
			: built.where === "payers" && built.problem.code === "unassigned"
				? built.problem.left > 0
					? m.kharcha_split_payers_left({ amount: formatMoney(built.problem.left, currency) })
					: m.kharcha_split_payers_over({ amount: formatMoney(-built.problem.left, currency) })
				: splitProblemMessage(built.problem, currency);
	return (
		<output
			className={cn(
				"block rounded-md border px-3 py-2 text-sm",
				built && !built.ok ? "kh-hatch border-kh-owe font-medium" : "border-kh-hair bg-kh-page",
			)}
			data-testid="kharcha-split-status"
			data-ok={built?.ok ? "true" : "false"}
		>
			{text}
		</output>
	);
}

/** "You paid NPR 3,000.00; Asha owes you NPR 1,000.00; Bikash owes you NPR 1,000.00." */
export function splitSentence(
	built: Extract<BuiltSplit, { ok: true }>,
	currency: string,
	kind: ExpenseKind,
	nameOf: (personId: string) => string,
	people: ReadonlyArray<KharchaPerson>,
): string {
	const isMe = (personId: string) => people.find((person) => person.id === personId)?.isMe === true;
	const money = (minor: number) => formatMoney(minor, currency);
	const paid = built.payers.map((payer) =>
		kind === "refund"
			? isMe(payer.person)
				? m.kharcha_split_you_got_back({ amount: money(payer.amount) })
				: m.kharcha_split_got_back({ name: nameOf(payer.person), amount: money(payer.amount) })
			: isMe(payer.person)
				? m.kharcha_split_you_paid({ amount: money(payer.amount) })
				: m.kharcha_split_paid({ name: nameOf(payer.person), amount: money(payer.amount) }),
	);
	const owed = built.debts.map((debt: Debt) =>
		isMe(debt.creditor)
			? m.kharcha_split_owes_you({ name: nameOf(debt.debtor), amount: money(debt.amount) })
			: isMe(debt.debtor)
				? m.kharcha_split_you_owe({ name: nameOf(debt.creditor), amount: money(debt.amount) })
				: m.kharcha_split_owes({ from: nameOf(debt.debtor), to: nameOf(debt.creditor), amount: money(debt.amount) }),
	);
	return m.kharcha_split_sentence({
		parts: [...paid, ...(owed.length > 0 ? owed : [m.kharcha_split_nobody_owes()])].join(m.kharcha_split_join()),
	});
}

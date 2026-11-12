import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { withKharcha } from "../../../../.storybook/mocks/kharcha-section";
import { CATEGORY_ICONS, FIX_KINDS, KHARCHA_COLORS, type KharchaPerson } from "../types";
import { ExpenseCard, PaymentCard } from "./cards";
import { CategoryIcon } from "./category-icon";
import { KHARCHA_EMPTY, KharchaEmpty } from "./empty";
import { FixBadge } from "./fix-badge";
import { LedgerLine, LedgerPage, SystemLine } from "./ledger";
import { BalancePill, Money } from "./money";
import { PersonAvatar, personInitials } from "./person-avatar";
import { KharchaMark, KharchaWordmark } from "./wordmark";

/**
 * Kharcha's kit, "Bahi Khata" (src/styles/kharcha.css, decision 0281), in the theme and
 * locale of the run: Storybook's tests run it in en/light and ne/dark, axe included.
 */
const meta = {
	title: "Kharcha/Kit",
	args: { onOpen: fn() },
	decorators: [withKharcha],
	parameters: { layout: "fullscreen" },
} satisfies Meta<{ onOpen: () => void }>;
export default meta;
type Story = StoryObj<{ onOpen: () => void }>;

const me: KharchaPerson = { id: "me", name: "Maya Shrestha", color: "amber", isMe: true, hasAccount: true };
const asha: KharchaPerson = { id: "asha", name: "Asha Gurung", color: "orange", isMe: false, hasAccount: true };
const bikash: KharchaPerson = { id: "bikash", name: "Bikash Thapa", color: "green", isMe: false, hasAccount: true };
const sita: KharchaPerson = { id: "sita", name: "सीता राई", color: "pink", isMe: false, hasAccount: false };
const people = [me, asha, bikash, sita];

const Sheet = ({ children }: { children: React.ReactNode }) => (
	<div className="min-h-dvh bg-kh-ground p-6 text-kh-ink">{children}</div>
);

const SWATCHES = [
	["Ground", "bg-kh-ground"],
	["Page", "bg-kh-page"],
	["Ink", "bg-kh-ink"],
	["Cloth", "bg-kh-cloth"],
	["Thread", "bg-kh-thread"],
	["Margin", "bg-kh-margin"],
	["Owed", "bg-kh-owed"],
	["Owe", "bg-kh-owe"],
] as const;

export const Tokens: Story = {
	render: () => (
		<Sheet>
			<ul className="grid grid-cols-2 gap-4 sm:grid-cols-8">
				{SWATCHES.map(([name, swatch]) => (
					<li key={name}>
						<div className={`h-14 rounded-md border border-kh-hair ${swatch}`} />
						<p className="mt-2 text-caption">{name}</p>
					</li>
				))}
			</ul>
			<h1 className="kh-display mt-8 text-kh-title">Pokhara trip · पोखरा यात्रा</h1>
			<div className="mt-4 flex flex-wrap gap-2">
				<Button>Settle up</Button>
				<Button variant="outline">Remind</Button>
				<Button variant="ghost">Cancel</Button>
			</div>
		</Sheet>
	),
	// The real cascade: the section's tokens outrank the visitor's accent and radius, in both themes.
	play: async () => {
		const style = getComputedStyle(document.documentElement);
		await expect(style.getPropertyValue("--radius").trim()).toBe("0.375rem");
		await expect(style.getPropertyValue("--primary")).toBe(style.getPropertyValue("--kh-act"));
		await expect(style.getPropertyValue("--primary-foreground")).toBe(style.getPropertyValue("--kh-on-act"));
		await expect(style.getPropertyValue("--background")).toBe(style.getPropertyValue("--kh-ground"));
	},
};

export const MoneyAndBalances: Story = {
	render: () => (
		<Sheet>
			<div className="flex flex-wrap items-end gap-6">
				<Money amountMinor={684_000} currency="NPR" size="hero" />
				<Money amountMinor={684_000} currency="NPR" size="lg" />
				<Money amountMinor={4_250} currency="USD" />
				<Money amountMinor={150_000} currency="NPR" struck />
				<Money amountMinor={1_200} currency="JPY" size="sm" tone="muted" />
			</div>
			<div className="mt-8 grid max-w-xl grid-cols-2 gap-6 rounded-md border border-kh-hair bg-kh-page p-4 sm:grid-cols-4">
				<BalancePill balances={[{ currency: "NPR", amountMinor: 425_000 }]} />
				<BalancePill balances={[{ currency: "NPR", amountMinor: -118_000 }]} />
				<BalancePill balances={[{ currency: "NPR", amountMinor: 0 }]} />
				<BalancePill
					balances={[
						{ currency: "NPR", amountMinor: 60_000 },
						{ currency: "USD", amountMinor: -4_250 },
					]}
				/>
			</div>
			<div className="mt-6">
				<BalancePill balances={[{ currency: "NPR", amountMinor: 425_000 }]} layout="inline" size="lg" double />
			</div>
		</Sheet>
	),
	play: async ({ canvasElement }) => {
		const canvas = canvasElement as HTMLElement;
		// Every coloured amount says its direction in words too.
		await expect(canvas.querySelectorAll('[data-direction="owed"]')).toHaveLength(3);
		await expect(canvas.querySelectorAll('[data-direction="owe"]')).toHaveLength(2);
		for (const line of canvas.querySelectorAll("[data-direction]"))
			await expect(line.textContent?.length ?? 0).toBeGreaterThan(8);
	},
};

export const People: Story = {
	render: () => (
		<Sheet>
			<ul className="flex flex-wrap gap-4">
				{KHARCHA_COLORS.map((color, i) => (
					<li key={color} className="flex items-center gap-2 text-caption">
						<PersonAvatar name={people[i % people.length]?.name ?? ""} color={color} />
						{color}
					</li>
				))}
			</ul>
			<div className="mt-6 flex items-center gap-3">
				<PersonAvatar name="Pokhara trip" color="blue" size="lg" />
				<PersonAvatar name="सीता राई" color="pink" size="lg" />
				<PersonAvatar name="Bikash" color="green" size="sm" />
			</div>
		</Sheet>
	),
	play: async () => {
		await expect(personInitials("Sita Rai")).toBe("SR");
		await expect(personInitials("सीता राई")).toBe("सीरा");
		await expect(personInitials("Pokhara")).toBe("PO");
		await expect(personInitials("  ")).toBe("?");
	},
};

const dinner = {
	title: "Dinner at Lakeside",
	kind: "expense" as const,
	amountMinor: 684_000,
	currency: "NPR",
	payers: [{ personId: "asha", amountMinor: 684_000 }],
	people,
	myShareMinor: 171_000,
	myPaidMinor: 0,
};

export const APage: Story = {
	render: ({ onOpen }) => {
		return (
			<div className="min-h-dvh bg-kh-ground p-4 text-kh-ink sm:p-6">
				<div className="mx-auto max-w-2xl overflow-hidden rounded-md border border-kh-hair">
					<LedgerPage>
						<LedgerLine day="2026-10-12">
							<SystemLine>Sita added Bikash Thapa to the group</SystemLine>
						</LedgerLine>
						<LedgerLine day="2026-10-12">
							<ExpenseCard
								category="bus"
								expense={{
									...dinner,
									title: "Bus to Pokhara",
									amountMinor: 320_000,
									payers: [{ personId: "me", amountMinor: 320_000 }],
									myShareMinor: 80_000,
									myPaidMinor: 320_000,
								}}
							/>
						</LedgerLine>
						<LedgerLine day="2026-10-14" selected>
							<ExpenseCard category="utensils" expense={dinner} fixes={["receipt"]} onOpen={onOpen} />
						</LedgerLine>
						<LedgerLine day="2026-10-14">
							<PaymentCard
								payment={{
									fromId: "sita",
									toId: "asha",
									amountMinor: 150_000,
									currency: "NPR",
									paid: null,
									method: "eSewa",
									note: "",
									people,
								}}
							/>
						</LedgerLine>
						<LedgerLine day="2026-10-15">
							<ExpenseCard
								expense={{
									...dinner,
									title: "Boat on Phewa",
									amountMinor: 120_000,
									payers: [
										{ personId: "sita", amountMinor: 60_000 },
										{ personId: "bikash", amountMinor: 60_000 },
									],
									myShareMinor: 0,
								}}
								fixes={["uncategorized", "duplicate"]}
							/>
						</LedgerLine>
						<LedgerLine day="2026-10-16">
							<PaymentCard
								payment={{
									fromId: "me",
									toId: "bikash",
									amountMinor: 133_500,
									currency: "NPR",
									paid: { currency: "USD", amountMinor: 1_000, rate: "133.5" },
									method: "Cash",
									note: "Thanks!",
									people,
								}}
							/>
						</LedgerLine>
						<LedgerLine>
							<span />
						</LedgerLine>
					</LedgerPage>
				</div>
			</div>
		);
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button"));
		await expect(args.onOpen).toHaveBeenCalledOnce();
		await expect(canvasElement.querySelector('[aria-current="true"]')).not.toBeNull();
	},
};

export const BadgesAndIcons: Story = {
	render: () => (
		<Sheet>
			<div className="flex flex-wrap gap-2">
				{FIX_KINDS.map((kind) => (
					<FixBadge key={kind} kind={kind} />
				))}
			</div>
			<ul className="mt-6 flex flex-wrap gap-3">
				{CATEGORY_ICONS.map((icon, i) => (
					<li key={icon} title={icon}>
						<CategoryIcon
							icon={icon}
							{...(i % 3 === 0 ? { color: KHARCHA_COLORS[(i / 3) % KHARCHA_COLORS.length] ?? "teal" } : {})}
						/>
					</li>
				))}
				<li>
					<CategoryIcon size="sm" />
				</li>
			</ul>
		</Sheet>
	),
};

export const EmptyStates: Story = {
	render: () => (
		<Sheet>
			<div className="grid gap-4 sm:grid-cols-2">
				{KHARCHA_EMPTY.map((kind) => (
					<KharchaEmpty key={kind} kind={kind} className="bg-kh-page" />
				))}
			</div>
		</Sheet>
	),
};

export const Wordmark: Story = {
	render: () => (
		<Sheet>
			<div className="flex flex-wrap items-center gap-6">
				<div className="flex items-center gap-3 rounded-md bg-kh-cloth px-4 py-3 shadow-[inset_0_-2px_0_var(--kh-thread)]">
					<KharchaWordmark onCloth className="text-xl" />
				</div>
				<KharchaWordmark className="text-2xl" />
				<KharchaMark />
			</div>
		</Sheet>
	),
};

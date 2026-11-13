import type {
	BudgetPeriodView,
	BudgetView,
	InsightsOverview,
	InsightsStatement,
	InsightsTrends,
	RecurringView,
} from "../../src/features/kharcha/types";
import { kharchaPeople } from "./kharcha";

/**
 * Kharcha's planning samples for stories (Task 94): budgets, recurring expenses and
 * insights, as of 12 November 2026, in NPR minor units. The functions' stand-ins in
 * ./functions/kharcha/{budgets,recurring,insights}.ts answer with them.
 */

const { asha, bikash } = kharchaPeople;
const food = { id: "c-food", name: "Food and drink", icon: "utensils", color: "orange" } as const;
const groceries = { id: "c-groceries", name: "Groceries", icon: "shopping-basket", color: "green" } as const;

const period = (start: string, end: string, amountMinor: number, spentMinor: number): BudgetPeriodView => ({
	start,
	end,
	amountMinor,
	spentMinor,
	state: spentMinor >= amountMinor ? "over" : spentMinor * 100 >= amountMinor * 80 ? "near" : "ok",
	percent: Math.floor((spentMinor * 100) / amountMinor),
});

export const sampleKharchaBudgets: BudgetView[] = [
	{
		id: "b-food",
		category: food,
		currency: "NPR",
		period: "month",
		amountMinor: 1_500_000,
		startsOn: "2026-08-01",
		version: 1,
		months: [],
		current: period("2026-11-01", "2026-11-30", 1_500_000, 1_310_000),
		history: [
			period("2026-10-01", "2026-10-31", 1_500_000, 1_620_000),
			period("2026-09-01", "2026-09-30", 1_500_000, 1_140_000),
			period("2026-08-01", "2026-08-31", 1_500_000, 980_000),
		],
	},
	{
		id: "b-groceries",
		category: groceries,
		currency: "NPR",
		period: "week",
		amountMinor: 400_000,
		startsOn: "2026-11-01",
		version: 1,
		months: [],
		current: period("2026-11-08", "2026-11-14", 400_000, 145_000),
		history: [period("2026-11-01", "2026-11-07", 400_000, 380_000)],
	},
	{
		id: "b-all",
		category: null,
		currency: "NPR",
		period: "month",
		amountMinor: 3_000_000,
		startsOn: "2026-11-01",
		version: 1,
		months: [{ month: "2026-11", amountMinor: 3_500_000 }],
		current: period("2026-11-01", "2026-11-30", 3_500_000, 3_620_000),
		history: [],
	},
];

export const sampleKharchaRecurring: RecurringView[] = [
	{
		id: "r-rent",
		kind: "expense",
		title: "Rent",
		merchant: "",
		amountMinor: 4_000_000,
		currency: "NPR",
		myShareMinor: 2_000_000,
		group: { id: "g-flat", name: "Flat 3B" },
		people: [asha],
		category: { id: "c-rent", name: "Rent", icon: "house", color: "blue" },
		unit: "month",
		every: 1,
		startsOn: "2026-09-01",
		nextOn: "2026-12-01",
		endsOn: null,
		ended: false,
		paused: false,
		problem: null,
		lastMadeOn: "2026-11-01",
		made: 3,
		version: 1,
	},
	{
		id: "r-gym",
		kind: "expense",
		title: "",
		merchant: "Fitness Club",
		amountMinor: 250_000,
		currency: "NPR",
		myShareMinor: 250_000,
		group: null,
		people: [],
		category: null,
		unit: "month",
		every: 3,
		startsOn: "2026-02-15",
		nextOn: "2027-02-15",
		endsOn: "2027-12-31",
		ended: false,
		paused: true,
		problem: null,
		lastMadeOn: "2026-11-15",
		made: 4,
		version: 2,
	},
	{
		id: "r-wifi",
		kind: "expense",
		title: "Internet",
		merchant: "WorldLink",
		amountMinor: 160_000,
		currency: "NPR",
		myShareMinor: 80_000,
		group: { id: "g-old", name: "Old flat" },
		people: [bikash],
		category: null,
		unit: "month",
		every: 1,
		startsOn: "2026-05-10",
		nextOn: "2026-11-10",
		endsOn: null,
		ended: false,
		paused: true,
		problem: "group",
		lastMadeOn: "2026-10-10",
		made: 6,
		version: 1,
	},
];

/** November's first twelve days, then nothing yet. */
const SPENT = [0, 45_000, 120_000, 0, 260_000, 30_000, 0, 510_000, 80_000, 0, 150_000, 95_000];
const novemberDays = Array.from({ length: 30 }, (_, index) => ({
	day: `2026-11-${String(index + 1).padStart(2, "0")}`,
	amountMinor: SPENT[index] ?? 0,
}));

export const sampleKharchaOverview: InsightsOverview = {
	month: "2026-11",
	previous: "2026-10",
	currencies: ["NPR", "USD"],
	currency: "NPR",
	total: novemberDays.reduce((sum, day) => sum + day.amountMinor, 0),
	previousTotal: 2_711_000,
	byCategory: [
		{ key: "c-food", label: "Food and drink", color: "orange", amountMinor: 610_000, previousMinor: 820_000 },
		{ key: "c-groceries", label: "Groceries", color: "green", amountMinor: 380_000, previousMinor: 410_000 },
		{ key: "c-travel", label: "Travel", color: "blue", amountMinor: 250_000, previousMinor: 1_200_000 },
		{ key: "", label: "", color: null, amountMinor: 50_000, previousMinor: 281_000 },
	],
	merchants: [
		{ key: "Bhatbhateni", label: "Bhatbhateni", amountMinor: 380_000 },
		{ key: "Thakali Kitchen", label: "Thakali Kitchen", amountMinor: 260_000 },
		{ key: "Himalayan Java", label: "Himalayan Java", amountMinor: 95_000 },
	],
	days: novemberDays,
};

/** December 2025 to November 2026. */
const months = Array.from({ length: 12 }, (_, index) =>
	index === 0 ? "2025-12" : `2026-${String(index).padStart(2, "0")}`,
);
const wave = (base: number, step: number) => months.map((_, index) => base + ((index * step) % 5) * 40_000);

export const sampleKharchaTrends: InsightsTrends = {
	months,
	currencies: ["NPR"],
	currency: "NPR",
	totals: wave(1_900_000, 3),
	byCategory: [
		{ key: "c-food", label: "Food and drink", color: "orange", values: wave(600_000, 2) },
		{ key: "c-groceries", label: "Groceries", color: "green", values: wave(380_000, 1) },
		{ key: "c-rent", label: "Rent", color: "blue", values: months.map(() => 2_000_000) },
		{ key: "", label: "", color: null, values: wave(40_000, 4) },
		{ key: "*other", label: "", color: null, values: wave(90_000, 3) },
	],
	byTag: [
		{ key: "t-trip", label: "trip", color: null, values: months.map((_, index) => (index === 10 ? 1_240_000 : 0)) },
	],
	shared: [
		{ key: "g:g-flat", label: "Flat 3B", color: null, values: months.map(() => 2_100_000) },
		{ key: "f:p-asha", label: "Asha", color: "violet", values: wave(60_000, 2) },
	],
};

export const sampleKharchaStatement: InsightsStatement = {
	from: "2026-11-01",
	to: "2026-11-30",
	truncated: false,
	currencies: [
		{
			currency: "NPR",
			spent: 1_510_000,
			refunds: 50_000,
			net: 1_460_000,
			count: 4,
			byCategory: [
				{ key: "c-food", label: "Food and drink", amountMinor: 260_000 },
				{ key: "c-groceries", label: "Groceries", amountMinor: 380_000 },
				{ key: "", label: "", amountMinor: 300_000 },
			],
			lines: [
				{
					id: "e-1",
					spentOn: "2026-11-02",
					kind: "expense",
					title: "Groceries",
					merchant: "Bhatbhateni",
					category: groceries,
					group: null,
					amountMinor: 380_000,
					myShareMinor: 380_000,
				},
				{
					id: "e-2",
					spentOn: "2026-11-05",
					kind: "expense",
					title: "Dinner",
					merchant: "Thakali Kitchen",
					category: food,
					group: "Pokhara trip",
					amountMinor: 780_000,
					myShareMinor: 260_000,
				},
				{
					id: "e-3",
					spentOn: "2026-11-08",
					kind: "expense",
					title: "",
					merchant: "Daraz",
					category: null,
					group: null,
					amountMinor: 350_000,
					myShareMinor: 350_000,
				},
				{
					id: "e-4",
					spentOn: "2026-11-09",
					kind: "refund",
					title: "Returned shoes",
					merchant: "Daraz",
					category: null,
					group: null,
					amountMinor: 50_000,
					myShareMinor: 50_000,
				},
			],
		},
	],
};

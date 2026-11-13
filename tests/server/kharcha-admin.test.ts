import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { updateKharchaSettingsInput } from "@/features/kharcha/admin/schema";
import { DEFAULT_CATEGORIES, kharchaSettings } from "@/features/kharcha/settings";
import { auditEvent, khDailyStat, khExpense, khInvite } from "@/server/db/schema";
import { rollupDaily } from "@/server/kharcha/admin/daily";
import { getOverview } from "@/server/kharcha/admin/overview";
import { listSenders, suspendSender } from "@/server/kharcha/admin/senders";
import { getAdminSettings, updateAdminSettings } from "@/server/kharcha/admin/settings";
import { runKharchaCron } from "@/server/kharcha/cron";
import * as expenses from "@/server/kharcha/expenses/service";
import * as friends from "@/server/kharcha/friends/service";
import * as groups from "@/server/kharcha/groups/service";
import * as invites from "@/server/kharcha/invites/service";
import * as me from "@/server/kharcha/me/service";
import * as payments from "@/server/kharcha/payments/service";
import { getSettings } from "@/server/kharcha/settings";
import { createTestDb } from "../utils/test-db";
import { caller, code, insertUsers } from "./kharcha-helpers";

/**
 * Kharcha's admin (Task 96, decision 0290; docs/guides/kharcha.md "The admin"): the daily
 * counts and the overview (counts only), the settings saved with a version and audited, and
 * suspending a sender's invites and reminders.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) => insertUsers(db, ["maya", "asha"], ["guest"]));
}, 60_000);
afterAll(() => env.close());
beforeEach(() => env.reset());

const as = (id: string) => ({
	...caller(env.db, id, { guest: id === "guest" }),
	sendInvite: () => undefined,
});
const admin = () => ({ db: env.db, actor: { id: "admin-1", isAdmin: true, permissions: [] } });
const personOf = async (id: string) => (await me.getMe(as(id))).person.id;
const today = new Date().toISOString().slice(0, 10);

/** Maya and Asha share a dinner in a group and settle a little; Maya invites Gita; a guest tries it. */
async function activity() {
	const maya = await personOf("maya");
	const asha = await personOf("asha");
	await personOf("guest");
	await friends.addFriend(as("maya"), { name: "Asha", email: "asha@example.com" });
	const group = await groups.createGroup(as("maya"), {
		name: "Flat",
		kind: "home",
		color: "teal",
		icon: "house",
		currency: "NPR",
		startOn: null,
		endOn: null,
		memberIds: [asha],
	});
	await expenses.createExpense(as("maya"), {
		groupId: group.id,
		kind: "expense",
		title: "Secret dinner",
		merchant: "",
		notes: "",
		amountMinor: 987_654,
		currency: "NPR",
		spentOn: today,
		split: { method: "equal", people: [maya, asha] },
	});
	await payments.createPayment(as("asha"), {
		groupId: group.id,
		fromId: asha,
		toId: maya,
		amountMinor: 1_000,
		currency: "NPR",
		paid: null,
		method: "",
		note: "",
		paidOn: today,
	});
	const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
	await invites.inviteFriend(as("maya"), { personId: gita });
	return { maya, asha, group: group.id };
}

describe("the daily counts and the overview", () => {
	it("counts today's rows, keeps them after the rows go, and never shows an amount or a name", async () => {
		await activity();
		expect(await rollupDaily(env.db)).toBe(1);
		const [day] = await env.db.select().from(khDailyStat);
		expect(day).toMatchObject({
			day: today,
			people: 2,
			guests: 1,
			active: 2,
			expenses: 1,
			groups: 1,
			payments: 1,
			receipts: 0,
			invitesSent: 1,
			invitesAccepted: 0,
		});
		// Twice in a day replaces today's row.
		expect(await rollupDaily(env.db)).toBe(1);
		expect(await env.db.select().from(khDailyStat)).toHaveLength(1);

		const overview = await getOverview(env.db);
		expect(overview.days).toHaveLength(30);
		expect(overview.days.at(-1)?.day).toBe(today);
		expect(overview).toMatchObject({ people: 2, active: { week: 2, month: 2 } });
		expect(overview.totals).toMatchObject({ expenses: 1, payments: 1, groups: 1, guests: 1, invitesSent: 1 });
		const text = JSON.stringify(overview);
		for (const secret of ["Secret dinner", "987654", "Maya", "Asha", "Gita", "maya@", "Flat"]) {
			expect(text).not.toContain(secret);
		}

		// A stored day outlives its rows; the overview reads today live, so this checks the row.
		await env.db.delete(khExpense);
		const [kept] = await env.db.select().from(khDailyStat).where(eq(khDailyStat.day, today));
		expect(kept?.expenses).toBe(1);
	});

	it("runs as the daily job's first step", async () => {
		await activity();
		const run = await runKharchaCron(env.db);
		expect(run.stats).toEqual({ ok: true, days: 1 });
	});
});

describe("the settings", () => {
	it("saves from the version it opened at, audits the change, and takes effect", async () => {
		const opened = await getAdminSettings(admin());
		expect(opened.updatedAt).toBe("1");
		expect(opened.settings.categories).toEqual(DEFAULT_CATEGORIES);
		const settings = {
			...opened.settings,
			quotas: { ...opened.settings.quotas, groups: 3 },
			invites: false,
			uploadsPerHour: 5,
			currencies: ["NPR", "INR"] as typeof opened.settings.currencies,
		};
		const saved = await updateAdminSettings(admin(), { updatedAt: opened.updatedAt, settings });
		expect(saved.updatedAt).toBe("2");
		const now = await getSettings(env.db);
		expect(now.quotas.groups).toBe(3);
		expect(now.invites).toBe(false);
		expect(now.currencies).toEqual(["NPR", "INR"]);

		const [event] = await env.db.select().from(auditEvent).where(eq(auditEvent.action, "kharcha.settings.update"));
		expect(event?.before).toMatchObject({ "quotas.groups": 50, invites: true, uploadsPerHour: 60 });
		expect(event?.after).toMatchObject({ "quotas.groups": 3, invites: false, uploadsPerHour: 5 });

		// From the old version: stale.
		expect(await code(updateAdminSettings(admin(), { updatedAt: "1", settings }))).toBe("CONFLICT");
		// Invites off: nobody can invite.
		await personOf("maya");
		const gita = (await friends.addFriend(as("maya"), { name: "Gita", email: "gita@elsewhere.example" })).person.id;
		expect(await code(invites.inviteFriend(as("maya"), { personId: gita }))).toBe("FORBIDDEN");
	});

	it("refuses default categories with the same key, or none", () => {
		const settings = kharchaSettings.parse({});
		const first = DEFAULT_CATEGORIES[0];
		const twice = { ...settings, categories: [first, first] };
		expect(updateKharchaSettingsInput.safeParse({ updatedAt: "1", settings: twice }).success).toBe(false);
		const none = { ...settings, categories: [] };
		expect(updateKharchaSettingsInput.safeParse({ updatedAt: "1", settings: none }).success).toBe(false);
		expect(updateKharchaSettingsInput.safeParse({ updatedAt: "1", settings }).success).toBe(true);
	});
});

describe("senders", () => {
	it("lists invites per sender as counts, and suspending stops invites and reminders until restored", async () => {
		await activity();
		const [sender] = await listSenders(env.db);
		expect(sender).toEqual({
			id: "maya",
			name: "Maya",
			email: "maya@example.com",
			guest: false,
			day: 1,
			month: 1,
			accepted: 0,
			suspendedAt: null,
		});
		expect(JSON.stringify(await listSenders(env.db))).not.toContain("gita");

		await suspendSender(admin(), { userId: "maya", suspend: true });
		const hari = (await friends.addFriend(as("maya"), { name: "Hari", email: "hari@elsewhere.example" })).person.id;
		expect(await code(invites.inviteFriend(as("maya"), { personId: hari }))).toBe("FORBIDDEN");
		expect((await listSenders(env.db))[0]?.suspendedAt).not.toBeNull();
		// Suspending again changes nothing and audits nothing.
		await suspendSender(admin(), { userId: "maya", suspend: true });

		await suspendSender(admin(), { userId: "maya", suspend: false });
		expect(await code(invites.inviteFriend(as("maya"), { personId: hari }))).toBe("ok");
		const events = await env.db.select({ action: auditEvent.action, target: auditEvent.targetId }).from(auditEvent);
		expect(events.map((event) => event.action).sort()).toEqual(["kharcha.sender.restore", "kharcha.sender.suspend"]);
		expect(await code(suspendSender(admin(), { userId: "nobody", suspend: true }))).toBe("NOT_FOUND");
		expect(await env.db.select().from(khInvite)).toHaveLength(2);
	});
});

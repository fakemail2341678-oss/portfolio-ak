import { hashPassword, verifyPassword } from "better-auth/crypto";
import { afterAll, describe, expect, it } from "vitest";
import { permissionsForUser } from "@/server/rbac/repository";
import { listPublishedTestCrud } from "@/server/test-crud/repository";
import { DEMO_ITEM_COUNT, seedDemo } from "../../scripts/lib/demo-data.ts";
import { createTestDb } from "../utils/test-db";

/** `pnpm db:seed-demo`'s data, run against the real migrations. */
describe("demo seed", async () => {
	const testDb = await createTestDb();
	const query = async (sql: string, params?: unknown[]) => {
		const result = await testDb.client.query<Record<string, unknown>>(sql, params);
		return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
	};
	afterAll(() => testDb.close());

	it("creates roles, users and items, and running it again changes nothing", async () => {
		const passwordHash = await hashPassword("demo-password-123");
		expect(await seedDemo(query, { passwordHash })).toEqual({ created: DEMO_ITEM_COUNT });
		expect(await seedDemo(query, { passwordHash })).toEqual({ created: 0 });

		// Each demo user can sign in with email + password (a verified "credential" account).
		const { rows } = await query(
			`select u."email", u."email_verified", a."password" from "user" u join "account" a on a."user_id" = u."id"
			 where a."provider_id" = 'credential' order by u."email"`,
		);
		expect(rows.map((row) => row.email)).toEqual(["editor@example.com", "member@example.com", "viewer@example.com"]);
		for (const row of rows) {
			expect(row.email_verified).toBe(true);
			expect(await verifyPassword({ hash: String(row.password), password: "demo-password-123" })).toBe(true);
		}
	});

	it("gives each user the permissions of their role (the member only the baseline)", async () => {
		const idOf = async (email: string) =>
			String((await query(`select "id" from "user" where "email" = $1`, [email])).rows[0]?.id);
		const permissions = async (email: string) =>
			permissionsForUser(testDb.db, { id: await idOf(email), role: "user", banned: false });

		expect(await permissions("editor@example.com")).toEqual([
			"test-crud:read",
			"test-crud:create",
			"test-crud:update",
			"test-crud:publish",
			"attachments:upload",
			"portfolio:read", // @portfolio
			"portfolio:write", // @portfolio
			"portfolio:publish", // @portfolio
			"media:read", // @portfolio
			"media:write", // @portfolio
		]);
		expect(await permissions("viewer@example.com")).toEqual(["test-crud:read", "users:read", "roles:read"]);
		expect(await permissions("member@example.com")).toEqual([]);
	});

	it("leaves enough published items to page through", async () => {
		const page = await listPublishedTestCrud(testDb.db, { q: "", page: 1 }, 12, null);
		expect(page.total).toBe(20);
		expect(page.pageCount).toBe(2);
	});
});

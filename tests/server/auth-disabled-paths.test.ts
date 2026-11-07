import { admin, anonymous } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { DISABLED_ADMIN_PATHS, DISABLED_GUEST_PATHS } from "@/server/auth/disabled-paths";

describe("Better Auth admin endpoints", () => {
	it("are all disabled over HTTP (RBAC goes through src/functions/rbac.ts)", () => {
		const paths = Object.values(admin().endpoints).map((endpoint) => endpoint.path);
		expect(paths.length).toBeGreaterThan(0);
		expect([...paths].sort()).toEqual([...DISABLED_ADMIN_PATHS].sort());
	});
});

describe("Better Auth anonymous endpoints", () => {
	it("keep sign-in and disable the plugin's own deletion (decision 0185)", () => {
		const paths = Object.values(anonymous().endpoints).map((endpoint) => endpoint.path);
		expect(paths.sort()).toEqual(["/delete-anonymous-user", "/sign-in/anonymous"]);
		expect(DISABLED_GUEST_PATHS).toEqual(["/delete-anonymous-user"]);
	});
});

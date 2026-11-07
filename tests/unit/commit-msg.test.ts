import { describe, expect, it } from "vitest";
import { checkCommitMessage } from "../../scripts/check-commit-msg.ts";

const check = checkCommitMessage;

describe("conventional commit check (recipe)", () => {
	it("accepts type, optional scope and breaking marker", () => {
		expect(check("feat: add projects")).toBeNull();
		expect(check("fix(auth): refuse stale invite tokens\n\nBody text.")).toBeNull();
		expect(check("refactor(db)!: drop legacy images")).toBeNull();
	});

	it("lets git's own messages through and skips comment lines", () => {
		expect(check("Merge branch 'main' into feature")).toBeNull();
		expect(check("# Please enter the commit message\nchore: bump deps")).toBeNull();
	});

	it("refuses anything else, saying why", () => {
		expect(check("audit")).toMatch(/isn't a Conventional Commit/);
		expect(check("Feat: capitalised type")).not.toBeNull();
		expect(check(`feat: ${"x".repeat(101)}`)).not.toBeNull();
	});
});

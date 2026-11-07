import { describe, expect, it } from "vitest";
import { recordErrorStatus, runWithErrorStatus } from "@/server/http/error-status";

describe("request-scoped error status", () => {
	it("turns an SSR 500 into the recorded AppError status", async () => {
		const response = await runWithErrorStatus(async () => {
			recordErrorStatus(403);
			return new Response("<html>forbidden page</html>", { status: 500, headers: { "content-type": "text/html" } });
		});
		expect(response.status).toBe(403);
		expect(response.headers.get("content-type")).toBe("text/html");
		expect(await response.text()).toContain("forbidden page");
	});

	it("leaves responses alone when nothing was recorded", async () => {
		const response = await runWithErrorStatus(async () => new Response("boom", { status: 500 }));
		expect(response.status).toBe(500);
	});

	it("never changes a non-500 response (redirects, 404s, successes)", async () => {
		const response = await runWithErrorStatus(async () => {
			recordErrorStatus(403);
			return new Response(null, { status: 307, headers: { location: "/login" } });
		});
		expect(response.status).toBe(307);
	});

	it("keeps concurrent requests isolated", async () => {
		const slow = runWithErrorStatus(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
			return new Response("", { status: 500 });
		});
		const fast = runWithErrorStatus(async () => {
			recordErrorStatus(401);
			return new Response("", { status: 500 });
		});
		expect((await fast).status).toBe(401);
		expect((await slow).status).toBe(500);
	});

	it("is a no-op outside a request", () => {
		expect(() => recordErrorStatus(403)).not.toThrow();
	});
});

import { describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth, healthResponse } from "@/server/db/health";
import { runInRequestScope } from "@/server/http/request-scope";

const clock = (...times: number[]) => {
	const queue = [...times];
	return () => queue.shift() ?? 0;
};

describe("checkDatabaseHealth", () => {
	it("reports ok with the measured latency", async () => {
		const ping = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
		const result = await checkDatabaseHealth(ping, clock(100, 142.4));
		expect(ping).toHaveBeenCalledOnce();
		expect(result).toMatchObject({ status: "ok", latencyMs: 42 });
		expect(Number.isNaN(Date.parse(result.checkedAt))).toBe(false);
	});

	it("reports error without leaking driver details, and logs the cause on the server", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const driverError = new Error("connect ECONNREFUSED 10.0.0.5:5432 password=secret");
		const ping = vi.fn().mockRejectedValue(new Error("Failed query: select 1", { cause: driverError }));

		let result: Awaited<ReturnType<typeof checkDatabaseHealth>> | undefined;
		await runInRequestScope(
			async () => {
				result = await checkDatabaseHealth(ping, clock(0, 5));
				return new Response();
			},
			() => "req-1",
		);

		expect(result).toEqual({ status: "error", latencyMs: 5, checkedAt: expect.any(String) });
		expect(JSON.stringify(result)).not.toMatch(/ECONNREFUSED|secret|10\.0\.0\.5/);
		// One JSON line on the server, with the request id and the driver's reason.
		expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
			level: "error",
			msg: "db health check failed",
			requestId: "req-1",
			error: "Failed query: select 1",
			cause: driverError.message,
		});
	});

	it("counts a ping that doesn't answer in time as down", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await checkDatabaseHealth(() => new Promise(() => {}), undefined, 10);
		expect(result.status).toBe("error");
	});
});

describe("healthResponse (GET /api/health)", () => {
	const checkedAt = "2026-10-19T00:00:00.000Z";

	it("answers 200 with the latency when the database is up, never cached", async () => {
		const response = healthResponse({ status: "ok", latencyMs: 4, checkedAt });
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/^application\/json/);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.json()).toEqual({
			status: "ok",
			checks: { database: { status: "ok", latencyMs: 4 } },
			checkedAt,
		});
	});

	it("answers 503 when it's down, with no details", async () => {
		const response = healthResponse({ status: "error", latencyMs: 3000, checkedAt });
		expect(response.status).toBe(503);
		expect(Object.keys(await response.json())).toEqual(["status", "checks", "checkedAt"]);
	});

	it("has no body for HEAD", async () => {
		const response = healthResponse({ status: "ok", latencyMs: 1, checkedAt }, "HEAD");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});
});

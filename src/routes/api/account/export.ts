import { createFileRoute } from "@tanstack/react-router";
import { exportAccountData } from "@/server/account/service";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body, null, 2), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
	});

/**
 * /api/account/export: the signed-in user's own data as a JSON download (0129).
 * A plain GET link, so it works before hydration; other sites can make the browser
 * request it but can't read the answer.
 */
export const Route = createFileRoute("/api/account/export")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const session = await auth.api.getSession({ headers: request.headers });
				// Guests (decision 0185) have no account to export.
				if (!session || session.user.isAnonymous) return json(401, { error: "UNAUTHORIZED" });
				const data = await exportAccountData(db, session.user.id);
				if (!data) return json(404, { error: "NOT_FOUND" });
				const date = data.exportedAt.slice(0, 10);
				return json(200, data, { "content-disposition": `attachment; filename="account-${date}.json"` });
			},
		},
	},
});

import { createFileRoute } from "@tanstack/react-router";
import { AppError } from "@/lib/errors";
import { exportAccountData } from "@/server/account/service";
import { db } from "@/server/db/client";
import { defineApiRoute } from "@/server/http/api-route";

/**
 * /api/account/export: the signed-in user's own data as a JSON download (0129).
 * A plain GET link, so it works before hydration; other sites can make the browser
 * request it but can't read the answer. Guests (decision 0185) have no account to
 * export: `auth: "user"` answers them 401.
 */
export const Route = createFileRoute("/api/account/export")({
	server: {
		handlers: defineApiRoute({
			name: "account-export",
			methods: ["GET"],
			auth: "user",
			// The export reads every table the account has rows in.
			rateLimit: { max: 10, windowSeconds: 60 },
			handler: async ({ user }) => {
				const data = await exportAccountData(db, user.id);
				if (!data) throw new AppError("NOT_FOUND", "No such account");
				const date = data.exportedAt.slice(0, 10);
				return new Response(JSON.stringify(data, null, 2), {
					headers: {
						"content-type": "application/json; charset=utf-8",
						"cache-control": "no-store",
						"content-disposition": `attachment; filename="account-${date}.json"`,
					},
				});
			},
		}).handlers,
	},
});

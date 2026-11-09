import { z } from "zod";
import { listSchema } from "@/lib/crud/schema";
import { enumParam } from "@/lib/list/params";
import { connectResultSearch } from "../search";

/**
 * The URL contract of Chaal's admin pages (PLAN Task 79). Route files import from here,
 * never from ./schema.ts (decision 0151).
 */

/** /admin/chaal/lab: `?lichess=` says how connecting ended (the OAuth routes add it). */
export const chaalLabSearch = connectResultSearch;

export const CONNECTION_STATE_FILTERS = ["all", "active", "revoked", "expired"] as const;
export type ConnectionStateFilter = (typeof CONNECTION_STATE_FILTERS)[number];
export const CONNECTION_WHO_FILTERS = ["all", "members", "guests"] as const;
export type ConnectionWhoFilter = (typeof CONNECTION_WHO_FILTERS)[number];

/** /admin/chaal/connections: the latest connected first; `q` finds the Lichess username, the user's name or email. */
export const chaalConnectionList = listSchema({
	sorts: ["-connected", "connected", "-used", "used", "username", "-username"],
	filters: {
		state: enumParam(CONNECTION_STATE_FILTERS, "all"),
		who: enumParam(CONNECTION_WHO_FILTERS, "all"),
	},
});
export type ChaalConnectionSearch = z.output<typeof chaalConnectionList.search>;
export type ChaalConnectionListInput = z.output<typeof chaalConnectionList.input>;

export const BLOCK_KIND_FILTERS = ["all", "lichess", "user"] as const;
export type BlockKindFilter = (typeof BLOCK_KIND_FILTERS)[number];

/** /admin/chaal/blocks: the newest first. */
export const chaalBlockList = listSchema({
	sorts: ["-created", "created"],
	filters: { kind: enumParam(BLOCK_KIND_FILTERS, "all") },
});
export type ChaalBlockSearch = z.output<typeof chaalBlockList.search>;
export type ChaalBlockListInput = z.output<typeof chaalBlockList.input>;

/** /admin/chaal/health: the hours the figures cover. */
export const CHAAL_HEALTH_RANGES = ["24h", "7d"] as const;
export type ChaalHealthRange = (typeof CHAAL_HEALTH_RANGES)[number];
export const chaalHealthSearch = z.object({ range: enumParam(CHAAL_HEALTH_RANGES, "24h") });

/** The tables' preference keys (hidden columns, page size). */
export const CHAAL_CONNECTIONS_TABLE_ID = "chaal-connections";
export const CHAAL_BLOCKS_TABLE_ID = "chaal-blocks";

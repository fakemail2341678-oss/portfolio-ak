import { createServerFn } from "@tanstack/react-start";
import { checkAppDatabase } from "@/server/db/health";

/**
 * Database health check for the /health page (monitors use GET /api/health).
 * The handler runs only on the server; the Start compiler replaces it with an
 * RPC stub in the client bundle, which prunes the db imports.
 */
export const getDbHealth = createServerFn({ method: "GET" }).handler(() => checkAppDatabase());

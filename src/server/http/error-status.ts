import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request record of the HTTP status an AppError should produce.
 *
 * TanStack Router fixes the SSR status of any errored match at 500, and headers
 * set during rendering don't reach the final Response. So the server entry opens
 * a record per request (runWithErrorStatus), routes write to it
 * (recordErrorStatus, via src/lib/start/http-status.ts), and the entry applies it.
 */
type Record = { status: number | undefined };

const storage = new AsyncLocalStorage<Record>();

export const recordErrorStatus = (status: number) => {
	const record = storage.getStore();
	if (record) record.status = status;
};

export const runWithErrorStatus = async (handle: () => Promise<Response>): Promise<Response> => {
	const record: Record = { status: undefined };
	const response = await storage.run(record, handle);
	if (response.status !== 500 || record.status === undefined) return response;
	return new Response(response.body, { status: record.status, headers: response.headers });
};

/**
 * Optimistic concurrency (docs/decisions.md 0122): an edit sends the version it
 * started from, the row's `updatedAt` as the ISO string the client received.
 * The repository writes only while the row still has that version
 * (`sameVersion`, src/server/db/concurrency.ts) and otherwise throws
 * `staleError()`. The form shows "changed by someone else" with a reload action
 * (StaleVersionAlert, src/components/forms).
 */
import { z } from "zod";
import { AppError, isAppError } from "./errors";

/** The `updatedAt` an edit started from (what toISOString() produced on the server). */
export const versionSchema = () => z.iso.datetime();

/** The row changed (or was edited elsewhere) since the client loaded it. */
export const staleError = (what: string) =>
	new AppError("CONFLICT", `${what} changed since it was loaded`, { reason: "stale" });

export const isStaleError = (error: unknown): boolean => isAppError(error) && error.reason === "stale";

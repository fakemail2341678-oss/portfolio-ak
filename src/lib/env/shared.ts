import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { z } from "zod";

type Issue = StandardSchemaV1.Issue;

const pathOf = (issue: Issue): string => {
	const segments = (issue.path ?? []).map((segment) =>
		typeof segment === "object" && segment !== null ? String(segment.key) : String(segment),
	);
	return segments.join(".") || "(root)";
};

/**
 * Builds a readable, multi-line message naming every invalid variable.
 * Values are never included, so secrets cannot leak into logs.
 */
export const formatEnvIssues = (scope: "server" | "client", issues: ReadonlyArray<Issue>): string => {
	const lines = issues.map((issue) => `  - ${pathOf(issue)}: ${issue.message}`);
	return [
		`Invalid ${scope} environment variables:`,
		...lines,
		"Fix them in your .env file (see .env.example) or in your hosting provider's settings.",
	].join("\n");
};

export class EnvValidationError extends Error {
	override name = "EnvValidationError";
}

/** onValidationError handler for createEnv. Throws so startup fails immediately. */
export const throwEnvError =
	(scope: "server" | "client") =>
	(issues: ReadonlyArray<Issue>): never => {
		throw new EnvValidationError(formatEnvIssues(scope, issues));
	};

/** A postgres:// or postgresql:// URL. Shared by the server env and drizzle.config.ts. */
export const postgresUrl = (whenMissing: string) =>
	z.url({
		protocol: /^postgres(ql)?$/,
		error: (issue) =>
			issue.input === undefined
				? whenMissing
				: "Must be a Postgres connection URL (postgresql://user:password@host/db).",
	});

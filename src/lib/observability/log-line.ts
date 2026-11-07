export type LogLevel = "info" | "warn" | "error";

/**
 * One JSON line on stdout/stderr (what Vercel's log drains index). Server code
 * logs through src/server/log.ts, which adds the request id; this is the writer.
 */
export const writeLogLine = (level: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
	const line = JSON.stringify({ level, msg, ...fields });
	if (level === "error") console.error(line);
	else if (level === "warn") console.warn(line);
	else console.info(line);
};

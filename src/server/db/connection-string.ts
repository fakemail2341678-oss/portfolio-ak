/**
 * Neon's copy-paste connection strings use `sslmode=require`. pg 8 already treats
 * `prefer`, `require` and `verify-ca` as `verify-full`, but prints a security warning
 * because pg 9 will switch them to weaker libpq semantics. Rewriting to `verify-full`
 * keeps today's (certificate-verifying) behavior, silences the warning and survives
 * the pg 9 upgrade. Neon serves publicly trusted certificates, so verify-full works.
 *
 * Pure function with no server-only imports, so drizzle.config.ts can use it too.
 */
const WEAK_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

export const withVerifiedSsl = (connectionString: string): string => {
	const url = new URL(connectionString);
	const mode = url.searchParams.get("sslmode");
	if (mode && WEAK_SSL_MODES.has(mode) && !url.searchParams.has("uselibpqcompat")) {
		url.searchParams.set("sslmode", "verify-full");
	}
	return url.toString();
};

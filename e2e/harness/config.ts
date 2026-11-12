/**
 * Settings shared by the e2e harness (Node, no build step) and the Playwright tests.
 * Plain TypeScript without imports, so `node e2e/harness/server.ts` can run it.
 */
const port = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

const APP_PORT = port("E2E_PORT", 3100);
const HARNESS_PORT = port("E2E_HARNESS_PORT", 3101);

export const E2E = {
	/** The production server under test. */
	baseURL: `http://localhost:${APP_PORT}`,
	appPort: APP_PORT,
	/** Fake Resend API plus the test controls (emails, rate limits, fixtures). */
	harnessURL: `http://127.0.0.1:${HARNESS_PORT}`,
	harnessPort: HARNESS_PORT,
	/** In-memory PGlite (unless E2E_DATABASE_URL points at a real Postgres); only the harness uses it, so any free port by default. */
	pglitePort: port("E2E_PGLITE_PORT", 0),
	appTitle: "Start Template",
	/** Every seeded user's password (admin and the demo users). */
	password: "e2e-password-1234",
	/** PARDA_PROBE_SECRET for the server under test: the flows call the probe's route (decision 0238). */
	probeSecret: "e2e-probe-secret-0123456789", // @parda
	/** PARDA_REALTIME_KEY for the server under test; the relay checks tokens with its secret. */
	realtimeKey: "e2e.key:e2e-realtime-secret-0123456789", // @parda
	/** CHAAL_TOKEN_KEY for the server under test: 32 bytes in base64, never used anywhere else. */
	chaalTokenKey: "ZTJlLWNoYWFsLXRva2VuLWtleS0zMi1ieXRlcy0wMDE=", // @chaal
	users: {
		admin: { email: "admin@example.com", name: "E2E Admin" },
		editor: { email: "editor@example.com", name: "Demo Editor" },
		viewer: { email: "viewer@example.com", name: "Demo Viewer" },
		member: { email: "member@example.com", name: "Demo Member" },
		/** The Kharcha demo account (scripts/lib/kharcha-seed.ts): onboarded, in a group with two friends. */
		kharcha: { email: "asha@kharcha.example.com", name: "Asha Gurung" }, // @kharcha
	},
} as const;

export type E2EUser = keyof typeof E2E.users;

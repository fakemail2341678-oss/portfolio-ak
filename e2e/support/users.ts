/** Fresh accounts for flows that change a user (sign-up, password reset), so seeded users stay as they are. */
import { E2E } from "../harness/config.ts";
import { authFetch, expect, type Harness } from "./fixtures.ts";

let counter = 0;
/** A unique address per call, also across workers and reruns against a kept server. */
export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${process.pid}-${counter++}@example.com`;

/** The first link to this site in an email's text. */
export const linkIn = (text: string) => {
	const escaped = E2E.baseURL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const url = new RegExp(`${escaped}[^\\s)\\]"]+`).exec(text)?.[0];
	if (!url) throw new Error(`no link to ${E2E.baseURL} in:\n${text}`);
	return url;
};

/** Signs up through the API and opens the emailed verification link. */
export async function createVerifiedUser(harness: Harness, prefix: string) {
	const email = uniqueEmail(prefix);
	const response = await authFetch("/api/auth/sign-up/email", { name: `E2E ${prefix}`, email, password: E2E.password });
	expect(response.status, await response.text()).toBe(200);
	const verification = await harness.nextEmail(email, "verify-email");
	// Verifies the address; the redirect it answers with isn't needed.
	const verified = await fetch(linkIn(verification.text), { redirect: "manual" });
	expect(verified.status, "verification link").toBeLessThan(400);
	return { email, password: E2E.password };
}

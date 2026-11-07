import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { featureOn, missingScopes, scopesFor } from "@/features/chaal/features";
import { connectHref, safeReturnPath } from "@/features/chaal/links";
import {
	authorizeUrl,
	challengeOf,
	newState,
	newVerifier,
	OAUTH_TTL_SECONDS,
	type OAuthPending,
	openPending,
	redirectUriFor,
	sealPending,
	withResult,
} from "@/server/chaal/connect/oauth";
import { createVault, sealedKeyId, VaultError } from "@/server/chaal/connect/vault";

/** Connecting Lichess (PLAN 13.5, decision 0256): the vault, PKCE and the state cookie, return paths, scopes. */

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

describe("the token vault", () => {
	it("seals and opens a token; each seal is different, and none holds the token in clear", async () => {
		const vault = await createVault(KEY_A);
		const first = await vault.seal("lio_secret", "token");
		const second = await vault.seal("lio_secret", "token");
		expect(first).not.toBe(second);
		expect(first).not.toContain("lio_secret");
		expect(first).toMatch(/^v1\.[\w-]{8}\.[\w-]+\.[\w-]+$/);
		expect(await vault.open(first, "token")).toBe("lio_secret");
	});

	it("refuses another key, a changed value, and another purpose", async () => {
		const sealed = await (await createVault(KEY_A)).seal("lio_secret", "token");
		await expect((await createVault(KEY_B)).open(sealed, "token")).rejects.toBeInstanceOf(VaultError);
		const vault = await createVault(KEY_A);
		const parts = sealed.split(".");
		const changed = [...parts.slice(0, 3), `${parts[3]?.slice(0, -2)}AA`].join(".");
		await expect(vault.open(changed, "token")).rejects.toBeInstanceOf(VaultError);
		await expect(vault.open(sealed, "oauth-state")).rejects.toBeInstanceOf(VaultError);
		await expect(vault.open("not.sealed", "token")).rejects.toBeInstanceOf(VaultError);
	});

	it("rotates: a new key first seals new values, and the old one still opens what it sealed", async () => {
		const old = await createVault(KEY_A);
		const sealedBefore = await old.seal("lio_old", "token");
		const rotated = await createVault(`${KEY_B},${KEY_A}`);
		const sealedAfter = await rotated.seal("lio_new", "token");
		expect(sealedKeyId(sealedBefore)).toBe(old.keyId);
		expect(sealedKeyId(sealedAfter)).toBe(rotated.keyId);
		expect(rotated.keyId).not.toBe(old.keyId);
		expect(await rotated.open(sealedBefore, "token")).toBe("lio_old");
		// Once the old key is removed, what it sealed can't be opened: those users reconnect.
		await expect((await createVault(KEY_B)).open(sealedBefore, "token")).rejects.toBeInstanceOf(VaultError);
	});
});

describe("OAuth with PKCE", () => {
	it("the challenge is BASE64URL(SHA256(verifier)), and verifiers and states are random", async () => {
		const verifier = newVerifier();
		expect(await challengeOf(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"));
		expect(verifier).toMatch(/^[\w-]{43}$/);
		expect(newVerifier()).not.toBe(verifier);
		expect(newState()).toMatch(/^[\w-]{22}$/);
	});

	it("sends the browser to Lichess with S256, the client, the callback, the scopes and the state; never the verifier", async () => {
		const url = new URL(
			authorizeUrl({
				apiBase: "https://lichess.org/",
				clientId: "chaal",
				redirectUri: redirectUriFor("https://example.com"),
				challenge: "challenge-value",
				state: "state-value",
				scopes: ["board:play", "challenge:read"],
			}),
		);
		expect(`${url.origin}${url.pathname}`).toBe("https://lichess.org/oauth");
		expect(Object.fromEntries(url.searchParams)).toEqual({
			response_type: "code",
			client_id: "chaal",
			redirect_uri: "https://example.com/api/chaal/oauth/callback",
			code_challenge_method: "S256",
			code_challenge: "challenge-value",
			scope: "board:play challenge:read",
			state: "state-value",
		});
	});

	it("the state cookie opens only sealed by us, unchanged and within 10 minutes", async () => {
		const vault = await createVault(KEY_A);
		const pending: OAuthPending = {
			state: newState(),
			verifier: newVerifier(),
			userId: "u1",
			returnTo: "/admin/chaal/lab",
			scopes: ["board:play"],
			at: 1_000_000,
		};
		const cookie = await sealPending(vault, pending);
		expect(cookie).not.toContain(pending.verifier);
		expect(await openPending(vault, cookie, pending.at + 1_000)).toEqual(pending);
		expect(await openPending(vault, cookie, pending.at + OAUTH_TTL_SECONDS * 1000 + 1)).toBeNull();
		expect(await openPending(vault, undefined, pending.at)).toBeNull();
		expect(await openPending(vault, `${cookie}x`, pending.at)).toBeNull();
		expect(await openPending(await createVault(KEY_B), cookie, pending.at)).toBeNull();
		// A token sealed by the vault isn't a state cookie.
		expect(await openPending(vault, await vault.seal(JSON.stringify(pending), "token"), pending.at)).toBeNull();
		// A return path that slipped in is made safe again on the way out.
		const sneaky = await sealPending(vault, { ...pending, returnTo: "https://evil.example" });
		expect((await openPending(vault, sneaky, pending.at))?.returnTo).toBe("/app/chaal");
	});
});

describe("return paths (no open redirect)", () => {
	it.each([
		["/app/chaal", "/app/chaal"],
		["/app/chaal/play?x=1", "/app/chaal/play?x=1"],
		["/ne/app/chaal/settings", "/ne/app/chaal/settings"],
		["/admin/chaal/lab", "/admin/chaal/lab"],
		["/ne/admin/chaal/lab", "/ne/admin/chaal/lab"],
		["/app/chaalx", "/app/chaal"],
		["/admin/users", "/app/chaal"],
		["//evil.example/app/chaal", "/app/chaal"],
		["https://evil.example/app/chaal", "/app/chaal"],
		["/app/chaal/../../admin", "/app/chaal"],
		["/app/chaal\\evil", "/app/chaal"],
		["/app/chaal/ x", "/app/chaal"],
		[null, "/app/chaal"],
		["", "/app/chaal"],
	])("%s -> %s", (value, expected) => {
		expect(safeReturnPath(value)).toBe(expected);
	});

	it("the outcome is added to the path, replacing an earlier one, and the start link carries the path", () => {
		expect(withResult("/admin/chaal/lab?lichess=denied&x=1", "connected")).toBe(
			"/admin/chaal/lab?lichess=connected&x=1",
		);
		expect(withResult("https://evil.example", "failed")).toBe("/app/chaal?lichess=failed");
		expect(connectHref("/ne/admin/chaal/lab")).toBe("/api/chaal/oauth/start?return=%2Fne%2Fadmin%2Fchaal%2Flab");
	});
});

describe("scopes by feature", () => {
	it("asks for every enabled feature's scopes and the admin's extras, in catalogue order", () => {
		expect(scopesFor({})).toEqual([
			"board:play",
			"challenge:read",
			"challenge:write",
			"puzzle:read",
			"puzzle:write",
			"follow:read",
			"follow:write",
			"study:read",
			"study:write",
			"team:read",
			"team:write",
			"tournament:write",
			"preference:read",
		]);
		expect(
			scopesFor(
				{
					play: false,
					puzzles: false,
					social: false,
					studies: false,
					teams: false,
					tournaments: false,
					preferences: false,
				},
				["puzzle:read", "email:read"],
			),
		).toEqual(["puzzle:read"]);
	});

	it("a feature is on unless switched off, and a connection lacking its scopes needs a reconnect", () => {
		expect(featureOn({}, "play")).toBe(true);
		expect(featureOn({ play: false }, "play")).toBe(false);
		expect(missingScopes("play", ["board:play"])).toEqual(["challenge:read", "challenge:write"]);
		expect(missingScopes("analysis", [])).toEqual([]);
	});
});

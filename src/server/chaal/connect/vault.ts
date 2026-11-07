import "@tanstack/react-start/server-only";

/**
 * Seals Lichess tokens at rest, and the OAuth state cookie (PLAN 13.5, "Vault"; decision
 * 0256): AES-256-GCM through WebCrypto with CHAAL_TOKEN_KEY. A sealed value is
 *
 *   v1.<key id>.<iv>.<ciphertext>          (base64url parts)
 *
 * The key id (the first 8 characters of the key's SHA-256) says which key sealed it, so a
 * new key can go first in CHAAL_TOKEN_KEY while the old one still opens what it sealed.
 * Each value is bound to its purpose (GCM's additional data), so a sealed cookie can't be
 * passed off as a token. Nothing here logs.
 */

const VERSION = "v1";
const IV_BYTES = 12;

export type VaultPurpose = "token" | "oauth-state";

export type Vault = {
	/** The key id new values are sealed with. */
	keyId: string;
	seal: (plain: string, purpose: VaultPurpose) => Promise<string>;
	/** The plain value; throws `VaultError` when no key opens it or it was changed. */
	open: (sealed: string, purpose: VaultPurpose) => Promise<string>;
};

export class VaultError extends Error {
	override name = "VaultError";
}

const toBase64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const fromBase64Url = (text: string) => new Uint8Array(Buffer.from(text, "base64url"));
const encoder = new TextEncoder();

type Key = { id: string; key: CryptoKey };

async function importKey(base64: string): Promise<Key> {
	const raw = new Uint8Array(Buffer.from(base64.trim(), "base64"));
	if (raw.length !== 32) throw new VaultError("CHAAL_TOKEN_KEY: each key must be 32 bytes");
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
	const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
	return { id: toBase64Url(digest).slice(0, 8), key };
}

/** A vault from CHAAL_TOKEN_KEY's value: one key, or several separated by commas (the first seals). */
export async function createVault(keys: string): Promise<Vault> {
	const ring = await Promise.all(
		keys
			.split(",")
			.filter((key) => key.trim())
			.map(importKey),
	);
	const current = ring[0];
	if (!current) throw new VaultError("CHAAL_TOKEN_KEY: no key");
	const byId = new Map(ring.map((entry) => [entry.id, entry.key]));
	return {
		keyId: current.id,
		seal: async (plain, purpose) => {
			const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
			const sealed = await crypto.subtle.encrypt(
				{ name: "AES-GCM", iv, additionalData: encoder.encode(`chaal:${purpose}`) },
				current.key,
				encoder.encode(plain),
			);
			return [VERSION, current.id, toBase64Url(iv), toBase64Url(new Uint8Array(sealed))].join(".");
		},
		open: async (sealed, purpose) => {
			const [version, id, iv, data, ...rest] = sealed.split(".");
			if (version !== VERSION || !id || !iv || !data || rest.length > 0) throw new VaultError("not a sealed value");
			const key = byId.get(id);
			if (!key) throw new VaultError("sealed with a key that is no longer configured");
			try {
				const plain = await crypto.subtle.decrypt(
					{ name: "AES-GCM", iv: fromBase64Url(iv), additionalData: encoder.encode(`chaal:${purpose}`) },
					key,
					fromBase64Url(data),
				);
				return new TextDecoder().decode(plain);
			} catch {
				throw new VaultError("could not open the sealed value");
			}
		},
	};
}

/** The key id inside a sealed value (which key sealed it), or null. */
export const sealedKeyId = (sealed: string): string | null => {
	const [version, id] = sealed.split(".");
	return version === VERSION && id ? id : null;
};

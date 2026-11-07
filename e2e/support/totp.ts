/** An authenticator app for the e2e flows: the current 6-digit code for a base32 secret (RFC 6238, SHA-1, 30 s). */
import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (input: string) => {
	let bits = "";
	for (const char of input.replace(/=+$/, "").toUpperCase()) {
		const value = ALPHABET.indexOf(char);
		if (value < 0) throw new Error(`not base32: ${char}`);
		bits += value.toString(2).padStart(5, "0");
	}
	const bytes = bits.match(/.{8}/g) ?? [];
	return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
};

export function totp(secret: string, now = Date.now()): string {
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
	const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
	const offset = (hmac.at(-1) ?? 0) & 0x0f;
	const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
	return String(code).padStart(6, "0");
}

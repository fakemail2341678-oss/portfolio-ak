/**
 * Lichess streams ndjson: one JSON object per line, and an empty line every few seconds to
 * keep the connection alive (PLAN 13.4). This reads lines from a byte stream, on the server
 * (Lichess's streams) and in the browser (ours, src/server/routes/chaal-stream.ts): a line
 * split across chunks is joined, `\r\n` is accepted, and an empty line comes out as "".
 */

/** A line longer than this is refused rather than buffered forever (a game's full state is a few kB). */
export const MAX_LINE_LENGTH = 1_000_000;

export async function* ndjsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let end = buffer.indexOf("\n");
			while (end >= 0) {
				yield buffer.slice(0, end).replace(/\r$/, "");
				buffer = buffer.slice(end + 1);
				end = buffer.indexOf("\n");
			}
			if (buffer.length > MAX_LINE_LENGTH) throw new Error("ndjson line too long");
		}
		buffer += decoder.decode();
		if (buffer.trim()) yield buffer.replace(/\r$/, "");
	} finally {
		// Stops the upstream when the reader leaves early (a client went away, a deadline).
		await reader.cancel().catch(() => {});
	}
}

/** A line's JSON, or undefined for a keepalive or a line that isn't JSON. */
export function parseLine(line: string): unknown {
	if (!line.trim()) return undefined;
	try {
		return JSON.parse(line) as unknown;
	} catch {
		return undefined;
	}
}

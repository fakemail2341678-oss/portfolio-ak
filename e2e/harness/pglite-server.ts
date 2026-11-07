/**
 * An in-memory Postgres (PGlite) served over TCP, so the production server and
 * `pg` can use it like a real database. Used by the e2e harness (e2e/harness/server.ts).
 *
 * PGlite has one backend, so connections take turns. A turn is a whole request:
 * a simple query ('Q'), or an extended-protocol run up to its Sync ('S'). A
 * connection inside a transaction keeps its turn until the transaction ends.
 * (@electric-sql/pglite-socket queues single messages instead, so two pooled
 * connections can interleave their Parse/Bind/Execute and run each other's
 * statements, decision 0121.)
 */

import { createServer, type Socket } from "node:net";
import type { PGlite } from "@electric-sql/pglite";

const SSL_REQUEST = 80877103;
const GSSENC_REQUEST = 80877104;
const CANCEL_REQUEST = 80877102;
const PROTOCOL_3 = 196608;
/** Messages that end a turn: Sync, simple Query, Flush (the client waits for output). */
const TURN_ENDS = new Set(["S", "Q", "H"]);

type Connection = { socket: Socket; started: boolean; buffer: Buffer; pending: Uint8Array[] };
type Turn = { conn: Connection; messages: Uint8Array[] };

/** Serves `db` on host:port. Returns the bound port and stop(). */
export async function servePglite(db: PGlite, { host = "127.0.0.1", port = 0 } = {}) {
	await db.waitReady;
	const queue: Turn[] = [];
	let owner: Connection | null = null;
	let pumping = false;
	const sockets = new Set<Socket>();

	const pump = async () => {
		if (pumping) return;
		pumping = true;
		try {
			while (queue.length) {
				const index = owner ? queue.findIndex((turn) => turn.conn === owner) : 0;
				if (index === -1) break; // the owner's next turn hasn't arrived yet
				const [turn] = queue.splice(index, 1);
				if (!turn) break;
				await db.runExclusive(async () => {
					for (const message of turn.messages) {
						await db.execProtocolRawStream(message, {
							onRawData: (data) => {
								if (data.length && turn.conn.socket.writable) turn.conn.socket.write(Buffer.from(data));
							},
						});
					}
				});
				const openSequence = turn.messages.at(-1)?.[0] === "H".charCodeAt(0);
				owner = db.isInTransaction() || openSequence ? turn.conn : null;
			}
		} finally {
			pumping = false;
		}
	};

	const release = async (conn: Connection) => {
		for (let index = queue.length - 1; index >= 0; index--) if (queue[index]?.conn === conn) queue.splice(index, 1);
		if (owner === conn) {
			owner = null;
			if (db.isInTransaction()) await db.exec("rollback");
		}
		await pump();
	};

	const handle = (socket: Socket) => {
		sockets.add(socket);
		socket.setNoDelay(true);
		const conn: Connection = { socket, started: false, buffer: Buffer.alloc(0), pending: [] };

		const take = () => {
			for (;;) {
				const { buffer } = conn;
				if (!conn.started) {
					if (buffer.length < 8) return;
					const length = buffer.readInt32BE(0);
					const code = buffer.readInt32BE(4);
					if (code === SSL_REQUEST || code === GSSENC_REQUEST) {
						conn.buffer = buffer.subarray(8);
						socket.write("N");
						continue;
					}
					if (code === CANCEL_REQUEST) {
						socket.end();
						return;
					}
					if (buffer.length < length) return;
					if (code !== PROTOCOL_3) {
						socket.destroy();
						return;
					}
					conn.started = true;
					conn.buffer = buffer.subarray(length);
					queue.push({ conn, messages: [new Uint8Array(buffer.subarray(0, length))] });
					continue;
				}
				if (buffer.length < 5) return;
				const length = 1 + buffer.readInt32BE(1);
				if (buffer.length < length) return;
				const type = String.fromCharCode(buffer[0] ?? 0);
				conn.buffer = buffer.subarray(length);
				if (type === "X") {
					socket.end();
					return;
				}
				conn.pending.push(new Uint8Array(buffer.subarray(0, length)));
				if (TURN_ENDS.has(type)) {
					queue.push({ conn, messages: conn.pending });
					conn.pending = [];
				}
			}
		};

		socket.on("data", (chunk: Buffer) => {
			conn.buffer = Buffer.concat([conn.buffer, chunk]);
			take();
			void pump();
		});
		socket.on("error", () => socket.destroy());
		socket.on("close", () => {
			sockets.delete(socket);
			void release(conn);
		});
	};

	const server = createServer(handle);
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, host, resolve);
	});
	const address = server.address();
	return {
		port: typeof address === "object" && address ? address.port : port,
		stop: () =>
			new Promise<void>((resolve) => {
				for (const socket of sockets) socket.destroy();
				server.close(() => resolve());
			}),
	};
}

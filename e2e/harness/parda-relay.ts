/**
 * Stands in for the realtime service in e2e (decision 0243): one channel per party over a plain
 * WebSocket, with presence, checking the same tokens the real service would. CI never
 * calls the real service. The client's side is `connectRelay` in src/features/parda/party/channel.ts.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";

type Member = { socket: WebSocket; data: unknown };

/** The token's channel and member, or null: wrong signature, expired, or without its channel. */
function verify(token: string, secret: string): { channel: string; clientId: string } | null {
	const [head, claims, signature] = token.split(".");
	if (!head || !claims || !signature) return null;
	const wanted = createHmac("sha256", secret).update(`${head}.${claims}`).digest();
	const given = Buffer.from(signature, "base64url");
	if (wanted.length !== given.length || !timingSafeEqual(wanted, given)) return null;
	const payload = JSON.parse(Buffer.from(claims, "base64url").toString()) as {
		exp: number;
		"x-ably-capability": string;
		"x-ably-clientId": string;
	};
	if (payload.exp * 1000 < Date.now()) return null;
	const [channel] = Object.keys(JSON.parse(payload["x-ably-capability"]) as Record<string, unknown>);
	return channel ? { channel, clientId: payload["x-ably-clientId"] } : null;
}

export function servePartyRelay(server: Server, key: string) {
	const secret = key.split(":")[1] ?? "";
	const sockets = new WebSocketServer({ noServer: true });
	const rooms = new Map<string, Map<string, Member>>();

	const broadcast = (room: Map<string, Member>, frame: unknown, except?: string) => {
		const text = JSON.stringify(frame);
		for (const [id, member] of room) {
			if (id !== except && member.socket.readyState === member.socket.OPEN) member.socket.send(text);
		}
	};
	const sendPresence = (room: Map<string, Member>) => {
		const members = [...room].flatMap(([id, member]) => (member.data ? [{ id, data: member.data }] : []));
		broadcast(room, { t: "presence", members });
	};

	server.on("upgrade", (request, socket, head) => {
		const url = new URL(request.url ?? "/", "http://harness");
		const identity = url.pathname === "/parda-relay" ? verify(url.searchParams.get("token") ?? "", secret) : null;
		if (!identity) {
			socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
			return;
		}
		sockets.handleUpgrade(request, socket, head, (client) => {
			const { channel, clientId } = identity;
			const room = rooms.get(channel) ?? new Map<string, Member>();
			rooms.set(channel, room);
			room.set(clientId, { socket: client, data: null });
			client.on("message", (raw) => {
				const frame = JSON.parse(String(raw)) as { t: "publish" | "presence"; data: unknown };
				if (frame.t === "publish") {
					broadcast(room, { t: "message", from: clientId, data: frame.data }, clientId);
					return;
				}
				room.set(clientId, { socket: client, data: frame.data });
				sendPresence(room);
			});
			client.on("close", () => {
				// A reload's new socket may already hold the seat.
				if (room.get(clientId)?.socket !== client) return;
				room.delete(clientId);
				sendPresence(room);
				if (room.size === 0) rooms.delete(channel);
			});
		});
	});
}

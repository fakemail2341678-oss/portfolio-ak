import type { PartyMessage } from "./sync";
import type { PartyConnection } from "./types";

/**
 * The party's channel (PLAN 12.5, "Realtime"; decision 0243), and the only provider code. The
 * hook imports this module on the party's page only, so the SDK reaches no other page. With
 * `relayUrl` it talks to the e2e suite's stand-in instead (e2e/harness/parda-relay.ts): CI
 * never calls the real service.
 */

export type PartyPresence = { name: string; ready: boolean; joinedAt: number };

export type PartyChannel = {
	publish: (message: PartyMessage) => void;
	setPresence: (presence: PartyPresence) => void;
	close: () => void;
};

export type PartyChannelHandlers = {
	/** Unparsed: it comes from the network. `from` is the sender's id, which the service vouches for. */
	onMessage: (from: string | undefined, data: unknown) => void;
	onPresence: (members: ReadonlyArray<{ id: string; data: unknown }>) => void;
	onStatus: (status: "connected" | "reconnecting") => void;
	/** A fresh token from the server, when the last one runs out. */
	renewToken: () => Promise<string>;
};

async function connectAbly(
	connection: PartyConnection,
	presence: PartyPresence,
	handlers: PartyChannelHandlers,
): Promise<PartyChannel> {
	const { BaseRealtime, FetchRequest, RealtimePresence, WebSocketTransport } = await import("ably/modular");
	let first = true;
	const client = new BaseRealtime({
		clientId: connection.clientId,
		echoMessages: false,
		authCallback: (_params, callback) => {
			if (first) {
				first = false;
				callback(null, connection.token);
				return;
			}
			handlers.renewToken().then(
				(token) => callback(null, token),
				(error: unknown) => callback(String(error), null),
			);
		},
		plugins: { FetchRequest, RealtimePresence, WebSocketTransport },
	});
	client.connection.on((change) => {
		if (change.current === "connected") handlers.onStatus("connected");
		else if (change.current === "disconnected" || change.current === "suspended") handlers.onStatus("reconnecting");
	});
	const channel = client.channels.get(connection.channel);
	const readPresence = () => {
		channel.presence.get().then(
			(members) => handlers.onPresence(members.map((member) => ({ id: member.clientId, data: member.data }))),
			() => {},
		);
	};
	await channel.subscribe((message) => handlers.onMessage(message.clientId, message.data));
	await channel.presence.subscribe(readPresence);
	await channel.presence.enter(presence);
	readPresence();
	return {
		publish: (message) => void channel.publish("party", message).catch(() => {}),
		setPresence: (next) => void channel.presence.update(next).catch(() => {}),
		close: () => client.close(),
	};
}

const RELAY_RETRY_MS = 1_000;

/** The e2e stand-in: the same channel over a plain WebSocket, with the same token. */
function connectRelay(
	connection: PartyConnection & { relayUrl: string },
	presence: PartyPresence,
	handlers: PartyChannelHandlers,
): PartyChannel {
	let socket: WebSocket;
	let token = connection.token;
	let current = presence;
	let closed = false;
	const send = (data: unknown) => {
		if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
	};
	const open = () => {
		socket = new WebSocket(`${connection.relayUrl}?token=${encodeURIComponent(token)}`);
		socket.addEventListener("open", () => {
			handlers.onStatus("connected");
			send({ t: "presence", data: current });
		});
		socket.addEventListener("message", (event) => {
			const frame = JSON.parse(String(event.data)) as
				| { t: "message"; from: string; data: unknown }
				| { t: "presence"; members: Array<{ id: string; data: unknown }> };
			if (frame.t === "message") handlers.onMessage(frame.from, frame.data);
			else handlers.onPresence(frame.members);
		});
		socket.addEventListener("close", () => {
			if (closed) return;
			handlers.onStatus("reconnecting");
			setTimeout(() => {
				if (closed) return;
				handlers.renewToken().then(
					(next) => {
						token = next;
						open();
					},
					() => {},
				);
			}, RELAY_RETRY_MS);
		});
	};
	open();
	return {
		publish: (message) => send({ t: "publish", data: message }),
		setPresence: (next) => {
			current = next;
			send({ t: "presence", data: next });
		},
		close: () => {
			closed = true;
			socket.close();
		},
	};
}

export async function connectPartyChannel(
	connection: PartyConnection,
	presence: PartyPresence,
	handlers: PartyChannelHandlers,
): Promise<PartyChannel> {
	const { relayUrl } = connection;
	return relayUrl
		? connectRelay({ ...connection, relayUrl }, presence, handlers)
		: connectAbly(connection, presence, handlers);
}

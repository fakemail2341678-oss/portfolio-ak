import { useQuery } from "@tanstack/react-query";
import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import type { ChaalChatLine } from "../live/events";
import { chatQueryOptions } from "../play/queries";
import { CHAT_MAX } from "../play/schema";

/**
 * The players' chat (PLAN Task 77, "chat (if allowed)"): what was said before the page
 * opened, then the stream's lines, and a line to write. Other people's words are shown as
 * text, never HTML (PLAN 13.6). Hidden against the Lichess AI and while the admin has chat
 * off; Lichess itself may keep a player's lines from showing (a kid account).
 */
export function LiveChat({
	id,
	lines,
	onSend,
	disabled = false,
}: {
	id: string;
	lines: ReadonlyArray<ChaalChatLine>;
	onSend: (text: string) => Promise<boolean>;
	disabled?: boolean;
}) {
	const history = useQuery(chatQueryOptions(id));
	const [text, setText] = useState("");
	const [sending, setSending] = useState(false);
	const list = useRef<HTMLOListElement>(null);
	const shown = [...(history.data ?? []), ...lines.filter((line) => line.room === "player")];

	// The newest line stays in view as lines arrive.
	useEffect(() => {
		const element = list.current;
		if (element && shown.length > 0) element.scrollTop = element.scrollHeight;
	}, [shown.length]);

	const send = async () => {
		const value = text.trim();
		if (!value || sending) return;
		setSending(true);
		const sent = await onSend(value);
		setSending(false);
		if (sent) setText("");
	};

	return (
		<section
			className="ch-rule flex flex-col gap-2 pt-3"
			aria-labelledby="chaal-chat-title"
			data-testid="chaal-game-chat"
		>
			<h2 id="chaal-chat-title" className="font-semibold text-sm">
				{m.ch_live_chat()}
			</h2>
			<ol
				ref={list}
				className="flex max-h-48 min-h-12 flex-col gap-1 overflow-y-auto text-sm"
				aria-live="polite"
				// A scrollable region needs to be reachable by keyboard (axe: scrollable-region-focusable).
				tabIndex={shown.length > 0 ? 0 : undefined}
				data-testid="chaal-game-chat-lines"
			>
				{shown.length === 0 ? <li className="text-ch-muted">{m.ch_live_chat_empty()}</li> : null}
				{shown.map((line, index) => (
					// Lines have no ids; their order never changes.
					// biome-ignore lint/suspicious/noArrayIndexKey: an append-only list.
					<li key={index} className="break-words">
						<span className="font-semibold">{line.username}</span> <span>{line.text}</span>
					</li>
				))}
			</ol>
			<form
				method="post"
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					void send();
				}}
			>
				<Input
					value={text}
					onChange={(event) => setText(event.target.value)}
					maxLength={CHAT_MAX}
					disabled={disabled || sending}
					aria-label={m.ch_live_chat_say()}
					placeholder={m.ch_live_chat_say()}
					autoComplete="off"
					data-testid="chaal-game-chat-input"
				/>
				<Button
					type="submit"
					variant="outline"
					size="icon"
					disabled={disabled || sending || !text.trim()}
					aria-label={m.ch_live_chat_send()}
					title={m.ch_live_chat_send()}
				>
					<SendIcon aria-hidden />
				</Button>
			</form>
		</section>
	);
}

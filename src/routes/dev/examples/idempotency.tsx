import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { exampleMessagesQueryOptions } from "@/features/dev/examples/queries";
import { resetExampleMessages, sendExampleMessage } from "@/functions/examples";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { ensureQuery } from "@/lib/query";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Idempotency keys (a recipe, docs/guides/routing-data.md): the client makes one
 * key per intended action and sends it with every attempt; the server
 * (src/server/examples/idempotency.ts) runs the action once per key and answers
 * repeats with the first result. Here both buttons send the same message twice
 * at once, like a double click or a retry: with a key, one message is sent.
 *
 * In a form, make the key when the form opens (useState(() => crypto.randomUUID()))
 * and a new one after a successful save, never per click.
 */
export const Route = createFileRoute("/dev/examples/idempotency")({
	loader: async ({ context }) => {
		// On demand: the queries and their server functions stay out of every page's JavaScript (0194).
		const { exampleMessagesQueryOptions } = await import("@/features/dev/examples/queries");
		await ensureQuery(context.queryClient, exampleMessagesQueryOptions());
	},
	staticData: { breadcrumb: staticCrumb(m.examples_idempotency_title) },
	head: () => privateHead(m.examples_idempotency_title()),
	component: IdempotencyExample,
});

function IdempotencyExample() {
	const queryClient = useQueryClient();
	const { data: messages } = useSuspenseQuery(exampleMessagesQueryOptions());
	const [text, setText] = useState<string>(() => m.examples_idempotency_default_text());
	const [outcome, setOutcome] = useState<string | null>(null);
	const inputId = useId();
	const refresh = () => queryClient.invalidateQueries({ queryKey: exampleMessagesQueryOptions().queryKey });

	const sendTwice = useMutation({
		mutationFn: async (withKey: boolean) => {
			const key = withKey ? crypto.randomUUID() : undefined;
			// Two attempts of ONE action, in flight together.
			return Promise.all([0, 1].map(() => sendExampleMessage({ data: { text, key } })));
		},
		onSuccess: (results) => {
			const replayed = results.filter((each) => each.replayed).length;
			setOutcome(
				m.examples_idempotency_outcome({
					sent: formatNumber(results.length - replayed),
					replayed: formatNumber(replayed),
				}),
			);
		},
		onError: (error) => toast.error(m.examples_failed(), { description: errorMessage(error) }),
		onSettled: refresh,
	});
	const reset = useMutation({
		mutationFn: () => resetExampleMessages(),
		onSuccess: () => setOutcome(null),
		onSettled: refresh,
	});

	return (
		<ExamplePage slug="idempotency">
			<Demo title={m.examples_idempotency_demo()} note={m.examples_idempotency_note()}>
				<div className="flex max-w-sm flex-col gap-2">
					<Label htmlFor={inputId}>{m.examples_idempotency_message()}</Label>
					<Input id={inputId} value={text} maxLength={80} onChange={(event) => setText(event.target.value)} />
				</div>
				<div className="flex flex-wrap gap-2">
					<Button onClick={() => sendTwice.mutate(true)} disabled={sendTwice.isPending || !text.trim()}>
						{m.examples_idempotency_with_key()}
					</Button>
					<Button
						variant="outline"
						onClick={() => sendTwice.mutate(false)}
						disabled={sendTwice.isPending || !text.trim()}
					>
						{m.examples_idempotency_without_key()}
					</Button>
				</div>
				<p className="min-h-5 text-sm" aria-live="polite" data-testid="idempotency-outcome">
					{sendTwice.isPending ? m.examples_working() : outcome}
				</p>
			</Demo>
			<Demo title={m.examples_idempotency_sent({ count: formatNumber(messages.length) })}>
				{messages.length === 0 ? (
					<p className="text-muted-foreground text-sm">{m.examples_idempotency_empty()}</p>
				) : (
					<ol className="flex list-decimal flex-col gap-1 ps-5 text-sm" data-testid="idempotency-messages">
						{messages.map((message) => (
							<li key={message.id}>{message.text}</li>
						))}
					</ol>
				)}
				<div>
					<Button variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
						{m.examples_reset()}
					</Button>
				</div>
			</Demo>
		</ExamplePage>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/components/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { compareOrderKeys, generateKeysBetween, keyBetweenNeighbours } from "@/lib/fractional-index";
import { formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Order keys (decisions 0188 and 0299): a row's place in a list is a string, and between any
 * two there is always another, so a move writes one row. The algorithm is the
 * `fractional-indexing` package's; src/lib/fractional-index.ts adds the app's rules:
 * - `generateKeysBetween(null, null, n)` for the keys of n new rows (a seed, an import);
 * - `keyBetweenNeighbours(before, after)` for a move: it never fails, even when two tabs
 *   crossed the neighbours;
 * - `isOrderKey(value)` for a key a client sends, before a server stores it;
 * - the column sorts with `COLLATE "C"`, and `compareOrderKeys` is the same order in JavaScript.
 * Taskline's board, the forms builder and the sortable lists store these keys.
 */
export const Route = createFileRoute("/dev/examples/order-keys")({
	staticData: { breadcrumb: staticCrumb(m.examples_order_title) },
	head: () => privateHead(m.examples_order_title()),
	component: OrderKeysExample,
});

type Row = { number: number; key: string };

const START: Row[] = generateKeysBetween(null, null, 5).map((key, index) => ({ number: index + 1, key }));

function OrderKeysExample() {
	const [rows, setRows] = useState(START);
	const [moves, setMoves] = useState(0);
	const [last, setLast] = useState<string | null>(null);
	const sorted = [...rows].sort((a, b) => compareOrderKeys(a.key, b.key));

	const move = (row: Row, direction: -1 | 1) => {
		const others = sorted.filter((each) => each.number !== row.number);
		const at = sorted.indexOf(row) + direction;
		// The moved row's new neighbours: the rows on each side of its new place.
		const key = keyBetweenNeighbours(others[at - 1]?.key, others[at]?.key);
		setRows(rows.map((each) => (each.number === row.number ? { ...each, key } : each)));
		setMoves((count) => count + 1);
		setLast(key);
	};

	return (
		<ExamplePage slug="order-keys">
			<Demo title={m.examples_order_list()} note={m.examples_order_note()}>
				<ol className="flex max-w-md flex-col divide-y rounded-lg border" data-testid="order-rows">
					{sorted.map((row, index) => {
						const name = m.examples_order_row({ number: formatNumber(row.number) });
						return (
							<li key={row.number} className="flex items-center gap-3 px-3 py-2">
								<span className="flex-1">{name}</span>
								<code className="font-mono text-caption text-muted-foreground" dir="ltr">
									{row.key}
								</code>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									disabled={index === 0}
									aria-label={m.examples_order_up({ name })}
									onClick={() => move(row, -1)}
								>
									<ArrowUpIcon aria-hidden="true" />
								</Button>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									disabled={index === sorted.length - 1}
									aria-label={m.examples_order_down({ name })}
									onClick={() => move(row, 1)}
								>
									<ArrowDownIcon aria-hidden="true" />
								</Button>
							</li>
						);
					})}
				</ol>
				<DescriptionList
					items={[
						{ label: m.examples_order_moves(), value: formatNumber(moves) },
						// One key per move, however long the list is.
						{ label: m.examples_order_written(), value: formatNumber(moves), testId: "order-written" },
						{ label: m.examples_order_last(), value: last ?? m.examples_none(), testId: "order-last" },
					]}
				/>
			</Demo>
		</ExamplePage>
	);
}

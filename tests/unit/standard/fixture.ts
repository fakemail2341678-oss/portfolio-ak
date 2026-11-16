/**
 * The fixture of the standard's own tests (rules.test.ts): a small tree, in memory, that holds a
 * feature in the standard's shape ("widgets", which no rule may flag) and one of each deviation
 * ("gadgets" and the files around it). `EXPECTED` says what each rule must find, and nothing else.
 */

const SERVER_FN = 'import { createServerFn } from "@tanstack/react-start";\n';

/** A feature in the standard's shape: no rule finds anything here. */
const CONFORMING: Record<string, string> = {
	"src/features/widgets/schema.ts": `
		import { z } from "zod";
		export const WIDGET_STATUSES = ["draft", "live"] as const;
		export const widgetInputSchema = z.strictObject({ title: z.string() });
		export type WidgetInput = z.output<typeof widgetInputSchema>;
		export const toWidgetInput = (values: WidgetInput): WidgetInput => values;
	`,
	"src/features/widgets/search.ts": 'export const widgetList = listSchema({ sorts: ["title"] });',
	"src/features/widgets/keys.ts": 'export const widgetKeys = { all: ["widgets"] as const };',
	"src/features/widgets/queries.ts": `
		export const widgetListQueryOptions = () => queryOptions({ queryKey: widgetKeys.all, queryFn: listWidgets });
		export const widgetMutations = { create: () => mutationOptions({ mutationFn: createWidget }) };
	`,
	"src/features/widgets/collection.ts": 'export const widgetRows = crudCollection("widgets", widgetKeys.all);',
	"src/features/widgets/columns.tsx": "export const widgetColumns = [];",
	"src/features/widgets/filters.tsx": "export const widgetFilters = defineFilters([]);",
	"src/features/widgets/load.ts": "export const loadWidgets = () => undefined;",
	"src/features/widgets/lib/format.ts": "export const formatWidget = (title: string) => title.trim();",
	"src/features/widgets/hooks/use-widget.ts": `
		import { useState } from "react";
		export function useWidget() {
			return useState(0);
		}
	`,
	"src/features/widgets/components/widget-list.tsx": `
		export function WidgetList() {
			const page = useSuspenseQuery(widgetListQueryOptions());
			const remove = useCrudMutation(widgetMutations.create(), {});
			const preview = useQuery({ ...widgetListQueryOptions(), enabled: open });
			// useQuery: live scores over the server-rendered first paint
			const live = useQuery(widgetListQueryOptions());
			// timer: the toast leaves after four seconds, which is no debounce
			const timer = setTimeout(close, 4000);
			return (
				<input
					// keys: Enter adds the tag, the field's own key
					onKeyDown={add}
				/>
			);
		}
	`,
	"src/features/widgets/components/widget-list.stories.tsx": "export default { component: WidgetList };",
	"src/features/taskline/board/components/board-card.tsx": "export function BoardCard() { return null; }",
	"src/server/widgets/repository.ts": "export const findWidget = (db: Db, id: string) => db.query.widgets.findFirst();",
	"src/server/widgets/service.ts": `
		import { notFound } from "@/lib/errors";
		import type { WidgetInput } from "@/features/widgets/schema";
		export const get = async (id: string) => {
			throw notFound("widget");
		};
	`,
	"src/functions/widgets.ts": `${SERVER_FN}
		export const listWidgets = createServerFn({ method: "GET" })
			.middleware([requirePermission("widgets:read"), withServices])
			.validator(zodInput(widgetList.input))
			.handler(({ data, context }) => widgets.list(context, data));
		export const getWidgetCount = createServerFn({ method: "GET" })
			.middleware([withPublic])
			.handler(({ context }) => widgets.count(context));
		export const joinTasklineBoard = createServerFn({ method: "POST" })
			.middleware([requireTasklineUser, withTasklineServices])
			.validator(zodInput(idSchema))
			.handler(({ data, context }) => {
				return boards.join(context, data);
			});
	`,
	"src/routes/_admin/admin/widgets/index.tsx": `
		import { createFileRoute } from "@tanstack/react-router";
		import { WidgetList } from "@/features/widgets/components/widget-list";
		import type { WidgetInput } from "@/features/widgets/schema";
		import { widgetList } from "@/features/widgets/search";
		export const Route = createFileRoute("/_admin/admin/widgets/")({
			loader: async ({ context }) => {
				const { widgetListQueryOptions } = await import("@/features/widgets/queries");
				await ensureQuery(context.queryClient, widgetListQueryOptions());
			},
			component: () => <WidgetList search={Route.useSearch()} />,
		});
	`,
	"src/routes/dev/examples/state.tsx":
		"export function Example() { const [on, setOn] = useState(false); return null; }",
	"src/routes/__root.tsx": "export function Root() { const theme = useTheme(); return null; }",
	"src/lib/text.ts": `
		/** The text without spaces around it. */
		export const tidy = (text: string) => text.trim();
		export { other } from "./other";
	`,
	"src/hooks/use-list-page.ts": `
		import type { WidgetInput } from "@/features/widgets/schema";
		/** The list page's state, from the URL. */
		export function useListPage() {}
	`,
	"src/components/ui/button.tsx": "export function Button() { return null; }",
	"src/components/crud/use-crud-mutation.ts": `
		/** The one write hook. */
		export function useCrudMutation() {
			return useMutation({});
		}
	`,
	"src/server/db/schema/widgets.ts": 'export const widgets = pgTable("widget", {});',
	"src/server/db/schema/taskline/tasks.ts": 'export const tasks = pgTable("tl_task", {});',
	"src/server/db/schema/apps/forms.ts":
		'export const forms = pgTable("form", {});\nexport const responses = pgTable("form_response", {});',
	"src/server/db/schema/portfolio.ts": 'export const posts = pgTable("portfolio_post", {});',
	"drizzle/0003_old_name.sql": "",
	"drizzle/0059_core_widgets.sql": "",
	"drizzle/0060_taskline_boards.sql": "",
	"messages/en.json": JSON.stringify({
		$schema: "https://inlang.com/schema/inlang-message-format",
		widgets_title: "Widgets",
		taskline_board_title: "Board",
		common_save: "Save",
	}),
	"tests/unit/widgets.test.ts": "",
	"tests/server/widgets-service.test.ts": "",
	"tests/components/crud/list-page.test.tsx": "",
	"tests/unit/text-tidy.test.ts": "",
};

/** One of each deviation. */
const DEVIATING: Record<string, string> = {
	// feature-file, feature-component, feature-lib
	"src/features/gadgets/helpers.ts": "export const double = (value: number) => value * 2;",
	"src/features/gadgets/use-gadget.ts": "export function useGadget() {}",
	"src/features/gadgets/gadget-panel.tsx": "export function GadgetPanel() { return null; }",
	"src/features/gadgets/lib/view.tsx": "export function View() { return null; }",
	"src/features/gadgets/lib/state.ts": 'import { useState } from "react";\nexport const make = () => useState;',
	"src/features/gadgets/hooks/helpers.ts": "export const helper = 1;",
	// component-role, hook-file
	"src/features/gadgets/components/gadget-bits.tsx": "export function GadgetBits() { return null; }",
	"src/features/gadgets/components/gadget-card.tsx": `
		export function GadgetCard() { return null; }
		export const useGadgetCard = () => 1;
	`,
	// export-name
	"src/features/gadgets/keys.ts": 'export const gadgetCache = ["gadgets"];',
	"src/features/gadgets/queries.ts": "export const loadGadgets = () => listGadgets();",
	"src/features/gadgets/collection.ts": "export const gadgetCollection = crudCollection();",
	"src/features/gadgets/schema.ts": "export const gadgetInput = z.strictObject({});",
	// write-path, read-path, key-handler, timer
	"src/features/gadgets/components/gadget-form.tsx": `
		export function GadgetForm() {
			const save = useMutation({ mutationFn: saveGadget });
			const rows = useQuery(gadgetQueryOptions());
			window.setTimeout(close, 100);
			const poll = setInterval(read, 1000);
			document.addEventListener("keydown", onKey);
			return <input onKeyDown={onKey} />;
		}
	`,
	// server-file, bare-error
	"src/server/gadgets/gadgets-repository.ts": "export const findGadget = () => undefined;",
	"src/server/gadgets/service.ts": 'export const get = () => {\n\tthrow new Error("gone");\n};',
	// function-*
	"src/functions/gadgets.ts": `${SERVER_FN}
		export const saveGadget = createServerFn({ method: "POST" })
			.middleware([requirePermission("gadgets:update"), withServices])
			.validator(zodInput(gadgetInput))
			.handler(({ data, context }) => gadgets.save(context, data));
		export const frobGadget = createServerFn({ method: "POST" })
			.middleware([requirePermission("gadgets:update"), withServices])
			.handler(({ context }) => gadgets.frob(context));
		export const getGadgetFlags = createServerFn({ method: "GET" }).handler(() => flags());
		export const listGadgets = createServerFn({ method: "GET" })
			.middleware([gadgetMiddleware])
			.handler(({ context }) => gadgets.list(context));
		export const getGadget = createServerFn({ method: "GET" })
			.middleware([withServices, requirePermission("gadgets:read")])
			.validator((input: unknown) => input)
			.handler(({ data, context }) => gadgets.get(context, data));
		export const deleteGadget = createServerFn({ method: "POST" })
			.middleware([requirePermission("gadgets"), withServices])
			.handler(({ data, context }) => gadgets.delete(context, data));
		export const updateGadget = createServerFn({ method: "POST" })
			.middleware([requirePermission("gadgets:update"), withServices])
			.validator(zodInput(gadgetInput))
			.handler(async ({ data, context }) => {
				const before = await gadgets.get(context, data);
				return gadgets.update(context, before, data);
			});
		export const createGadget = guarded(createServerFn({ method: "POST" }));
	`,
	// route-import, route-thin
	"src/routes/_admin/admin/gadgets/index.tsx": `
		import { useState } from "react";
		import { gadgetQueryOptions } from "@/features/gadgets/queries";
		export const Route = createFileRoute("/_admin/admin/gadgets/")({ component: Gadgets });
		function Gadgets() {
			const [open, setOpen] = useState(false);
			return null;
		}
	`,
	// file-name, import-boundary, documented-export
	"src/lib/someThing.ts": "/** A value. */\nexport const some = 1;",
	"src/lib/reach.ts": `
		import { gadgetCache } from "@/features/gadgets/keys";
		export const reach = gadgetCache;
	`,
	"src/components/page/page-frame.tsx": `
		import { GadgetBits } from "../../features/gadgets/components/gadget-bits";
		/** The frame of a page. */
		export function PageFrame() { return null; }
	`,
	// table-name, migration-name, message-name
	"src/server/db/schema/taskline/board.ts": 'export const boards = pgTable("board", {});',
	"drizzle/0061_gadgets.sql": "",
	"messages/extra.json": "{}",
	// test-place, test-name
	"tests/i18n/widgets.test.ts": "",
	"tests/unit/misc-things.test.ts": "",
};

const messages = JSON.parse(CONFORMING["messages/en.json"] ?? "{}") as Record<string, string>;

export const FIXTURE: Record<string, string> = {
	...CONFORMING,
	...DEVIATING,
	"messages/en.json": JSON.stringify({ ...messages, gd_title: "Gadgets", gd_empty: "None" }),
};
export const CONFORMING_FIXTURE = CONFORMING;

/** What each rule finds in the fixture: `{ key: count }`. A rule that is not here finds nothing. */
export const EXPECTED: Record<string, Record<string, number>> = {
	"feature-file": { "src/features/gadgets/helpers.ts": 1, "src/features/gadgets/use-gadget.ts": 1 },
	"feature-component": { "src/features/gadgets/gadget-panel.tsx": 1 },
	"feature-lib": {
		"src/features/gadgets/lib/view.tsx": 1,
		"src/features/gadgets/lib/state.ts": 1,
		"src/features/gadgets/hooks/helpers.ts": 1,
	},
	"server-file": { "src/server/gadgets/gadgets-repository.ts": 1 },
	"test-place": { "tests/i18n/widgets.test.ts": 1 },
	"test-name": { "tests/unit/misc-things.test.ts": 1 },
	"file-name": { "src/lib/someThing.ts": 1 },
	"component-role": {
		"src/features/gadgets/components/gadget-bits.tsx": 1,
		"src/features/gadgets/lib/view.tsx": 1,
	},
	"hook-file": { "src/features/gadgets/components/gadget-card.tsx#useGadgetCard": 1 },
	"export-name": {
		"src/features/gadgets/keys.ts#gadgetCache": 1,
		"src/features/gadgets/queries.ts#loadGadgets": 1,
		"src/features/gadgets/collection.ts#gadgetCollection": 1,
		"src/features/gadgets/schema.ts#gadgetInput": 1,
	},
	"table-name": { "src/server/db/schema/taskline/board.ts#board": 1 },
	"migration-name": { "drizzle/0061_gadgets.sql": 1 },
	"message-name": { gd: 1 },
	"function-literal": { "src/functions/gadgets.ts": 1 },
	"function-verb": { "src/functions/gadgets.ts#saveGadget": 1, "src/functions/gadgets.ts#frobGadget": 1 },
	"function-guards": {
		"src/functions/gadgets.ts#getGadgetFlags": 1,
		"src/functions/gadgets.ts#listGadgets": 1,
		"src/functions/gadgets.ts#getGadget": 1,
		"src/functions/gadgets.ts#deleteGadget": 1,
	},
	"function-validator": { "src/functions/gadgets.ts#getGadget": 1, "src/functions/gadgets.ts#deleteGadget": 1 },
	"function-handler": { "src/functions/gadgets.ts#updateGadget": 1 },
	"write-path": { "src/features/gadgets/components/gadget-form.tsx": 1 },
	"read-path": { "src/features/gadgets/components/gadget-form.tsx": 1 },
	"route-import": { "src/routes/_admin/admin/gadgets/index.tsx": 1 },
	"route-thin": { "src/routes/_admin/admin/gadgets/index.tsx": 1 },
	"key-handler": { "src/features/gadgets/components/gadget-form.tsx": 2 },
	timer: { "src/features/gadgets/components/gadget-form.tsx": 2 },
	"bare-error": { "src/server/gadgets/service.ts": 1 },
	"import-boundary": { "src/lib/reach.ts": 1, "src/components/page/page-frame.tsx": 1 },
	"documented-export": { "src/lib/reach.ts": 1 },
};

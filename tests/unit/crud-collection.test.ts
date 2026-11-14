import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { crudCollection, deleteRows, updateRows } from "@/lib/crud/collection";
import { createDbClient } from "@/lib/tanstack-db";

/**
 * The admin lists' collection (src/lib/crud/collection.ts, decision 0294): it holds the
 * rows of every cached page of a list, follows the Query cache, and shows a write's
 * change for as long as its transaction lasts (what useCrudMutation does around a write).
 */
type Item = { id: string; title: string; status: "draft" | "published" };

const page = (items: Item[]) => ({ items, page: 1, pageCount: 1, pageSize: 20, total: items.length });
const item = (id: string, status: Item["status"] = "draft"): Item => ({ id, title: id.toUpperCase(), status });

const setup = () => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
	});
	const db = createDbClient(queryClient);
	queryClient.setQueryData(["items", "list", { page: 1 }], page([item("a"), item("b")]));
	queryClient.setQueryData(["items", "list", { page: 2 }], page([item("c")]));
	// Not a list: a record's own query is left alone.
	queryClient.setQueryData(["items", "detail", "z"], item("z"));
	const collection = db.collection(crudCollection<Item>("items", ["items", "list"]));
	return { queryClient, db, collection };
};

/** A write as useCrudMutation runs it: the change now, kept until the server has answered. */
const write = (db: ReturnType<typeof createDbClient>, change: () => void) => {
	let keep = () => {};
	let undo = (_error: unknown) => {};
	const settled = new Promise<void>((resolve, reject) => {
		keep = resolve;
		undo = reject;
	});
	const transaction = db.createTransaction({ autoCommit: false, mutationFn: () => settled });
	transaction.mutate(change);
	const done = transaction.commit().then(
		() => "kept" as const,
		() => "undone" as const,
	);
	return { keep, undo, done };
};

describe("crudCollection", () => {
	it("holds the rows of every cached page of the list", async () => {
		const { collection } = setup();
		await collection.preload();
		expect([...collection.keys()].sort()).toEqual(["a", "b", "c"]);
	});

	it("follows the Query cache: a refetched page replaces its rows", async () => {
		const { collection, queryClient } = setup();
		await collection.preload();
		queryClient.setQueryData(["items", "list", { page: 1 }], page([item("a", "published")]));
		expect(collection.get("a")?.status).toBe("published");
		expect(collection.has("b")).toBe(false);
		expect(collection.has("c")).toBe(true);
	});

	it("keeps a row's newest copy when two cached pages hold it", async () => {
		const { collection, queryClient } = setup();
		await collection.preload();
		// Page 2 (cached earlier, not refetched) still has the old copy of "a".
		queryClient.setQueryData(["items", "list", { page: 2 }], page([item("a"), item("c")]), { updatedAt: 1 });
		queryClient.setQueryData(["items", "list", { page: 1 }], page([item("a", "published"), item("b")]));
		expect(collection.get("a")?.status).toBe("published");
	});

	it("shows an optimistic change at once and keeps the server's rows after the write", async () => {
		const { collection, db, queryClient } = setup();
		await collection.preload();
		const pending = write(db, () => {
			updateRows(collection, ["a"], (row) => {
				row.status = "published";
			});
			deleteRows(collection, ["b", "not-on-a-cached-page"]);
		});
		expect(collection.get("a")?.status).toBe("published");
		expect(collection.has("b")).toBe(false);

		// The server answered and the list was read again, then the transaction ends.
		queryClient.setQueryData(["items", "list", { page: 1 }], page([item("a", "published")]));
		pending.keep();
		expect(await pending.done).toBe("kept");
		expect(collection.get("a")?.status).toBe("published");
		expect(collection.has("b")).toBe(false);
	});

	it("puts the rows back when the server refuses", async () => {
		const { collection, db } = setup();
		await collection.preload();
		const pending = write(db, () => deleteRows(collection, ["a", "c"]));
		expect([...collection.keys()]).toEqual(["b"]);
		pending.undo(new Error("server said no"));
		expect(await pending.done).toBe("undone");
		expect([...collection.keys()].sort()).toEqual(["a", "b", "c"]);
	});

	it("gives each DbClient (each request on the server) its own rows", async () => {
		const first = setup();
		const second = setup();
		await first.collection.preload();
		await second.collection.preload();
		first.queryClient.setQueryData(["items", "list", { page: 1 }], page([]));
		expect(first.collection.has("a")).toBe(false);
		expect(second.collection.has("a")).toBe(true);
	});
});

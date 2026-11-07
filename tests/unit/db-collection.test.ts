import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { collectionOptions } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createDbClient, queryClientOf } from "@/lib/tanstack-db";

/**
 * The TanStack DB query-collection pattern from src/lib/tanstack-db.ts, exercised with a
 * fake "server" in place of server functions: SSR-safe per-client
 * materialization, Query-backed loading, optimistic updates and rollback.
 */
type Item = { id: string; title: string };

const makeServer = (rows: Item[]) => {
	let data = [...rows];
	return {
		list: vi.fn(async () => data.map((row) => ({ ...row }))),
		update: vi.fn(async (id: string, changes: Partial<Item>) => {
			data = data.map((row) => (row.id === id ? { ...row, ...changes } : row));
		}),
		insert: vi.fn(async (item: Item) => {
			data = [...data, item];
		}),
		fail: vi.fn(async () => {
			throw new Error("server said no");
		}),
	};
};

const setup = (options: { failWrites?: boolean } = {}) => {
	const server = makeServer([
		{ id: "a", title: "Alpha" },
		{ id: "b", title: "Beta" },
	]);
	const itemsCollection = collectionOptions("items", (client) =>
		queryCollectionOptions({
			id: "items",
			queryKey: ["items"],
			queryFn: () => server.list(),
			queryClient: queryClientOf(client),
			getKey: (item: Item) => item.id,
			onUpdate: async ({ transaction }) => {
				if (options.failWrites) return server.fail();
				for (const mutation of transaction.mutations) await server.update(String(mutation.key), mutation.changes);
			},
			onInsert: async ({ transaction }) => {
				if (options.failWrites) return server.fail();
				for (const mutation of transaction.mutations) await server.insert(mutation.modified);
			},
		}),
	);
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const dbClient = createDbClient(queryClient);
	return { server, queryClient, dbClient, collection: dbClient.collection(itemsCollection), itemsCollection };
};

describe("TanStack DB query collection", () => {
	it("loads rows through TanStack Query (the collection shares the query cache)", async () => {
		const { collection, queryClient, server } = setup();
		await collection.preload();
		expect(collection.size).toBe(2);
		expect(collection.get("a")?.title).toBe("Alpha");
		expect(queryClient.getQueryData(["items"])).toHaveLength(2);
		expect(server.list).toHaveBeenCalledTimes(1);
	});

	it("applies updates optimistically and keeps them once the server accepts", async () => {
		const { collection, server } = setup();
		await collection.preload();
		const tx = collection.update("a", (draft) => {
			draft.title = "Alpha 2";
		});
		// Visible immediately, before the server has answered.
		expect(collection.get("a")?.title).toBe("Alpha 2");
		await tx.isPersisted.promise;
		expect(server.update).toHaveBeenCalledWith("a", { title: "Alpha 2" });
		expect(collection.get("a")?.title).toBe("Alpha 2");
	});

	it("rolls back an optimistic change when the server call fails", async () => {
		const { collection } = setup({ failWrites: true });
		await collection.preload();
		const update = collection.update("a", (draft) => {
			draft.title = "Doomed";
		});
		const insert = collection.insert({ id: "c", title: "Gamma" });
		expect(collection.get("a")?.title).toBe("Doomed");
		expect(collection.has("c")).toBe(true);
		await expect(update.isPersisted.promise).rejects.toThrow("server said no");
		await expect(insert.isPersisted.promise).rejects.toThrow("server said no");
		expect(collection.get("a")?.title).toBe("Alpha");
		expect(collection.has("c")).toBe(false);
	});

	it("gives each DbClient (each SSR request) its own collection instance", async () => {
		const first = setup();
		const second = createDbClient(new QueryClient()).collection(first.itemsCollection);
		expect(second).not.toBe(first.collection);
		expect(first.dbClient.collection(first.itemsCollection)).toBe(first.collection);
	});
});

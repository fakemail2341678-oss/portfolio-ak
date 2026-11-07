import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NOTES_QUOTAS } from "@/features/apps/notes/types";
import { isAppError } from "@/lib/errors";
import * as repo from "@/server/apps/notes/repository";
import type { NoteServices } from "@/server/apps/notes/service";
import * as notes from "@/server/apps/notes/service";
import * as schema from "@/server/db/schema";
import { richTextToText } from "@/server/rich-text/sanitize";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * Notes (decision 0190) on PGlite: every call sees and changes only its caller's notes,
 * full-text search ranks and works for Devanagari, saves are versioned and sanitized,
 * images link and go with their note, sharing is for accounts only and revocable, and
 * a guest's sample notes and claim work.
 */
let env: Awaited<ReturnType<typeof createTestDb>>;
let cloud: ReturnType<typeof createFakeCloudinary>;

beforeAll(async () => {
	env = await createTestDb("admin-1", (db) =>
		db.insert(schema.user).values([
			{ id: "alice", name: "Alice", email: "alice@example.com" },
			{ id: "bob", name: "Bob", email: "bob@example.com" },
			{ id: "guest-1", name: "Guest", email: "g1@anonymous.placeholder.invalid", isAnonymous: true },
		]),
	);
}, 60_000);
afterAll(() => env.close());
beforeEach(async () => {
	await env.reset();
	cloud = createFakeCloudinary();
});

const as = (id: string, isGuest = false): NoteServices => ({
	db: env.db,
	user: { id, isGuest },
	imageStore: cloud.store,
});
const alice = () => as("alice");
const bob = () => as("bob");
const guest = () => as("guest-1", true);

const code = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return "ok";
	} catch (error) {
		return isAppError(error) ? error.code : "thrown";
	}
};

/** A note of Alice's with a title and body. */
async function aliceNote(title = "Trek plan", body = "<p>Pack boots</p>") {
	const created = await notes.createNote(alice(), { id: crypto.randomUUID(), title: "Untitled" });
	const note = await notes.getNote(alice(), created.id);
	return notes.updateNote(alice(), { id: note.id, updatedAt: note.updatedAt, title, body, tags: ["trek"], images: [] });
}

describe("Notes ownership", () => {
	it("never shows one user's notes to another", async () => {
		const note = await aliceNote();
		expect((await notes.listNotes(bob())).notes).toEqual([]);
		expect((await notes.searchNotes(bob(), "boots")).ids).toEqual([]);
		expect(await code(notes.getNote(bob(), note.id))).toBe("NOT_FOUND");
	});

	it("refuses every change to someone else's note as not found", async () => {
		const note = await aliceNote();
		const save = { id: note.id, updatedAt: note.updatedAt, title: "Mine", body: "", tags: [], images: [] };
		expect(await code(notes.updateNote(bob(), save))).toBe("NOT_FOUND");
		expect(await code(notes.setNoteFlags(bob(), { id: note.id, pinned: true }))).toBe("NOT_FOUND");
		expect(await code(notes.shareNote(bob(), note.id))).toBe("NOT_FOUND");
		expect(await code(notes.deleteNote(bob(), note.id))).toBe("NOT_FOUND");
		expect((await notes.getNote(alice(), note.id)).title).toBe("Trek plan");
	});
});

describe("Notes saves", () => {
	it("sanitizes the body and keeps its text for search and the excerpt", async () => {
		const note = await aliceNote(
			"Safe",
			'<p>Hi <script>alert(1)</script><a href="javascript:x">there</a> &amp; you</p>',
		);
		expect(note.body).not.toContain("script");
		expect(note.body).not.toContain("javascript");
		const [summary] = (await notes.listNotes(alice())).notes;
		expect(summary?.excerpt).toBe("Hi there & you");
	});

	it("refuses a save from an old version (stale)", async () => {
		const note = await aliceNote();
		const save = { id: note.id, updatedAt: note.updatedAt, title: "First", body: "", tags: [], images: [] };
		await notes.updateNote(alice(), save);
		const error = await notes.updateNote(alice(), { ...save, title: "Second" }).catch((caught: unknown) => caught);
		expect(isAppError(error) && error.code).toBe("CONFLICT");
	});

	it("pins first and archives out of the main list order", async () => {
		const older = await aliceNote("Older");
		await aliceNote("Newer");
		await notes.setNoteFlags(alice(), { id: older.id, pinned: true });
		expect((await notes.listNotes(alice())).notes.map((note) => note.title)).toEqual(["Older", "Newer"]);
		await notes.setNoteFlags(alice(), { id: older.id, archived: true });
		const archived = (await notes.listNotes(alice())).notes.find((note) => note.id === older.id);
		expect(archived?.archived).toBe(true);
	});

	it(`allows ${NOTES_QUOTAS.notes} notes`, async () => {
		await env.db.transaction((tx) =>
			repo.insertNotes(
				tx,
				"alice",
				Array.from({ length: NOTES_QUOTAS.notes }, (_, index) => ({ title: `Note ${index}` })),
			),
		);
		expect(await code(notes.createNote(alice(), { id: crypto.randomUUID(), title: "Over" }))).toBe("CONFLICT");
		expect(await code(notes.createNote(bob(), { id: crypto.randomUUID(), title: "Bob's" }))).toBe("ok");
	});
});

describe("Notes search", () => {
	it("matches words in the title and text, title matches first", async () => {
		const inBody = await aliceNote("Shopping", "<p>Buy rope for the trek</p>");
		const inTitle = await aliceNote("Rope knots", "<p>Bowline, clove hitch</p>");
		await aliceNote("Unrelated", "<p>Nothing here</p>");
		expect((await notes.searchNotes(alice(), "rope")).ids).toEqual([inTitle.id, inBody.id]);
	});

	it("understands phrases and exclusions (websearch syntax)", async () => {
		const exact = await aliceNote("A", "<p>mountain trek in spring</p>");
		await aliceNote("B", "<p>trek to the mountain</p>");
		expect((await notes.searchNotes(alice(), '"mountain trek"')).ids).toEqual([exact.id]);
		expect((await notes.searchNotes(alice(), "trek -spring")).ids).toHaveLength(1);
	});

	it("finds Devanagari words as written", async () => {
		const note = await aliceNote("हिमाली पदयात्रा", "<p>बिहान स्वयम्भूसम्म हिँड्ने।</p>");
		expect((await notes.searchNotes(alice(), "पदयात्रा")).ids).toEqual([note.id]);
		expect((await notes.searchNotes(alice(), "स्वयम्भूसम्म")).ids).toEqual([note.id]);
	});

	it("takes any text without a syntax error", async () => {
		await aliceNote();
		for (const q of ['"', "-", "a & b | !c", "(((", "'; drop table note; --"]) {
			expect(await code(notes.searchNotes(alice(), q))).toBe("ok");
		}
	});
});

describe("Notes images", () => {
	async function upload(services: NoteServices) {
		const ticket = await notes.signNoteUpload(services);
		cloud.put(ticket.publicId);
		return notes.confirmNoteUpload(services, ticket.publicId);
	}

	it("links an upload on save and deletes it with the note", async () => {
		const note = await aliceNote();
		const image = await upload(alice());
		const saved = await notes.updateNote(alice(), {
			id: note.id,
			updatedAt: note.updatedAt,
			title: note.title,
			body: note.body,
			tags: note.tags,
			images: [{ id: image.id, alt: { en: "Boots", ne: "" } }],
		});
		expect(saved.images.map((each) => each.id)).toEqual([image.id]);
		expect((await notes.listNotes(alice())).notes[0]?.cover?.id).toBe(image.id);
		await notes.deleteNote(alice(), note.id);
		expect(cloud.destroyed).toHaveLength(1);
	});

	it("refuses someone else's upload", async () => {
		const note = await aliceNote();
		const image = await upload(bob());
		const save = {
			id: note.id,
			updatedAt: note.updatedAt,
			title: note.title,
			body: note.body,
			tags: [],
			images: [{ id: image.id, alt: { en: "", ne: "" } }],
		};
		expect(await code(notes.updateNote(alice(), save))).toBe("BAD_REQUEST");
	});

	it("lets a guest upload (no permission needed) within the hourly limit", async () => {
		for (let index = 0; index < NOTES_QUOTAS.uploadsPerHour; index++) await notes.signNoteUpload(guest());
		expect(await code(notes.signNoteUpload(guest()))).toBe("RATE_LIMITED");
	});
});

describe("Notes sharing", () => {
	it("shares a note by an unguessable token and stops on revoke", async () => {
		const note = await aliceNote();
		const { token } = await notes.shareNote(alice(), note.id);
		expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
		expect((await notes.shareNote(alice(), note.id)).token).toBe(token);
		const shared = await notes.getSharedNote({ db: env.db, imageStore: null }, token);
		expect(shared).toMatchObject({ title: "Trek plan" });
		expect(shared).not.toHaveProperty("tags");
		await notes.unshareNote(alice(), note.id);
		expect(await code(notes.getSharedNote({ db: env.db, imageStore: null }, token))).toBe("NOT_FOUND");
		const again = await notes.shareNote(alice(), note.id);
		expect(again.token).not.toBe(token);
	});

	it("refuses sharing to a guest", async () => {
		const created = await notes.createNote(guest(), { id: crypto.randomUUID(), title: "Mine" });
		expect(await code(notes.shareNote(guest(), created.id))).toBe("FORBIDDEN");
	});
});

describe("Notes for guests", () => {
	it("seeds sample notes in the guest's language, searchable", async () => {
		await env.db.transaction((tx) => notes.seedNotes(tx, "guest-1", "ne"));
		const { notes: list } = await notes.listNotes(guest());
		expect(list).toHaveLength(3);
		expect(list[0]).toMatchObject({ title: "टिपोटमा स्वागत छ", pinned: true });
		expect((await notes.searchNotes(guest(), "स्वयम्भूसम्म")).ids).toHaveLength(1);
	});

	it("moves every note to an account on claim", async () => {
		await env.db.transaction((tx) => notes.seedNotes(tx, "guest-1", "en"));
		await env.db.transaction((tx) => notes.claimNotes(tx, "guest-1", "bob"));
		expect((await notes.listNotes(guest())).notes).toEqual([]);
		expect((await notes.listNotes(bob())).notes.map((note) => note.title)).toContain("Welcome to Notes");
	});

	it("counts usage by accounts and guests", async () => {
		const note = await aliceNote();
		await notes.shareNote(alice(), note.id);
		await env.db.transaction((tx) => notes.seedNotes(tx, "guest-1", "en"));
		const usage = await notes.notesUsage(env.db);
		expect(usage).toMatchObject({ accounts: 1, guests: 1, rows: { notes: 4, shared: 1, images: 0 } });
	});
});

describe("richTextToText", () => {
	it("keeps one line per block and decodes entities", () => {
		expect(
			richTextToText("<h2>Title</h2><p>a &lt;b&gt; &amp; c</p><ul><li><p>one</p></li><li><p>two</p></li></ul>"),
		).toBe("Title\na <b> & c\none\ntwo");
	});
});

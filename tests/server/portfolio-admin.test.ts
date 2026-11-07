import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostInput, ProjectInput } from "@/features/portfolio/schema";
import type { Actor } from "@/features/rbac/types";
import { isStaleError } from "@/lib/concurrency";
import { confirmUpload } from "@/server/attachments/service";
import * as schema from "@/server/db/schema";
import * as media from "@/server/media/service";
import * as messages from "@/server/portfolio/messages-service";
import * as posts from "@/server/portfolio/posts-service";
import * as profile from "@/server/portfolio/profile-service";
import * as projects from "@/server/portfolio/projects-service";
import * as sections from "@/server/portfolio/sections-service";
import { seedPortfolio } from "../../scripts/lib/portfolio-seed.ts";
import { createFakeCloudinary } from "../utils/fake-cloudinary";
import { createTestDb } from "../utils/test-db";

/**
 * The portfolio admin's work (src/server/portfolio, src/server/media; decision
 * 0176) on PGlite, with the real Cloudinary client over a fake API. Permissions
 * are the middleware's job (guarded-functions.test.ts); the publish rule inside
 * saves and the media rules are checked here.
 */

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let cloud: ReturnType<typeof createFakeCloudinary>;
beforeAll(async () => {
	testDb = await createTestDb();
}, 60_000);
afterAll(() => testDb.close());
beforeEach(async () => {
	await testDb.reset();
	cloud = createFakeCloudinary();
});

const ADMIN: Actor = { id: "admin-1", isAdmin: true, permissions: [] };
/** A writer who may not publish (portfolio:write only). */
const WRITER: Actor = { id: "admin-1", isAdmin: false, permissions: ["portfolio:read", "portfolio:write"] };
const services = (actor: Actor = ADMIN) => ({ db: testDb.db, actor, imageStore: cloud.store });
const text = (en: string, ne = "") => ({ en, ne });

const project = (overrides: Partial<ProjectInput> = {}): ProjectInput => ({
	title: "Ledgerline",
	slug: "ledgerline",
	client: text("Himal Capital"),
	year: 2026,
	disciplines: ["product"],
	role: text("Lead"),
	duration: text("Six months"),
	summary: text("A treasury dashboard."),
	stack: ["PostgreSQL"],
	links: [],
	metrics: [],
	blocks: [{ id: "b1", type: "quote", text: text("Hello"), cite: "" }],
	artSeed: "",
	motif: "grid",
	glyph: "L",
	appSlug: "", // @apps
	featured: false,
	status: "draft",
	coverId: null,
	gallery: [],
	...overrides,
});

const post = (overrides: Partial<PostInput> = {}): PostInput => ({
	title: text("Postgres is enough", "Postgres पर्याप्त छ"),
	slug: "postgres-is-enough",
	excerpt: text("Queues and search."),
	body: text('<p onclick="x()">Hi<script>alert(1)</script></p>', "<p>नमस्ते</p>"),
	tags: ["PostgreSQL"],
	status: "draft",
	coverId: null,
	...overrides,
});

/** A verified upload into the media library. */
const libraryImage = async () => {
	const uploader = { id: testDb.adminId, permissions: ["attachments:upload", "media:write"] };
	const ticket = cloud.store.signUpload("media");
	cloud.put(ticket.publicId);
	return confirmUpload(testDb.db, cloud.store, { publicId: ticket.publicId, scope: "media" }, uploader);
};

const auditActions = async (targetId: string) =>
	(
		await testDb.db
			.select({ action: schema.auditEvent.action })
			.from(schema.auditEvent)
			.where(eq(schema.auditEvent.targetId, targetId))
			.orderBy(asc(schema.auditEvent.createdAt))
	).map((row) => row.action);

describe("projects", () => {
	it("creates, edits against a version, publishes and deletes, each audited", async () => {
		const created = await projects.create(services(), project());
		expect(created).toMatchObject({ slug: "ledgerline", status: "draft", publishedAt: null, sortOrder: 0 });
		const edited = await projects.update(services(), {
			...project({ title: "Ledgerline 2" }),
			id: created.id,
			updatedAt: created.updatedAt,
		});
		expect(edited.title).toBe("Ledgerline 2");
		// The old version is stale now.
		const stale = await projects
			.update(services(), { ...project(), id: created.id, updatedAt: created.updatedAt })
			.catch((error: unknown) => error);
		expect(isStaleError(stale)).toBe(true);
		const published = await projects.setStatus(services(), { id: created.id, status: "published" });
		expect(published.publishedAt).not.toBeNull();
		expect(await projects.remove(services(), [created.id])).toEqual({ deleted: 1 });
		expect(await auditActions(created.id)).toEqual([
			"project.create",
			"project.update",
			"project.publish",
			"project.delete",
		]);
	});

	it("maps a taken slug to the slug field", async () => {
		await projects.create(services(), project());
		await expect(projects.create(services(), project())).rejects.toMatchObject({
			code: "CONFLICT",
			fieldErrors: { slug: [expect.any(String)] },
		});
		expect(await projects.isSlugFree(services(), { slug: "ledgerline" })).toBe(false);
	});

	it("refuses a status change in a save without portfolio:publish (a new project must be a draft)", async () => {
		await expect(projects.create(services(WRITER), project({ status: "published" }))).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const draft = await projects.create(services(WRITER), project());
		await expect(
			projects.update(services(WRITER), {
				...project({ status: "published" }),
				id: draft.id,
				updatedAt: draft.updatedAt,
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		// Other edits are fine.
		const saved = await projects.update(services(WRITER), {
			...project({ title: "Renamed" }),
			id: draft.id,
			updatedAt: draft.updatedAt,
		});
		expect(saved).toMatchObject({ title: "Renamed", status: "draft" });
	});

	it("reorders without making open edits stale, and lists in that order", async () => {
		const a = await projects.create(services(), project({ slug: "a", title: "A" }));
		const b = await projects.create(services(), project({ slug: "b", title: "B" }));
		const c = await projects.create(services(), project({ slug: "c", title: "C" }));
		expect(await projects.reorder(services(), [c.id, a.id])).toEqual({ moved: 2 });
		expect((await projects.listOrder(services())).map((item) => item.title)).toEqual(["C", "A", "B"]);
		// b moved to the end too, but its version is unchanged: its open edit still saves.
		await expect(
			projects.update(services(), { ...project({ slug: "b", title: "B!" }), id: b.id, updatedAt: b.updatedAt }),
		).resolves.toMatchObject({ title: "B!" });
		expect(await projects.reorder(services(), [c.id, a.id, b.id])).toEqual({ moved: 0 });
	});

	it("uses media-library images by id, and refuses anything else on its field", async () => {
		const cover = await libraryImage();
		const created = await projects.create(services(), project({ coverId: cover.id, gallery: [cover.id] }));
		expect(created.cover?.id).toBe(cover.id);
		expect(created.gallery.map((image) => image.id)).toEqual([cover.id]);
		await expect(
			projects.create(services(), project({ slug: "other", coverId: "00000000-0000-4000-8000-000000000000" })),
		).rejects.toMatchObject({ code: "BAD_REQUEST", fieldErrors: { cover: [expect.any(String)] } });
	});
});

describe("journal posts", () => {
	it("sanitizes the body in both languages and stamps the first publish", async () => {
		const created = await posts.create(services(), post());
		expect(created.body).toEqual({ en: "<p>Hi</p>", ne: "<p>नमस्ते</p>" });
		const published = await posts.setStatus(services(), { id: created.id, status: "published" });
		expect(published.publishedAt).not.toBeNull();
		await posts.setStatus(services(), { id: created.id, status: "draft" });
		expect((await posts.get(services(), created.id)).publishedAt).toBeNull();
		expect(await auditActions(created.id)).toEqual(["post.create", "post.publish", "post.unpublish"]);
	});
});

describe("ordered sections", () => {
	const input = { title: text("Frontend"), summary: text("Interfaces."), skills: ["React"] };

	it("adds entries last, edits against a version, reorders and deletes", async () => {
		const first = await sections.skills.create(services(), input);
		const second = await sections.skills.create(services(), { ...input, title: text("Backend") });
		expect([first.sortOrder, second.sortOrder]).toEqual([0, 1]);
		const edited = await sections.skills.update(services(), {
			...input,
			skills: ["React", "Vite"],
			id: first.id,
			updatedAt: first.updatedAt,
		});
		const stale = await sections.skills
			.update(services(), { ...input, id: first.id, updatedAt: first.updatedAt })
			.catch((error: unknown) => error);
		expect(isStaleError(stale)).toBe(true);
		await sections.skills.reorder(services(), [second.id, first.id]);
		expect((await sections.skills.list(services())).map((item) => item.title.en)).toEqual(["Backend", "Frontend"]);
		expect(await sections.skills.remove(services(), [edited.id])).toEqual({ deleted: 1 });
		expect(await auditActions(first.id)).toEqual([
			"portfolio-section.create",
			"portfolio-section.update",
			"portfolio-section.delete",
		]);
	});

	it("stores an empty end as the current position", async () => {
		const entry = await sections.experience.create(services(), {
			company: "Everest Labs",
			role: text("CTO"),
			start: "2021-04",
			end: "",
			location: text("Kathmandu"),
			summary: text("Led engineering."),
		});
		expect(entry.end).toBe("");
		const [row] = await testDb.db.select().from(schema.portfolioExperience);
		expect(row?.end).toBeNull();
	});
});

describe("profile", () => {
	const seed = () =>
		seedPortfolio(async (sql, params) => {
			const result = await testDb.client.query<Record<string, unknown>>(sql, params);
			return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
		});

	it("is NOT_FOUND before the seed, then saves against its version", async () => {
		await expect(profile.get(services())).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(await seed()).toEqual({ seeded: true });
		expect(await seed()).toEqual({ seeded: false });
		const current = await profile.get(services());
		const { id, updatedAt, portrait: _p, resume: _r, ogImage: _o, ...fields } = current;
		const saved = await profile.update(services(), {
			...fields,
			email: "owner@example.com",
			portraitId: null,
			resumeId: null,
			ogImageId: null,
			id,
			updatedAt,
		});
		expect(saved.email).toBe("owner@example.com");
		const stale = await profile
			.update(services(), { ...fields, portraitId: null, resumeId: null, ogImageId: null, id, updatedAt })
			.catch((error: unknown) => error);
		expect(isStaleError(stale)).toBe(true);
		expect(await auditActions("profile")).toEqual(["profile.update"]);
	});
});

describe("the contact form and the inbox", () => {
	const contact = { name: "Sita", email: "sita@example.com", message: "Namaste!", locale: "ne" as const };
	const client = (send = vi.fn(async () => ({}))) => ({ ipHash: "hash-1", verifyCaptcha: null, send });
	const seed = () =>
		seedPortfolio(async (sql, params) => {
			const result = await testDb.client.query<Record<string, unknown>>(sql, params);
			return { rows: result.rows, rowCount: result.affectedRows ?? 0 };
		});

	it("saves the message, emails the owner, and limits a sender to three per ten minutes", async () => {
		await seed();
		const send = vi.fn(async () => ({}));
		for (let index = 0; index < 3; index++) {
			await expect(messages.submitContact(services(), contact, client(send))).resolves.toEqual({ sent: true });
		}
		await expect(messages.submitContact(services(), contact, client(send))).rejects.toMatchObject({
			code: "RATE_LIMITED",
		});
		expect(send).toHaveBeenCalledTimes(3);
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ to: "hello@example.com", template: "contact-message", locale: "en" }),
		);
		const page = await messages.list(services(), { q: "", state: "inbox", sort: "-received", page: 1, pageSize: 20 });
		expect(page.total).toBe(3);
		expect(page.items[0]).toMatchObject({ name: "Sita", locale: "ne", readAt: null });
	});

	it("pretends to send a honeypot submission, saves nothing; a failed email still keeps the message", async () => {
		await messages.submitContact(services(), { ...contact, website: "spam.example" }, client());
		expect(await testDb.db.select().from(schema.portfolioContactMessage)).toEqual([]);
		await seed();
		const failing = vi.fn(async () => {
			throw new Error("resend down");
		});
		await expect(messages.submitContact(services(), contact, client(failing))).resolves.toEqual({ sent: true });
		expect(await testDb.db.select().from(schema.portfolioContactMessage)).toHaveLength(1);
	});

	it("refuses a failed captcha", async () => {
		await expect(
			messages.submitContact(services(), contact, { ...client(), verifyCaptcha: async () => false }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("marks read, archives (audited) and deletes", async () => {
		await messages.submitContact(services(), contact, client());
		const [row] = await testDb.db.select().from(schema.portfolioContactMessage);
		if (!row) throw new Error("no message");
		expect(await messages.setState(services(), { ids: [row.id], set: "read" })).toEqual({ changed: 1 });
		expect(await messages.setState(services(), { ids: [row.id], set: "read" })).toEqual({ changed: 0 });
		await messages.setState(services(), { ids: [row.id], set: "archived" });
		const inbox = await messages.list(services(), { q: "", state: "inbox", sort: "-received", page: 1, pageSize: 20 });
		expect(inbox.total).toBe(0);
		expect(await messages.remove(services(), [row.id])).toEqual({ deleted: 1 });
		expect(await auditActions(row.id)).toEqual(["message.archive", "message.delete"]);
	});
});

describe("media library", () => {
	const list = (usage: "all" | "used" | "unused" = "all") =>
		media.list(services(), { q: "", kind: "all", usage, sort: "-uploaded", page: 1, pageSize: 24 });

	it("lists library items with where they are used, and filters by use", async () => {
		const used = await libraryImage();
		const unused = await libraryImage();
		await projects.create(services(), project({ coverId: used.id }));
		const page = await list();
		expect(page.items.map((item) => item.id).sort()).toEqual([used.id, unused.id].sort());
		expect(page.items.find((item) => item.id === used.id)?.usage).toEqual([
			{ type: "project", id: expect.any(String), label: "Ledgerline" },
		]);
		expect((await list("unused")).items.map((item) => item.id)).toEqual([unused.id]);
		expect((await list("used")).items.map((item) => item.id)).toEqual([used.id]);
	});

	it("describes an item in both languages (audited)", async () => {
		const image = await libraryImage();
		const saved = await media.setAlt(services(), { id: image.id, alt: text("A mountain", "एउटा हिमाल") });
		expect(saved.image.alt).toEqual({ en: "A mountain", ne: "एउटा हिमाल" });
		expect(await auditActions(image.id)).toEqual(["media.update"]);
	});

	it("deletes only what nothing uses, and changes nothing when one is used", async () => {
		const used = await libraryImage();
		const unused = await libraryImage();
		await posts.create(services(), post({ coverId: used.id }));
		await expect(media.remove(services(), [unused.id, used.id])).rejects.toMatchObject({ code: "CONFLICT" });
		expect((await list()).total).toBe(2);
		expect(await media.remove(services(), [unused.id])).toEqual({ deleted: 1 });
		expect(cloud.destroyed).toHaveLength(1);
		expect((await list()).items.map((item) => item.id)).toEqual([used.id]);
	});

	it("is empty without Cloudinary", async () => {
		await expect(
			media.list(
				{ db: testDb.db, imageStore: null },
				{ q: "", kind: "all", usage: "all", sort: "-uploaded", page: 1, pageSize: 24 },
			),
		).resolves.toMatchObject({ items: [], total: 0 });
	});
});

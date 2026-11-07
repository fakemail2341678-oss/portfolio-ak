import type { Dashboard } from "../../src/features/admin/dashboard";
import type { ImageAsset } from "../../src/features/attachments/schema";
import type { AuditEventItem } from "../../src/features/audit/schema";
import { ALL_PERMISSIONS } from "../../src/features/rbac/permissions";
import type { RoleSummary, UserListItem } from "../../src/features/rbac/schema";
import type { PublicTestCrudCard, TestCrudDetail, TestCrudListItem } from "../../src/features/test-crud/schema";
import type { SafeHtml } from "../../src/lib/safe-html";
import type { Session } from "../../src/lib/session";

/** Fixed sample data for stories (stable values keep screenshots and a11y runs deterministic). */
export const sampleAdmin: Session = {
	user: { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin", twoFactorEnabled: false },
	permissions: [...ALL_PERMISSIONS],
};
export const sampleUser: Session = {
	user: { id: "user-1", email: "sita@example.com", name: "Sita", role: "user", twoFactorEnabled: false },
	permissions: [],
};
/** A custom "Editor" role: Test CRUD read/create/update only. */
export const sampleEditor: Session = {
	user: { id: "editor-1", email: "editor@example.com", name: "Gita", role: "user", twoFactorEnabled: false },
	permissions: ["test-crud:read", "test-crud:create", "test-crud:update"],
};

export const sampleImage = "/favicon.svg";

/** A local stand-in for a Cloudinary image (stories never hit the network). */
export const sampleImageAsset: ImageAsset = {
	id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0aaa",
	alt: { en: "A plate of steamed momo", ne: "भापमा पकाएको मःमको थाल" },
	format: "png",
	url: sampleImage,
	width: 1600,
	height: 900,
	full: { src: sampleImage, srcSet: `${sampleImage} 1600w` },
	cover: { src: sampleImage, srcSet: `${sampleImage} 1600w` },
	thumb: sampleImage,
	og: sampleImage,
};

export const sampleItems: TestCrudListItem[] = [
	{
		id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0001",
		slug: "momo-kitchen",
		title: "Momo Kitchen",
		status: "published",
		price: 1250.5,
		tags: ["food", "nepal"],
		image: sampleImageAsset,
		publishedAt: "2026-09-01T08:00:00.000Z",
		updatedAt: "2026-09-20T10:30:00.000Z",
	},
	{
		id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0002",
		slug: "himalayan-tea",
		title: "Himalayan Tea",
		status: "draft",
		price: 450,
		tags: ["drink"],
		image: null,
		publishedAt: null,
		updatedAt: "2026-09-18T07:15:00.000Z",
	},
	{
		id: "6f1c0a52-0b6c-4c43-9a55-1f4a6f0d0003",
		slug: "dhaka-topi",
		title: "Dhaka Topi",
		status: "published",
		price: 1800,
		tags: [],
		image: null,
		publishedAt: "2026-08-10T12:00:00.000Z",
		updatedAt: "2026-09-02T09:45:00.000Z",
	},
];

const [first] = sampleItems;
export const sampleDetail: TestCrudDetail = {
	...(first as TestCrudListItem),
	images: [sampleImageAsset],
	summary: "Hand-made dumplings from Kathmandu.",
	body: "<h2>Menu</h2><p>Steamed <strong>momo</strong> with tomato achar.</p>",
	phone: "+9779812345678",
	createdAt: "2026-08-30T08:00:00.000Z",
};

export const samplePublicCard: PublicTestCrudCard = {
	slug: "momo-kitchen",
	title: "Momo Kitchen",
	summary: "Hand-made dumplings from Kathmandu, steamed or fried, served with tomato achar.",
	price: 1250.5,
	tags: ["food", "nepal"],
	image: sampleImageAsset,
	publishedAt: "2026-09-01T08:00:00.000Z",
};

export const sampleBody = sampleDetail.body as SafeHtml;

export const sampleRoles: RoleSummary[] = [
	{
		id: "role-admin",
		key: "admin",
		name: "Admin",
		description: "",
		system: true,
		permissions: [...ALL_PERMISSIONS],
		userCount: 1,
		updatedAt: "2026-09-01T08:00:00.000Z",
	},
	{
		id: "role-user",
		key: "user",
		name: "User",
		description: "",
		system: true,
		permissions: [],
		userCount: 3,
		updatedAt: "2026-09-01T08:00:00.000Z",
	},
	{
		id: "role-editor",
		key: "editor",
		name: "Editor",
		description: "Writes and edits items.",
		system: false,
		permissions: ["test-crud:read", "test-crud:create", "test-crud:update"],
		userCount: 1,
		updatedAt: "2026-09-01T08:00:00.000Z",
	},
];

/** A plain user (no extra roles), banned. */
export const sampleBannedUser: UserListItem = {
	id: "user-1",
	name: "Sita",
	email: "sita@example.com",
	isAdmin: false,
	roles: [],
	banned: true,
	createdAt: "2026-09-20T08:00:00.000Z",
	updatedAt: "2026-09-21T08:00:00.000Z",
};

export const sampleUsers: UserListItem[] = [
	{
		id: "admin-1",
		name: "Admin",
		email: "admin@example.com",
		isAdmin: true,
		roles: [],
		banned: false,
		createdAt: "2026-09-01T08:00:00.000Z",
		updatedAt: "2026-09-01T08:00:00.000Z",
	},
	{
		id: "editor-1",
		name: "Gita",
		email: "gita@example.com",
		isAdmin: false,
		roles: [{ id: "role-editor", key: "editor", name: "Editor" }],
		banned: false,
		createdAt: "2026-09-10T08:00:00.000Z",
		updatedAt: "2026-09-12T08:00:00.000Z",
	},
	sampleBannedUser,
];

/** Audit rows: a permission change, an impersonated delete, and a row whose actor was deleted. */
export const sampleAuditEvents: AuditEventItem[] = [
	{
		id: "audit-1",
		action: "role.permissions",
		actor: { id: "admin-1", name: "Admin", email: "admin@example.com" },
		impersonator: null,
		target: { type: "role", id: "role-editor", label: "Editor" },
		before: { permissions: ["test-crud:read"] },
		after: { permissions: ["test-crud:read", "test-crud:update"] },
		requestId: "5b0f6c1e-8a4d-4f7e-9d3a-2c1b0a9f8e7d",
		ip: "203.0.113.7",
		createdAt: "2026-10-01T09:30:00.000Z",
	},
	{
		id: "audit-2",
		action: "test-crud.delete",
		actor: { id: "editor-1", name: "Gita", email: "gita@example.com" },
		impersonator: "admin@example.com",
		target: { type: "test-crud", id: "item-1", label: "Momo masterclass" },
		before: { title: "Momo masterclass", status: "draft" },
		after: null,
		requestId: "0d9e8f7a-6b5c-4d3e-8f2a-1b0c9d8e7f6a",
		ip: "198.51.100.4",
		createdAt: "2026-10-01T09:00:00.000Z",
	},
	{
		id: "audit-3",
		action: "user.ban",
		actor: { id: null, name: "", email: "former@example.com" },
		impersonator: null,
		target: { type: "user", id: "user-1", label: "sita@example.com" },
		before: { banned: false },
		after: { banned: true },
		requestId: null,
		ip: null,
		createdAt: "2026-09-30T16:45:00.000Z",
	},
];

/** The admin dashboard of an admin who may read everything. */
export const sampleDashboard: Dashboard = {
	testCrud: { total: 30, published: 20, draft: 10, recent: 4 },
	users: { total: 128, banned: 2, recent: 9 },
	roles: { total: 4 },
	activity: sampleAuditEvents,
	generatedAt: "2026-10-01T09:00:00.000Z",
};

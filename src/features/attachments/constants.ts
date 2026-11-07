import type { Permission } from "@/features/rbac/permissions";

/**
 * Upload rules shared by the browser (early checks, the file picker's `accept`)
 * and the server (signed `allowed_formats`, the size check after upload).
 */
export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "avif", "gif"] as const;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

type UploadRule = {
	formats: ReadonlyArray<string>;
	mimeTypes: ReadonlyArray<string>;
	/**
	 * Uploads go straight into a library under this entity type and stay there
	 * (no pending state, no cleanup after a day); items reference them by id.
	 */
	library?: string;
	/** Needed on top of attachments:upload. */
	permission?: Permission;
};

const IMAGES: UploadRule = { formats: IMAGE_FORMATS, mimeTypes: IMAGE_MIME_TYPES };
// portfolio:start
/** PDFs (a résumé). Cloudinary keeps them as image assets, so they get previews like images. */
const DOCUMENT_FORMATS = ["pdf"] as const;
const DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

/** The media library (/admin/media, decision 0177): images and PDFs. */
const MEDIA: UploadRule = {
	formats: [...IMAGE_FORMATS, ...DOCUMENT_FORMATS],
	mimeTypes: [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES],
	library: "media",
	permission: "media:write",
};
// portfolio:end

/** Where an upload is going: becomes part of its Cloudinary public_id ("portfolio/test-crud/<uuid>"), and its rules. */
export const UPLOAD_RULES = {
	"test-crud": IMAGES,
	examples: IMAGES,
	media: MEDIA, // @portfolio
	// apps:start
	/** A note's images (/apps/notes, decision 0190): any app user, guests included; no permission. */
	notes: IMAGES,
	// apps:end
	// taskline:start
	/** A Taskline task's or comment's files (Task 50, decision 0214): images and PDFs; any Taskline user, guests included. */
	taskline: {
		formats: [...IMAGE_FORMATS, "pdf"],
		mimeTypes: [...IMAGE_MIME_TYPES, "application/pdf"],
	},
	// taskline:end
} as const satisfies Record<string, UploadRule>;
export type UploadScope = keyof typeof UPLOAD_RULES;
export const UPLOAD_SCOPES = Object.keys(UPLOAD_RULES) as [UploadScope, ...UploadScope[]];

/** The rules of `scope` (typed loosely: not every scope sets every option). */
export const uploadRule = (scope: UploadScope): UploadRule => UPLOAD_RULES[scope];

/** Images per Test CRUD item. */
export const TEST_CRUD_MAX_IMAGES = 8;

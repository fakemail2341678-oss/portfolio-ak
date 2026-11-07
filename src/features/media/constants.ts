// No imports: shared by the server, the browser and the attachments rules.

/** The attachments' entity type for media-library items (they belong to the library, not to one record). */
export const MEDIA_ENTITY = "media";

/** What a library item is: an image, or a document (a PDF). */
export const MEDIA_KINDS = ["all", "image", "document"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Whether anything uses it: only unused items can be deleted. */
export const MEDIA_USAGE_FILTERS = ["all", "used", "unused"] as const;
export type MediaUsageFilter = (typeof MEDIA_USAGE_FILTERS)[number];

/** What can use a library item (the usage check, and the "Used by" list). */
export const MEDIA_USERS = ["profile", "project", "post"] as const;

export const MEDIA_PAGE_SIZE = 24;

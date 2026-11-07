import type { FieldImage } from "@/features/attachments/components/image-gallery-field";
import type { ImageAsset } from "@/features/attachments/schema";
import type { SafeHtml } from "@/lib/safe-html";

/** Notes' limits per user (decision 0190): a guest's notes count the same. */
export const NOTES_QUOTAS = { notes: 500, imagesPerNote: 8, uploadsPerHour: 30 } as const;

/** One note in the list: no body, an excerpt of its text. */
export type NoteSummary = {
	id: string;
	title: string;
	excerpt: string;
	tags: string[];
	pinned: boolean;
	archived: boolean;
	shared: boolean;
	/** The first image, for the card. */
	cover: ImageAsset | null;
	updatedAt: string;
};

export type NoteList = { notes: NoteSummary[]; now: string };

/** A note in its editor. */
export type Note = {
	id: string;
	title: string;
	body: SafeHtml;
	tags: string[];
	pinned: boolean;
	archived: boolean;
	/** The token of the public page, or null when the note isn't shared. */
	shareToken: string | null;
	images: FieldImage[];
	updatedAt: string;
};

/** What the public page of a shared note shows (read only; no owner, no tags). */
export type SharedNote = {
	title: string;
	body: SafeHtml;
	images: ImageAsset[];
	updatedAt: string;
};

/** A search's matches, best first (ids of the user's notes). */
export type NoteSearchResult = { ids: string[] };

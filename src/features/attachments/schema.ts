import { z } from "zod";
import type { Localized } from "@/lib/i18n/localized";
import { localizedText } from "@/lib/validation";
import { UPLOAD_SCOPES } from "./constants";

/** A responsive image source: `src` for old browsers, `srcSet` for the rest. */
export type ImageSource = { src: string; srcSet: string };

/**
 * An image as the browser receives it: the delivery URLs are built on the server
 * (Cloudinary transformations: f_auto, q_auto and sized variants), so the client
 * needs no Cloudinary configuration.
 */
export type ImageAsset = {
	id: string;
	/** In both languages (decision 0177); CloudImage shows the reader's, English when there is no Nepali. */
	alt: Localized;
	/** "jpg", "png", "pdf"…: a PDF is shown by a preview of its first page. */
	format: string;
	/** The original file, untransformed (a PDF to download). */
	url: string;
	/** Intrinsic size, for width/height attributes (no layout shift). */
	width: number;
	height: number;
	/** The whole image, limited to its own size. */
	full: ImageSource;
	/** Cropped to 16:9 around the subject (cards, the detail page's hero). */
	cover: ImageSource;
	/** A small square (admin lists, the editor). */
	thumb: string;
	/** 1200x630 JPEG cropped around the subject, for og:image and twitter:image. */
	og: string;
};

export const ALT_MAX = 200;

/** One image in a form: which attachment, in which order (array order), with its alt text. */
export const attachmentRefSchema = z.object({ id: z.uuid(), alt: localizedText({ max: ALT_MAX, optional: true }) });
export type AttachmentRef = z.output<typeof attachmentRefSchema>;

export const uploadScopeSchema = z.object({ scope: z.enum(UPLOAD_SCOPES) });
export const confirmUploadSchema = uploadScopeSchema.extend({ publicId: z.string().min(1).max(255) });
export const attachmentIdSchema = z.object({ id: z.uuid() });

/** What the browser needs to upload directly to Cloudinary (see src/server/attachments/cloudinary.ts). */
export type UploadTicket = {
	url: string;
	fields: Record<string, string>;
	publicId: string;
	maxBytes: number;
	formats: ReadonlyArray<string>;
};

# Attachments (images on Cloudinary)

How images are uploaded, stored, shown and deleted, and how to add images to a new feature. Decisions 0098–0099 and 0177 explain the choices.

## Setup

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` (all three, server-only). Optional settings:

- `CLOUDINARY_FOLDER`: the public_id prefix (default `portfolio`).
- `CRON_SECRET`: turns on the daily cleanup job (`vercel.json` schedules `/api/cron/attachments`; Vercel Cron sends the bearer token).

Without the Cloudinary variables, uploads are refused with a clear message and items show placeholders. The CSP allows Cloudinary's hosts only when it's configured.

Part 1 stored images in Postgres; that table and its import script are gone (0160). A database that may still hold such images needs `attachments:import-legacy` from the commit before 0160 first.

## The flow

1. **Sign:** the browser calls `signImageUpload({ scope })` (needs `attachments:upload`). The server picks the `public_id` and signs it together with the allowed formats.
2. **Upload:** the browser POSTs the file straight to Cloudinary (`uploadImage` in `features/attachments/upload.ts`: progress, cancel).
   - An area whose users hold no `attachments:upload` (the showcase apps' guests) passes its own `UploadTransport` to `uploadImage` and `ImageGalleryField` (`transport`): its sign, confirm and discard functions behind its own guard, and `permission: null`. Notes does (`features/apps/notes/uploads.ts`, decision 0190). <!-- @apps -->
3. **Confirm:** `confirmImageUpload` reads the asset back with the Admin API, checks its format and size against the scope's rules, and records a *pending* attachment owned by the uploader (a library scope records it in its library instead). It returns an `ImageAsset`.
4. **Save:** the item's own save links the pending uploads (`syncEntityAttachments`) in order, with their alt text, in the item's transaction. Images the item no longer lists are marked removed and their assets deleted.
5. **Clean up:** removed rows and day-old pending uploads are deleted by `/api/cron/attachments` (and right away, when Cloudinary answers).

## Showing images

The server builds the URLs. An `ImageAsset` has `full`, `cover` (16:9) and `thumb` (`full` and `cover` with `src`/`srcSet`), all using `f_auto,q_auto`, plus `og`, a 1200×630 JPEG for social previews, `url` (the original file) and `format`. Its `alt` is `{ en, ne }` (0177). Render it with `CloudImage`:

```tsx
<div className="relative aspect-[16/9] overflow-hidden">
	<CloudImage image={item.image} variant="cover" sizes="(min-width: 1024px) 352px, 100vw"
		loading="lazy" className="absolute inset-0 size-full object-cover" />
</div>
```

- **Layout:** put "cover" images in a 16:9 box; width and height attributes are always set (no layout shift).
- **`sizes`:** pass it to match the displayed width.
- **Main image:** use `loading="eager" fetchPriority="high"` for the largest image on a page.
- **Alt text:** `CloudImage` uses the image's own in the page's language (English, marked `lang="en"`, when there is no Nepali); decorative images (a card whose link text names it) get `alt=""`.

## Adding images to a feature ("projects")

1. **Scope:** add `projects: IMAGES` to `UPLOAD_RULES` (`features/attachments/constants.ts`); a rule can also take other formats, need a permission, or put uploads straight into a library.
2. **Schema:** `images: z.array(attachmentRefSchema).max(N)` in the input. The form uses `{ id, alt, preview }` items, `alt` being `{ en, ne }` (see `formImageSchema` and `toTestCrudInput` in Test CRUD).
3. **Repository:**
   - Inside create and update transactions, call `syncEntityAttachments(tx, { entityType: "projects", entityId, ownerId }, input.images)`.
   - On delete, call `removeForEntities(tx, "projects", ids)`.
   - Read images with `listForEntities` and `toImageAsset(store, row)`.
   - Pass the store (`imageStore`) through from the server function.
4. **Service:** after update or delete, `purge(db, store, removed)`.
5. **Form:** `<form.AppField name="images">{() => <ImageGalleryField label=… scope="projects" max={N} onBusyChange=… />}</form.AppField>`, with an `onSubmit` validator that refuses while uploads are running (see `TestCrudForm`).
6. **Pages:** `CloudImage` as above. For `seo({ image })` use the `og` URL (1200×630 JPEG): `{ url: image.og, width: 1200, height: 630, alt }` (see [seo.md](seo.md)).

## The media library <!-- @portfolio -->

The portfolio's images and PDFs live in a library at `/admin/media` (0177): the `media` scope (PDFs too; `media:write` on top of `attachments:upload`) records uploads straight into it (entity type `media`, never pending). Records reference library items by id (foreign keys `on delete restrict`, a gallery as `uuid[]`), lock them while saving, and an item is deleted only when nothing uses it. Forms pick with `MediaField`; `ImageGalleryField` stays for images a record owns. See [portfolio.md](portfolio.md). <!-- @portfolio -->

## Rules (server-side)

- Uploads need `attachments:upload`. Linking happens under the item's own permission (e.g. `test-crud:update`).
- Only the uploader's own pending uploads, or images already on that item, can be linked; anything else is a `BAD_REQUEST` with a clear message.
- Allowed formats: JPEG, PNG, WebP, AVIF, GIF, per scope (`UPLOAD_RULES`; Cloudinary enforces the signed `allowed_formats`). Maximum size: 10 MB, checked after upload; oversized assets are deleted.

## Testing

- **Server:** `tests/utils/fake-cloudinary.ts` runs the real client over a fake `fetch` that behaves like Cloudinary's API: signed destroy, Admin API with Basic auth, and `put()` standing in for the browser's upload. See `tests/server/attachments.test.ts` (flow, rules, cleanup, the documented signature examples) and `test-crud-*.test.ts`.
- **Editor:** `tests/components/attachments/image-gallery-field.test.tsx` stubs `XMLHttpRequest`: upload with progress, cancel, discard, concurrent uploads, permissions.
- **Stories:** `features/attachments/components/attachments.stories.tsx`.

## Live example

- **Upload in a form:** `/dev/examples/attachments` (`src/routes/dev/examples/attachments.tsx`), with `pnpm dev`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Images are Cloudinary attachments** (0098): upload straight from the browser with a server signature, verify on the server, link in the item's save. Render with `CloudImage` (server-built URLs). Never stream files through a server function.

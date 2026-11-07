import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { HubPageData, HubRailData } from "@/features/parda/home/types";
import { curatedParamSchema, idParamSchema, PARDA_HUBS, PARDA_TYPES, titleParamsSchema } from "@/features/parda/search";
import type {
	CollectionPageData,
	CreditsPageData,
	CuratedPageData,
	PersonPageData,
	SeasonData,
	SurpriseTarget,
	TitlePageData,
} from "@/features/parda/title/types";
import { zodInput } from "@/functions/_lib/validator";
import type { Localized } from "@/lib/i18n/localized";
import { withPardaCatalog } from "@/middleware/parda";
import { locales } from "@/paraglide/runtime";
import { catalogScope, pardaBanner } from "@/server/parda/catalog/context";
import { hubPage, hubRail } from "@/server/parda/catalog/hubs";
import { collectionPage, curatedPage, personPage, surprise } from "@/server/parda/catalog/people";
import { creditsPage, seasonPage, titlePage } from "@/server/parda/catalog/title-page";

/**
 * Parda's catalogue reads (PLAN 12.5, decision 0234): open to everyone, each starting
 * with `withPardaCatalog`. Takedowns and the cache epoch apply inside
 * src/server/parda/catalog/service.ts, the only way in. The locale is an input, so a
 * client-side navigation reads the language of the page it goes to.
 */

const locale = z.enum(locales);
const page = z.enum(["home", ...PARDA_HUBS]);
const hubInput = z.strictObject({ page, locale });
const railInput = z.strictObject({
	page,
	rail: z.string().regex(/^[a-z0-9-]{1,40}$/),
	locale,
});
const titleInput = titleParamsSchema.extend({ locale }).strict();
const seasonInput = z.strictObject({
	id: titleParamsSchema.shape.id,
	season: z.number().int().min(0).max(9_999).optional(),
	page: z.number().int().min(1).max(999).optional(),
	locale,
});
const idInput = idParamSchema.extend({ locale }).strict();
const curatedInput = curatedParamSchema.extend({ locale }).strict();
const surpriseInput = z.strictObject({ from: page, locale });

export const getPardaHub = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(hubInput))
	.handler(
		({ data, context }): Promise<HubPageData> =>
			context.catalog
				? hubPage(context.catalog.services, catalogScope(context.catalog, data.locale), data.page)
				: Promise.resolve({ configured: false }),
	);

export const getPardaRail = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(railInput))
	.handler(
		({ data, context }): Promise<HubRailData> =>
			context.catalog
				? hubRail(context.catalog.services, catalogScope(context.catalog, data.locale), data.page, data.rail)
				: Promise.resolve({ imageBase: "", titles: null }),
	);

export const getPardaTitle = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(titleInput))
	.handler(
		({ data, context }): Promise<TitlePageData> =>
			context.catalog
				? titlePage(
						context.catalog.services,
						catalogScope(context.catalog, data.locale),
						PARDA_TYPES[data.type],
						data.id,
					)
				: Promise.resolve({ configured: false }),
	);

export const getPardaSeason = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(seasonInput))
	.handler(
		({ data, context }): Promise<SeasonData> =>
			context.catalog
				? seasonPage(context.catalog.services, catalogScope(context.catalog, data.locale), data.id, data)
				: Promise.resolve({ configured: false }),
	);

export const getPardaCredits = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(titleInput))
	.handler(
		({ data, context }): Promise<CreditsPageData> =>
			context.catalog
				? creditsPage(
						context.catalog.services,
						catalogScope(context.catalog, data.locale),
						PARDA_TYPES[data.type],
						data.id,
					)
				: Promise.resolve({ configured: false }),
	);

export const getPardaPerson = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(idInput))
	.handler(
		({ data, context }): Promise<PersonPageData> =>
			context.catalog
				? personPage(context.catalog.services, catalogScope(context.catalog, data.locale), data.id)
				: Promise.resolve({ configured: false }),
	);

export const getPardaCollection = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(idInput))
	.handler(
		({ data, context }): Promise<CollectionPageData> =>
			context.catalog
				? collectionPage(context.catalog.services, catalogScope(context.catalog, data.locale), data.id)
				: Promise.resolve({ configured: false }),
	);

/** A collection the admin put together, at /app/parda/c/{slug} (decision 0242). */
export const getPardaCurated = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(curatedInput))
	.handler(
		({ data, context }): Promise<CuratedPageData> =>
			context.catalog
				? curatedPage(context.catalog.services, catalogScope(context.catalog, data.locale), data.slug)
				: Promise.resolve({ configured: false }),
	);

/** A random title for "Surprise me", from the page's good lists; null without a catalogue or a title. */
export const getPardaSurprise = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.validator(zodInput(surpriseInput))
	.handler(
		({ data, context }): Promise<SurpriseTarget> =>
			context.catalog
				? surprise(context.catalog.services, catalogScope(context.catalog, data.locale), data.from)
				: Promise.resolve(null),
	);

/**
 * The admin's notice under Parda's top mask (decision 0237), null when there's none. From
 * the settings the controls cache, so it needs no catalogue: it shows without TMDB too.
 */
export const getPardaBanner = createServerFn({ method: "GET" })
	.middleware([withPardaCatalog])
	.handler((): Promise<Localized | null> => pardaBanner());

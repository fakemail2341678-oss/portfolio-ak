import { beforeAll, describe, expect, it } from "vitest";
import { LOCALE_HEADER } from "@/lib/i18n/locale-header";
import {
	defineCustomServerStrategy,
	deLocalizeHref,
	extractLocaleFromRequestAsync,
	localizeHref,
	toLocale,
} from "@/paraglide/runtime";

const origin = "https://example.com";

beforeAll(() => {
	// Same definition as src/server.ts. The middleware resolves with the async extractor,
	// which is the one that runs custom server strategies.
	defineCustomServerStrategy("custom-header", {
		getLocale: (request) => toLocale(request?.headers.get(LOCALE_HEADER) ?? undefined),
	});
});

describe("locale routing", () => {
	it("keeps English unprefixed and puts Nepali under /ne", () => {
		expect(localizeHref("/", { locale: "en" })).toBe("/");
		expect(localizeHref("/", { locale: "ne" })).toBe("/ne/");
		expect(localizeHref("/health", { locale: "ne" })).toBe("/ne/health");
		expect(deLocalizeHref("/ne/health")).toBe("/health");
	});

	it("preserves search params and hash when switching locale", () => {
		expect(localizeHref("/health?page=2&q=a%20b#top", { locale: "ne" })).toBe("/ne/health?page=2&q=a%20b#top");
		expect(localizeHref(deLocalizeHref("/ne/health?page=2#top"), { locale: "en" })).toBe("/health?page=2#top");
	});

	it("resolves page locale from the URL only", async () => {
		expect(await extractLocaleFromRequestAsync(new Request(`${origin}/`))).toBe("en");
		expect(await extractLocaleFromRequestAsync(new Request(`${origin}/ne/health`))).toBe("ne");
		// The URL is authoritative: Accept-Language does not change the locale of "/".
		const english = new Request(`${origin}/health`, { headers: { "accept-language": "ne-NP,ne;q=0.9" } });
		expect(await extractLocaleFromRequestAsync(english)).toBe("en");
	});

	it("resolves server function locale from the header, ignoring invalid values", async () => {
		const rpc = (locale?: string) =>
			new Request(`${origin}/_serverFn/abc123`, {
				method: "POST",
				headers: locale ? { [LOCALE_HEADER]: locale } : {},
			});
		expect(await extractLocaleFromRequestAsync(rpc("ne"))).toBe("ne");
		expect(await extractLocaleFromRequestAsync(rpc("en"))).toBe("en");
		expect(await extractLocaleFromRequestAsync(rpc("fr"))).toBe("en");
		expect(await extractLocaleFromRequestAsync(rpc())).toBe("en");
	});
});

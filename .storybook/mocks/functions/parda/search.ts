import { fn } from "storybook/test";
import type { DiscoverPageData, SearchPageData, SearchSuggestData } from "../../../../src/features/parda/search/types";

// Stand-ins for src/functions/parda/search.ts: the catalogue isn't configured in the workshop.
export const getPardaSearch = fn(async (): Promise<SearchPageData> => ({ configured: false })).mockName(
	"getPardaSearch",
);
export const getPardaSuggest = fn(async (): Promise<SearchSuggestData> => ({ imageBase: "", hits: [] })).mockName(
	"getPardaSuggest",
);
export const notePardaSearch = fn(async (): Promise<void> => undefined).mockName("notePardaSearch");
export const getPardaDiscover = fn(async (): Promise<DiscoverPageData> => ({ configured: false })).mockName(
	"getPardaDiscover",
);

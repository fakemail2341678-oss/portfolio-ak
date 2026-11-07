import { fn } from "storybook/test";
import type {
	ContinueRailData,
	ForYouData,
	HistoryData,
	LibraryFavouritesData,
	PardaViewerData,
	SavedState,
	TitleProgressData,
} from "../../../../src/features/parda/library/types";

// Stand-ins for src/functions/parda/library.ts: nobody is signed in to the workshop, so nothing is saved.
export const getPardaViewer = fn(
	async (): Promise<PardaViewerData> => ({
		profile: { id: "00000000-0000-4000-8000-000000000000", name: "Me", avatar: "sun", kids: false, autoplay: true },
		profiles: 1,
		isGuest: false,
		guestDeletesAt: null,
	}),
).mockName("getPardaViewer");
export const getPardaContinue = fn(async (): Promise<ContinueRailData> => ({ imageBase: "", items: [] })).mockName(
	"getPardaContinue",
);
export const getPardaTitleProgress = fn(
	async (): Promise<TitleProgressData> => ({ cta: null, share: null, episodes: [] }),
).mockName("getPardaTitleProgress");
export const savePardaProgress = fn(async () => ({ saved: true })).mockName("savePardaProgress");
export const markPardaWatched = fn(async () => ({ ok: true as const })).mockName("markPardaWatched");
export const removePardaContinue = fn(async () => ({ ok: true as const })).mockName("removePardaContinue");
export const rewatchPardaTitle = fn(async () => ({ ok: true as const })).mockName("rewatchPardaTitle");
export const importPardaProgress = fn(async () => ({ imported: 0 })).mockName("importPardaProgress");
export const getPardaSaved = fn(
	async (): Promise<SavedState> => ({ watchlist: [], favourite: [], people: [], likes: [], dislikes: [] }),
).mockName("getPardaSaved");
export const setPardaListed = fn(async () => ({ ok: true as const })).mockName("setPardaListed");
export const setPardaPersonFavourite = fn(async () => ({ ok: true as const })).mockName("setPardaPersonFavourite");
export const ratePardaTitle = fn(async () => ({ ok: true as const })).mockName("ratePardaTitle");
export const getPardaLibrary = fn(
	async (): Promise<LibraryFavouritesData> => ({
		imageBase: "",
		titles: [],
		page: 1,
		pageCount: 1,
		total: 0,
		people: [],
	}),
).mockName("getPardaLibrary");
export const getPardaHistory = fn(
	async (): Promise<HistoryData> => ({ imageBase: "", days: [], page: 1, hasMore: false }),
).mockName("getPardaHistory");
export const removePardaHistory = fn(async () => ({ ok: true as const })).mockName("removePardaHistory");
export const clearPardaHistory = fn(async () => ({ ok: true as const })).mockName("clearPardaHistory");
export const getPardaForYou = fn(
	async (): Promise<ForYouData> => ({ imageBase: "", because: null, people: null, episodes: null }),
).mockName("getPardaForYou");

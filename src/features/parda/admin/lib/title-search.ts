import { searchPardaTitles } from "@/functions/parda-admin/curation";

/** The title picker's search (forms that pick a title). */
export const searchTitleOptions = (q: string) => searchPardaTitles({ data: { q } });

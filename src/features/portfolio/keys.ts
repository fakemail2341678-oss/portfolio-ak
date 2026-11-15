import { getLocale } from "@/paraglide/runtime";

/** Keys are per language: the same slug reads differently in each. */
const scope = () => ["portfolio", getLocale()] as const;

export const portfolioKeys = {
	all: ["portfolio"] as const,
	profile: () => [...scope(), "profile"] as const,
	home: () => [...scope(), "home"] as const,
	work: () => [...scope(), "work"] as const,
	project: (slug: string, preview: boolean) => [...scope(), "project", slug, { preview }] as const,
	about: () => [...scope(), "about"] as const,
	journal: () => [...scope(), "journal"] as const,
	post: (slug: string, preview: boolean) => [...scope(), "post", slug, { preview }] as const,
};

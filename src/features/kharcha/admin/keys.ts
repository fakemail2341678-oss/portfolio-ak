const ROOT = ["kharcha-admin"] as const;

export const kharchaAdminKeys = {
	all: ROOT,
	overview: () => [...ROOT, "overview"] as const,
	settings: () => [...ROOT, "settings"] as const,
	senders: () => [...ROOT, "senders"] as const,
};

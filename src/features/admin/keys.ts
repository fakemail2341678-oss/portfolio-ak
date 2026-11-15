export const adminKeys = {
	all: ["admin"] as const,
	dashboard: () => [...adminKeys.all, "dashboard"] as const,
};

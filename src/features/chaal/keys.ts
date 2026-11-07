/** Chaal's reads, under one root so a write can refresh what it touched. */
const all = ["chaal"] as const;

export const chaalKeys = {
	all,
	status: () => [...all, "status"] as const,
	connection: () => [...all, "connection"] as const,
	preferences: () => [...all, "preferences"] as const,
	lab: () => [...all, "admin", "lab"] as const,
};

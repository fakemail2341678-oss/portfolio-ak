/**
 * A short, human label for a session's user agent ("Chrome", "Windows").
 * Order matters: Edge and Opera include "Chrome", and Chrome includes "Safari".
 */
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
	[/Edg\//, "Edge"],
	[/OPR\/|Opera/, "Opera"],
	[/Firefox\//, "Firefox"],
	[/Chrome\/|CriOS\//, "Chrome"],
	[/Safari\//, "Safari"],
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
	[/Android/, "Android"],
	[/iPhone|iPad|iPod/, "iOS"],
	[/Windows/, "Windows"],
	[/Mac OS X|Macintosh/, "macOS"],
	[/CrOS/, "ChromeOS"],
	[/Linux/, "Linux"],
];

const match = (value: string, table: ReadonlyArray<[RegExp, string]>) =>
	table.find(([pattern]) => pattern.test(value))?.[1];

export const describeUserAgent = (userAgent: string | null): { browser?: string; os?: string } => {
	if (!userAgent) return {};
	const browser = match(userAgent, BROWSERS);
	const os = match(userAgent, SYSTEMS);
	return { ...(browser ? { browser } : {}), ...(os ? { os } : {}) };
};

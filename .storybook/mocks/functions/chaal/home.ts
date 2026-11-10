import { fn } from "storybook/test";
import type { ChaalHome } from "../../../../src/features/chaal/home/curation";

// Stand-ins for src/functions/chaal/home.ts: an announcement, the ways in, and a few picks.
export const chaalHome: ChaalHome = {
	sections: ["announcement", "start", "broadcasts", "tournaments", "themes"],
	featured: {
		broadcasts: [
			{
				id: "b1",
				kind: "broadcast",
				ref: "wEuVhT9c",
				title: { en: "World Championship 2026", ne: "विश्व च्याम्पियनसिप २०२६" },
			},
		],
		tournaments: [
			{ id: "t1", kind: "arena", ref: "Ar3naW1n", title: { en: "Saturday blitz arena", ne: "" } },
			{ id: "t2", kind: "swiss", ref: "Sw1ssKtm", title: { en: "Kathmandu club Swiss", ne: "काठमाडौं क्लब स्विस" } },
		],
		studies: [],
		themes: [{ id: "p1", kind: "theme", ref: "fork", title: { en: "Forks", ne: "फोर्क" } }],
	},
	announcement: { en: "Club night moves to Friday this week.", ne: "यो हप्ता क्लबको साँझ शुक्रबार हुन्छ।" },
};

export const getChaalHome = fn(async (): Promise<ChaalHome> => chaalHome).mockName("getChaalHome");

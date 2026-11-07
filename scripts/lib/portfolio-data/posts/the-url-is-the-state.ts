import type { PostRecord } from "../types.ts";

export const theUrlIsTheState = {
	slug: "the-url-is-the-state",
	title: { en: "The URL is the state", ne: "URL नै स्टेट हो" },
	excerpt: {
		en: "Filters, sorting and pagination belong in the address bar. Your users will thank you, and so will your server.",
		ne: "फिल्टर, सर्टिङ र पेजिनेसन एड्रेस बारमै हुनुपर्छ। प्रयोगकर्ताले धन्यवाद दिनेछन्, सर्भरले पनि।",
	},
	publishedAt: "2026-03-11",
	tags: ["Architecture", "UX"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "If a user can't copy the address bar and send a colleague exactly what they see, the state of that page lives in the wrong place.",
				ne: "प्रयोगकर्ताले एड्रेस बार कपी गरेर आफूले देखेको कुरा जस्ताको तस्तै सहकर्मीलाई पठाउन सक्दैनन् भने, त्यो पेजको स्टेट गलत ठाउँमा छ।",
			},
		},
		{ kind: "heading", text: { en: "One contract, both sides", ne: "एउटै सम्झौता, दुवै तर्फ" } },
		{
			kind: "paragraph",
			text: {
				en: "I define search params once, as a schema, and use it in the router, the server function and the SQL builder. A bad value in the URL is quietly dropped instead of crashing the page.",
				ne: "म सर्च प्यारामिटर एक पटक स्किमाका रूपमा परिभाषित गर्छु, र त्यही राउटर, सर्भर फङ्सन र SQL बिल्डरमा प्रयोग गर्छु। URL मा गलत मान आए पेज क्र्यास हुनुको सट्टा चुपचाप हटाइन्छ।",
			},
		},
		{
			kind: "code",
			language: "ts",
			code: `export const searchSchema = z.object({
  q: z.string().catch(""),
  page: z.coerce.number().int().min(1).catch(1),
});`,
		},
		{
			kind: "list",
			items: [
				{ en: "Back and forward just work.", ne: "पछाडि र अगाडि जाने बटन सजिलै चल्छन्।" },
				{
					en: "Filters work before JavaScript loads, as plain links.",
					ne: "JavaScript लोड हुनुअघि नै फिल्टरहरू सादा लिङ्कका रूपमा चल्छन्।",
				},
				{ en: "The server renders exactly the right page.", ne: "सर्भरले ठ्याक्कै सही पेज रेन्डर गर्छ।" },
			],
		},
		{
			kind: "paragraph",
			text: {
				en: "Local state still has its place: an open menu, a half-typed comment. But anything a user might want to share, bookmark or come back to belongs in the URL.",
				ne: "लोकल स्टेटको पनि आफ्नै ठाउँ छ: खुला मेनु, आधा टाइप गरिएको कमेन्ट। तर प्रयोगकर्ताले सेयर, बुकमार्क वा फर्केर हेर्न चाहने जुनसुकै कुरा URL मै हुनुपर्छ।",
			},
		},
	],
} satisfies PostRecord;

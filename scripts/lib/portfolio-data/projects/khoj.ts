import type { ProjectRecord } from "../types.ts";

export const khoj = {
	slug: "khoj",
	title: "Khoj",
	client: { en: "Pustak Online", ne: "पुस्तक अनलाइन" },
	year: 2026,
	disciplines: ["ai", "backend", "product"],
	role: { en: "Engineering lead", ne: "इन्जिनियरिङ लिड" },
	duration: { en: "10 weeks", ne: "१० हप्ता" },
	summary: {
		en: "Semantic search for a bilingual bookstore that understands “a sad novel about Karnali” in either language.",
		ne: "“कर्णालीबारे दुःखद उपन्यास” दुवै भाषामा बुझ्ने द्विभाषी पुस्तक पसलको सिमान्टिक खोज।",
	},
	stack: ["PostgreSQL", "pgvector", "TypeScript", "Claude API", "Hono", "Grafana"],
	featured: true,
	cover: { motif: "signal", glyph: "खो" },
	links: [{ label: { en: "Search the catalogue", ne: "क्याटलग खोज्नुहोस्" }, href: "https://example.com/khoj" }],
	metrics: [
		{ value: 0.27, format: "percent", label: { en: "More searches ending in a purchase", ne: "खरिदमा टुङ्गिने थप खोज" } },
		{ value: 180, format: "ms", label: { en: "p95 search latency", ne: "p95 खोज ढिलाइ" } },
		{ value: 0.61, format: "percent", label: { en: "Fewer zero-result searches", ne: "कम शून्य-नतिजा खोज" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Readers search the way they talk: half Nepali, half English, misspelt in both. Keyword search returned nothing for one search in four, and those readers left.",
					ne: "पाठकहरू बोलेजसरी खोज्छन्: आधा नेपाली, आधा अङ्ग्रेजी, दुवैमा हिज्जे गल्ती। किवर्ड खोजले चारमध्ये एक खोजमा केही फर्काउँदैनथ्यो, र ती पाठक छोडेर जान्थे।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "We kept Postgres and added meaning to it. Every book gets a multilingual embedding next to its full-text index; a query runs both and blends the ranks, so exact titles still win and vague moods still find something.",
					ne: "हामीले Postgres नै राख्यौँ र त्यसमा अर्थ थप्यौँ। हरेक पुस्तकको फुल-टेक्स्ट इन्डेक्सछेउ बहुभाषी इम्बेडिङ हुन्छ; खोजले दुवै चलाउँछ र र्‍याङ्क मिसाउँछ, त्यसैले ठ्याक्कै शीर्षक अझै जित्छ र अस्पष्ट मुडले पनि केही भेट्छ।",
				},
				{
					en: "A language model writes short, cached explanations of why a book matched, never the results themselves, so search stays fast, cheap and explainable.",
					ne: "भाषा मोडेलले पुस्तक किन मेल खायो भन्ने छोटो, क्यास गरिएको व्याख्या मात्र लेख्छ, नतिजा आफैँ होइन, त्यसैले खोज छिटो, सस्तो र व्याख्या गर्न मिल्ने रहन्छ।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "Hybrid retrieval in one database; the model only explains.",
				ne: "एउटै डाटाबेसमा हाइब्रिड रिट्रिभल; मोडेलले व्याख्या मात्र गर्छ।",
			},
			nodes: [
				{ id: "search", label: { en: "Search box", ne: "खोज बक्स" }, detail: "React", tier: "client" },
				{ id: "api", label: { en: "Search API", ne: "खोज API" }, detail: "Hono", tier: "edge" },
				{ id: "explain", label: { en: "Explanations", ne: "व्याख्या" }, detail: "Claude API", tier: "service" },
				{ id: "index", label: { en: "Hybrid index", ne: "हाइब्रिड इन्डेक्स" }, detail: "pgvector + FTS", tier: "data" },
			],
			edges: [
				["search", "api"],
				["api", "index"],
				["api", "explain"],
			],
		},
		{
			kind: "code",
			language: "sql",
			caption: {
				en: "Reciprocal rank fusion: keyword and semantic ranks, blended in SQL.",
				ne: "रेसिप्रोकल र्‍याङ्क फ्युजन: किवर्ड र सिमान्टिक र्‍याङ्क, SQL मै मिसाइएको।",
			},
			code: `select book_id,
       coalesce(1.0 / (60 + kw.rank), 0)
     + coalesce(1.0 / (60 + sem.rank), 0) as score
from keyword_hits kw
full join semantic_hits sem using (book_id)
order by score desc
limit 24;`,
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Zero-result searches fell by 61% and searches that end in a purchase rose by 27%, with the whole system running on the database the shop already had.",
					ne: "शून्य-नतिजा खोज ६१% ले घटे र खरिदमा टुङ्गिने खोज २७% ले बढे, र सबै प्रणाली पसलसँग पहिल्यै भएको डाटाबेसमै चल्छ।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Mixed-language query", ne: "मिश्रित भाषाको खोज" },
				{ en: "Why this matched", ne: "यो किन मेल खायो" },
				{ en: "Relevance dashboard", ne: "सान्दर्भिकता ड्यासबोर्ड" },
			],
		},
	],
} satisfies ProjectRecord;

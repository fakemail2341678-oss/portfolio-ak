import type { ProjectRecord } from "../types.ts";

export const jaldhara = {
	slug: "jaldhara",
	title: "Jaldhara",
	client: { en: "Jaldhara Foundation", ne: "जलधारा फाउन्डेसन" },
	year: 2024,
	disciplines: ["product", "frontend", "backend"],
	role: { en: "Lead engineer", ne: "प्रमुख इन्जिनियर" },
	duration: { en: "7 months", ne: "७ महिना" },
	summary: {
		en: "An offline-first field app and data platform tracking drinking water in 1,800 villages without reliable signal.",
		ne: "भरपर्दो सिग्नलबिनाका १,८०० गाउँमा खानेपानी अनुगमन गर्ने अफलाइन-फर्स्ट फिल्ड एप र डाटा प्लेटफर्म।",
	},
	stack: ["React", "Service Workers", "IndexedDB", "PostgreSQL", "PostGIS", "MapLibre"],
	featured: false,
	cover: { motif: "waves", glyph: "जल" },
	links: [{ label: { en: "Read the field report", ne: "फिल्ड रिपोर्ट पढ्नुहोस्" }, href: "https://example.com/jaldhara" }],
	metrics: [
		{ value: 1800, format: "number", label: { en: "Villages monitored", ne: "अनुगमन गरिएका गाउँ" } },
		{ value: 40_000, format: "compact", label: { en: "Water readings a month", ne: "मासिक पानी रिडिङ" } },
		{ value: 0.92, format: "percent", label: { en: "Readings synced within a day", ne: "एक दिनभित्र सिङ्क भएका रिडिङ" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Field officers walked for days to test water sources, wrote results on paper, and typed them in weeks later. By the time a contaminated tap showed up in a report, the season had changed.",
					ne: "फिल्ड अधिकृतहरू पानीका स्रोत जाँच्न दिनौँ हिँड्थे, नतिजा कागजमा लेख्थे, र हप्तौँपछि टाइप गर्थे। दूषित धारा रिपोर्टमा देखिँदासम्म मौसम फेरिइसकेको हुन्थ्यो।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "The field app installs from a link, stores every reading on the phone, and syncs whenever it sees a network, even for a few seconds on a ridge. Conflicts are resolved per field, and nothing is ever lost.",
					ne: "फिल्ड एप लिङ्कबाटै इन्स्टल हुन्छ, हरेक रिडिङ फोनमै राख्छ, र नेटवर्क देख्नेबित्तिकै सिङ्क गर्छ, डाँडामा केही सेकेन्डका लागि मात्र भए पनि। कन्फ्लिक्ट फिल्डअनुसार समाधान हुन्छ, र केही पनि हराउँदैन।",
				},
				{
					en: "In Kathmandu, a PostGIS-backed dashboard flags unsafe sources the day they are tested and sends the nearest health post an SMS.",
					ne: "काठमाडौँमा, PostGIS-आधारित ड्यासबोर्डले असुरक्षित स्रोतलाई जाँचिएकै दिन चिन्ह लगाउँछ र नजिकको स्वास्थ्य चौकीलाई SMS पठाउँछ।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "The phone is the database until the network comes back.",
				ne: "नेटवर्क नफर्किँदासम्म फोन नै डाटाबेस हो।",
			},
			nodes: [
				{ id: "field-app", label: { en: "Field app", ne: "फिल्ड एप" }, detail: "PWA", tier: "client" },
				{ id: "outbox", label: { en: "Outbox", ne: "आउटबक्स" }, detail: "IndexedDB", tier: "client" },
				{ id: "sync", label: { en: "Sync API", ne: "सिङ्क API" }, detail: "Node.js", tier: "edge" },
				{ id: "alerts", label: { en: "Alerts", ne: "अलर्ट" }, detail: "SMS gateway", tier: "service" },
				{ id: "warehouse", label: { en: "Readings", ne: "रिडिङ" }, detail: "PostGIS", tier: "data" },
			],
			edges: [
				["field-app", "outbox"],
				["outbox", "sync"],
				["sync", "warehouse"],
				["warehouse", "alerts"],
			],
		},
		{
			kind: "code",
			language: "ts",
			caption: {
				en: "Every reading waits in an outbox until the server confirms it.",
				ne: "सर्भरले पुष्टि नगरेसम्म हरेक रिडिङ आउटबक्समा पर्खन्छ।",
			},
			code: `export async function flushOutbox(db: OutboxDb, send: Send) {
  for (const reading of await db.pending()) {
    const ok = await send(reading).catch(() => false);
    if (!ok) return; // still offline: try again on the next "online" event
    await db.markSynced(reading.id);
  }
}`,
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "92% of readings now reach the dashboard within a day instead of weeks. In the first monsoon, 140 unsafe sources were closed before anyone fell ill.",
					ne: "अहिले ९२% रिडिङ हप्तौँ होइन, एक दिनभित्रै ड्यासबोर्डमा पुग्छन्। पहिलो मनसुनमा, कोही बिरामी पर्नुअघि नै १४० असुरक्षित स्रोत बन्द गरिए।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Reading form, offline", ne: "अफलाइन रिडिङ फारम" },
				{ en: "Source map", ne: "स्रोत नक्सा" },
				{ en: "Monsoon report", ne: "मनसुन रिपोर्ट" },
			],
		},
	],
} satisfies ProjectRecord;

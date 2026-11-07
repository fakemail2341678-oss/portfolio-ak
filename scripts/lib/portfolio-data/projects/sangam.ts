import type { ProjectRecord } from "../types.ts";

export const sangam = {
	slug: "sangam",
	title: "Sangam",
	client: { en: "Sangam (own product)", ne: "सङ्गम (आफ्नै प्रोडक्ट)" },
	year: 2025,
	disciplines: ["frontend", "backend", "platform"],
	role: { en: "Founder, sole engineer", ne: "संस्थापक, एकल इन्जिनियर" },
	duration: { en: "8 months", ne: "८ महिना" },
	summary: {
		en: "A realtime whiteboard where a hundred people can sketch together, offline or online, without a single merge conflict.",
		ne: "सय जनाले अफलाइन वा अनलाइन, एउटै पनि मर्ज कन्फ्लिक्टविना सँगै स्केच गर्न सक्ने रियलटाइम ह्वाइटबोर्ड।",
	},
	stack: ["React", "Yjs", "WebSockets", "Cloudflare Durable Objects", "Canvas", "Vitest"],
	featured: true,
	cover: { motif: "orbit", glyph: "∞" },
	links: [
		{ label: { en: "Try the demo board", ne: "डेमो बोर्ड चलाउनुहोस्" }, href: "https://example.com/sangam" },
		{ label: { en: "Source on GitHub", ne: "GitHub मा सोर्स" }, href: "https://example.com/sangam-source" },
	],
	metrics: [
		{ value: 48, format: "ms", label: { en: "p95 sync between collaborators", ne: "सहकर्मीबीच p95 सिङ्क" } },
		{
			value: 10_000,
			format: "compact",
			label: { en: "Concurrent editors in load tests", ne: "लोड टेस्टमा एकैसाथ सम्पादक" },
		},
		{ value: 0, format: "number", label: { en: "Merge conflicts, by design", ne: "मर्ज कन्फ्लिक्ट, डिजाइनबाटै" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Workshops in Nepal run on flaky Wi-Fi. Every whiteboard tool we tried either froze when the connection dropped or silently threw away someone's sticky notes when it came back.",
					ne: "नेपालमा कार्यशालाहरू अस्थिर Wi-Fi मा चल्छन्। हामीले प्रयोग गरेका हरेक ह्वाइटबोर्ड टुल या त जडान टुट्दा अड्किन्थे, या फर्किँदा कसैको स्टिकी नोट चुपचाप फालिदिन्थे।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "Sangam treats every device as the source of truth. Edits are CRDT operations stored locally first and exchanged when peers can see each other, so two people drawing on the same shape always converge to the same result.",
					ne: "सङ्गमले हरेक डिभाइसलाई सत्यको स्रोत मान्छ। सम्पादनहरू पहिले स्थानीय रूपमा राखिने CRDT अपरेसन हुन्, जुन साथीहरूले एकअर्कालाई देख्दा साटिन्छन्, त्यसैले एउटै आकारमा कोर्ने दुई जना सधैँ एउटै नतिजामा पुग्छन्।",
				},
				{
					en: "A Durable Object per board relays updates and snapshots history, and the canvas renders only what is on screen, so a board with 20,000 shapes still scrolls at 60 frames per second.",
					ne: "हरेक बोर्डको एउटा Durable Object ले अपडेट रिले गर्छ र इतिहासको स्न्यापसट राख्छ, र क्यानभासले स्क्रिनमा भएको मात्र रेन्डर गर्छ, त्यसैले २०,००० आकार भएको बोर्ड पनि ६० फ्रेम प्रति सेकेन्डमा स्क्रोल हुन्छ।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "Local-first: the server relays and remembers, but never decides.",
				ne: "लोकल-फर्स्ट: सर्भरले रिले गर्छ र सम्झन्छ, तर निर्णय कहिल्यै गर्दैन।",
			},
			nodes: [
				{ id: "canvas", label: { en: "Canvas", ne: "क्यानभास" }, detail: "React + Yjs", tier: "client" },
				{ id: "storage", label: { en: "Local store", ne: "लोकल स्टोर" }, detail: "IndexedDB", tier: "client" },
				{ id: "relay", label: { en: "Relay", ne: "रिले" }, detail: "Durable Objects", tier: "edge" },
				{ id: "snapshots", label: { en: "Snapshots", ne: "स्न्यापसट" }, detail: "R2", tier: "data" },
			],
			edges: [
				["canvas", "storage"],
				["canvas", "relay"],
				["relay", "snapshots"],
			],
		},
		{
			kind: "code",
			language: "ts",
			caption: {
				en: "Moving a shape is a CRDT update: concurrent moves merge instead of fighting.",
				ne: "आकार सार्नु CRDT अपडेट हो: एकैसाथका चालहरू लड्नुको सट्टा मिसिन्छन्।",
			},
			code: `export function moveShape(doc: Y.Doc, id: string, x: number, y: number) {
  doc.transact(() => {
    const shape = doc.getMap<Y.Map<number>>("shapes").get(id);
    shape?.set("x", x);
    shape?.set("y", y);
  }, "local");
}`,
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Sangam now hosts design sprints for teams in six countries. In load tests, ten thousand simulated editors on one board stayed under 50 ms at the 95th percentile.",
					ne: "सङ्गमले अहिले छ देशका टिमहरूको डिजाइन स्प्रिन्ट चलाउँछ। लोड टेस्टमा एउटै बोर्डका दस हजार सिमुलेटेड सम्पादक ९५औँ पर्सेन्टाइलमा ५० ms भित्रै रहे।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "A workshop board", ne: "कार्यशालाको बोर्ड" },
				{ en: "Presence and cursors", ne: "उपस्थिति र कर्सर" },
			],
		},
	],
} satisfies ProjectRecord;

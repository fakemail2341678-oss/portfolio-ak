import type { ProjectRecord } from "../types.ts";

export const ledgerline = {
	slug: "ledgerline",
	title: "Ledgerline",
	client: { en: "Himal Capital", ne: "हिमाल क्यापिटल" },
	year: 2026,
	disciplines: ["product", "frontend", "backend"],
	role: { en: "Lead engineer, product design", ne: "प्रमुख इन्जिनियर, प्रोडक्ट डिजाइन" },
	duration: { en: "11 weeks", ne: "११ हप्ता" },
	summary: {
		en: "A treasury dashboard that closes the month in hours, not days, for a fund moving a billion rupees a week.",
		ne: "हप्तामा एक अर्ब रुपैयाँ चलाउने फन्डका लागि महिना दिनमा होइन, घण्टामै बन्द गर्ने ट्रेजरी ड्यासबोर्ड।",
	},
	stack: ["TanStack Start", "PostgreSQL", "Drizzle", "TanStack Table", "Temporal", "Vercel"],
	featured: true,
	cover: { motif: "grid", glyph: "रू" },
	links: [{ label: { en: "Read the launch note", ne: "लन्च नोट पढ्नुहोस्" }, href: "https://example.com/ledgerline" }],
	metrics: [
		{ value: 0.63, format: "percent", label: { en: "Faster month-end close", ne: "छिटो महिनाअन्त्य बन्द" } },
		{
			value: 1_200_000,
			format: "compact",
			label: { en: "Transactions reconciled a day", ne: "दैनिक मिलान हुने कारोबार" },
		},
		{ value: 0.9998, format: "percent", label: { en: "Uptime since launch", ne: "लन्चदेखिको अपटाइम" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Himal Capital's finance team closed every month with forty spreadsheets, six bank portals and a shared drive named FINAL_final. Close took nine working days, and every audit began with an apology.",
					ne: "हिमाल क्यापिटलको फाइनान्स टिमले हरेक महिना चालीस स्प्रेडसिट, छ वटा बैंक पोर्टल र FINAL_final नामको साझा ड्राइभसँग महिना बन्द गर्थ्यो। बन्द गर्न नौ कार्यदिन लाग्थ्यो, र हरेक अडिट माफीबाट सुरु हुन्थ्यो।",
				},
				{
					en: "They didn't need another BI tool. They needed one place where every rupee had a source, a status and an owner.",
					ne: "उनीहरूलाई अर्को BI टुल चाहिएको थिएन। हरेक रुपैयाँको स्रोत, स्थिति र जिम्मेवार व्यक्ति भएको एउटै ठाउँ चाहिएको थियो।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "We started with the ledger, not the dashboard: an append-only Postgres schema where corrections are new entries, never edits. Bank statements are ingested by durable workflows that retry for days if a portal is down.",
					ne: "हामीले ड्यासबोर्डबाट होइन, लेजरबाट सुरु गर्‍यौँ: append-only Postgres स्किमा, जहाँ सच्याइ नयाँ प्रविष्टि हुन्छ, सम्पादन होइन। बैंक स्टेटमेन्टहरू टिकाउ वर्कफ्लोले भित्र्याउँछन्, जसले पोर्टल बन्द भए दिनौँसम्म पुनः प्रयास गर्छन्।",
				},
				{
					en: "The interface is a single table that scales to a million rows, with filters that live in the URL so an accountant can send a colleague exactly what they're looking at.",
					ne: "इन्टरफेस दस लाख पङ्क्तिसम्म चल्ने एउटै टेबल हो, जसका फिल्टरहरू URL मा बस्छन्, ताकि एक लेखापालले आफूले हेरिरहेको कुरा जस्ताको तस्तै सहकर्मीलाई पठाउन सकून्।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "Statements flow in through durable workflows; the ledger is the single source of truth.",
				ne: "स्टेटमेन्टहरू टिकाउ वर्कफ्लोबाट भित्रिन्छन्; लेजर नै सत्यको एकमात्र स्रोत हो।",
			},
			nodes: [
				{ id: "dashboard", label: { en: "Dashboard", ne: "ड्यासबोर्ड" }, detail: "TanStack Start", tier: "client" },
				{ id: "api", label: { en: "Server functions", ne: "सर्भर फङ्सन" }, detail: "Node.js", tier: "edge" },
				{ id: "workflows", label: { en: "Ingestion", ne: "इन्जेसन" }, detail: "Temporal", tier: "service" },
				{ id: "ledger", label: { en: "Ledger", ne: "लेजर" }, detail: "PostgreSQL", tier: "data" },
			],
			edges: [
				["dashboard", "api"],
				["api", "ledger"],
				["workflows", "ledger"],
			],
		},
		{
			kind: "code",
			language: "sql",
			caption: {
				en: "Balances are a view over immutable entries, so history can't be rewritten.",
				ne: "ब्यालेन्स अपरिवर्तनीय प्रविष्टिहरूमाथिको भ्यु हो, त्यसैले इतिहास फेरि लेख्न सकिँदैन।",
			},
			code: `create view account_balance as
select account_id,
       sum(amount) filter (where direction = 'credit')
     - sum(amount) filter (where direction = 'debit') as balance,
       max(booked_at) as as_of
from ledger_entry
group by account_id;`,
		},
		{
			kind: "quote",
			text: {
				en: "For the first time, the auditors asked us how we built it instead of where the numbers came from.",
				ne: "पहिलो पटक अडिटरहरूले अङ्क कहाँबाट आए भनेर होइन, हामीले यो कसरी बनायौँ भनेर सोधे।",
			},
			cite: "Priya Malla, CFO",
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Month-end close dropped from nine days to just over three, and reconciliation exceptions are now resolved the same day they appear. The finance team retired 38 of their 40 spreadsheets.",
					ne: "महिनाअन्त्य बन्द नौ दिनबाट तीन दिनभन्दा अलि बढीमा झर्‍यो, र मिलानका अपवादहरू देखिएकै दिन समाधान हुन्छन्। फाइनान्स टिमले ४० मध्ये ३८ स्प्रेडसिट बन्द गर्‍यो।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Reconciliation queue", ne: "मिलान लाइन" },
				{ en: "Cash position by bank", ne: "बैंकअनुसार नगद स्थिति" },
				{ en: "Audit trail for one entry", ne: "एउटा प्रविष्टिको अडिट ट्रेल" },
			],
		},
	],
} satisfies ProjectRecord;

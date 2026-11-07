import type { PostRecord } from "../types.ts";

export const postgresIsEnough = {
	slug: "postgres-is-enough",
	title: { en: "Postgres is (almost always) enough", ne: "Postgres (लगभग सधैँ) पर्याप्त छ" },
	excerpt: {
		en: "Queues, search, vectors and audit logs: how far one boring database can take a product team.",
		ne: "क्यू, खोज, भेक्टर र अडिट लग: एउटा बोरिङ डाटाबेसले प्रोडक्ट टिमलाई कति टाढा पुर्‍याउन सक्छ।",
	},
	publishedAt: "2025-12-02",
	tags: ["PostgreSQL", "Architecture"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "Every new service in your architecture diagram is a pager you'll carry at 3 a.m. Before adding one, I ask whether Postgres can already do it. Surprisingly often, it can.",
				ne: "तपाईंको आर्किटेक्चर डायग्रामको हरेक नयाँ सेवा राति ३ बजे बोक्नुपर्ने पेजर हो। एउटा थप्नुअघि, म सोध्छु कि Postgres ले यो पहिल्यै गर्न सक्छ कि? अचम्मै गरी प्रायः सक्छ।",
			},
		},
		{ kind: "heading", text: { en: "Things I no longer reach for", ne: "अब नखोज्ने कुराहरू" } },
		{
			kind: "list",
			items: [
				{ en: "A job queue: SELECT … FOR UPDATE SKIP LOCKED.", ne: "जब क्यू: SELECT … FOR UPDATE SKIP LOCKED।" },
				{
					en: "A search cluster: full-text search plus trigram indexes.",
					ne: "सर्च क्लस्टर: फुल-टेक्स्ट सर्च र ट्राइग्राम इन्डेक्स।",
				},
				{
					en: "A vector database: pgvector, next to the rows it describes.",
					ne: "भेक्टर डाटाबेस: pgvector, त्यसले वर्णन गर्ने पङ्क्तिकै छेउमा।",
				},
			],
		},
		{
			kind: "code",
			language: "sql",
			code: `update job set started_at = now()
where id = (
  select id from job
  where started_at is null
  order by created_at
  for update skip locked
  limit 1
)
returning *;`,
		},
		{
			kind: "paragraph",
			text: {
				en: "The point isn't purity. When you outgrow it, you'll know exactly which part, and you'll replace one piece instead of untangling five.",
				ne: "उद्देश्य शुद्धता होइन। जब यो पुग्दैन, कुन भाग हो भनेर ठ्याक्कै थाहा हुनेछ, र पाँचवटा फुकाउनुको सट्टा एउटा टुक्रा मात्र बदल्नुहुनेछ।",
			},
		},
		{
			kind: "quote",
			text: {
				en: "Boring technology is a gift to the person on call.",
				ne: "बोरिङ प्रविधि अन-कल व्यक्तिका लागि उपहार हो।",
			},
		},
	],
} satisfies PostRecord;

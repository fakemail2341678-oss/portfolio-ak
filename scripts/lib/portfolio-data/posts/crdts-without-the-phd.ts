import type { PostRecord } from "../types.ts";

export const crdtsWithoutThePhd = {
	slug: "crdts-without-the-phd",
	title: { en: "CRDTs without the PhD", ne: "PhD बिना CRDT" },
	excerpt: {
		en: "What I learned building a realtime whiteboard that has to survive Nepali Wi-Fi.",
		ne: "नेपाली Wi-Fi मा टिक्नुपर्ने रियलटाइम ह्वाइटबोर्ड बनाउँदा मैले सिकेका कुरा।",
	},
	publishedAt: "2026-07-18",
	tags: ["Realtime", "CRDT", "Architecture"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "A conflict-free replicated data type sounds like a thesis title. In practice it is a promise: if two people edit the same thing at the same time, everyone ends up seeing the same result, without asking a server who won.",
				ne: "Conflict-free replicated data type कुनै थेसिसको शीर्षकजस्तो सुनिन्छ। व्यवहारमा भने यो एउटा वाचा हो: दुई जनाले एउटै कुरा एकैसाथ सम्पादन गरे पनि, कसले जित्यो भनेर सर्भरलाई नसोधी सबैले एउटै नतिजा देख्छन्।",
			},
		},
		{ kind: "heading", text: { en: "Start local, sync later", ne: "पहिले लोकल, सिङ्क पछि" } },
		{
			kind: "paragraph",
			text: {
				en: "The mental shift is to stop thinking of the server as the database. Each device has the full document. The network is just a way to exchange changes, and it is allowed to disappear.",
				ne: "मानसिक परिवर्तन भनेको सर्भरलाई डाटाबेस ठान्न छोड्नु हो। हरेक डिभाइससँग पूरा डकुमेन्ट हुन्छ। नेटवर्क परिवर्तन साट्ने माध्यम मात्र हो, र त्यो हराउन पाउँछ।",
			},
		},
		{
			kind: "list",
			items: [
				{ en: "Model data as maps and lists, not rows.", ne: "डाटालाई पङ्क्ति होइन, म्याप र सूचीका रूपमा मोडेल गर्नुहोस्।" },
				{ en: "Keep presence (cursors) out of the document.", ne: "उपस्थिति (कर्सर) लाई डकुमेन्टबाहिर राख्नुहोस्।" },
				{
					en: "Snapshot often; history grows faster than you think.",
					ne: "बारम्बार स्न्यापसट लिनुहोस्; इतिहास सोचेभन्दा छिटो बढ्छ।",
				},
			],
		},
		{
			kind: "code",
			language: "ts",
			code: `const doc = new Y.Doc();
new IndexeddbPersistence("board-42", doc); // works offline
new WebsocketProvider(RELAY_URL, "board-42", doc); // syncs when it can`,
		},
		{
			kind: "quote",
			text: {
				en: "The best sync engine is the one your users never have to think about.",
				ne: "उत्तम सिङ्क इन्जिन त्यो हो, जसबारे प्रयोगकर्ताले कहिल्यै सोच्नु पर्दैन।",
			},
		},
		{
			kind: "paragraph",
			text: {
				en: "You don't need to understand the proofs to use a good CRDT library. You do need to design your data so that merging is meaningful, and that is a product question as much as a technical one.",
				ne: "राम्रो CRDT लाइब्रेरी प्रयोग गर्न प्रमाणहरू बुझ्नु पर्दैन। तर मर्ज गर्दा अर्थपूर्ण होस् भनेर डाटा डिजाइन गर्नैपर्छ, र त्यो प्राविधिक जत्तिकै प्रोडक्टको प्रश्न हो।",
			},
		},
	],
} satisfies PostRecord;

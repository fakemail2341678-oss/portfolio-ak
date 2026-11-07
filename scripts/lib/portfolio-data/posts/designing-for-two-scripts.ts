import type { PostRecord } from "../types.ts";

export const designingForTwoScripts = {
	slug: "designing-for-two-scripts",
	title: { en: "Designing for two scripts", ne: "दुई लिपिका लागि डिजाइन" },
	excerpt: {
		en: "Latin and Devanagari on the same page: line height, font loading and the words that are twice as long.",
		ne: "एउटै पेजमा ल्याटिन र देवनागरी: लाइनको उचाइ, फन्ट लोडिङ र दोब्बर लामा शब्दहरू।",
	},
	publishedAt: "2026-05-30",
	tags: ["Design", "i18n", "Typography"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "Most interfaces are designed in English and translated at the end. In Nepali that shows immediately: buttons wrap, headings clip their vowel signs, and the font arrives a second after the text, shoving everything down.",
				ne: "धेरैजसो इन्टरफेस अङ्ग्रेजीमा डिजाइन गरेर अन्त्यमा अनुवाद गरिन्छन्। नेपालीमा त्यो तुरुन्तै देखिन्छ: बटनहरू बेरिन्छन्, शीर्षकका मात्रा काटिन्छन्, र फन्ट टेक्स्टभन्दा एक सेकेन्ड ढिलो आएर सबैलाई तल धकेल्छ।",
			},
		},
		{ kind: "heading", text: { en: "Give the script room", ne: "लिपिलाई ठाउँ दिनुहोस्" } },
		{
			kind: "paragraph",
			text: {
				en: "Devanagari hangs from a headline and stacks vowel signs above and below it. It needs more line height than Latin and no negative letter spacing. I set both per language rather than per component.",
				ne: "देवनागरी शिरोरेखाबाट झुण्डिन्छ र त्यसको माथि र तल मात्राहरू थपिन्छन्। यसलाई ल्याटिनभन्दा बढी लाइन उचाइ चाहिन्छ र नेगेटिभ अक्षर दूरी चाहिँदैन। म दुवै कम्पोनेन्टअनुसार होइन, भाषाअनुसार सेट गर्छु।",
			},
		},
		{
			kind: "code",
			language: "css",
			code: `:lang(ne) h1 {
  letter-spacing: 0;
  line-height: 1.15;
}`,
		},
		{ kind: "heading", text: { en: "Load fonts without moving anything", ne: "केही नहल्लाई फन्ट लोड" } },
		{
			kind: "list",
			items: [
				{
					en: "Self-host and preload only the subset the page needs.",
					ne: "आफैँ होस्ट गर्नुहोस् र पेजलाई चाहिने सबसेट मात्र प्रिलोड गर्नुहोस्।",
				},
				{
					en: "Match the fallback font's metrics so the swap is invisible.",
					ne: "फलब्याक फन्टको मेट्रिक्स मिलाउनुहोस्, ताकि साटासाट नदेखियोस्।",
				},
				{
					en: "Split by unicode-range, so English pages never fetch Devanagari.",
					ne: "unicode-range अनुसार छुट्याउनुहोस्, ताकि अङ्ग्रेजी पेजले देवनागरी कहिल्यै नतानोस्।",
				},
			],
		},
		{
			kind: "quote",
			text: {
				en: "If it only looks right in English, it isn't finished.",
				ne: "अङ्ग्रेजीमा मात्र ठीक देखिन्छ भने, काम सकिएको छैन।",
			},
		},
		{
			kind: "paragraph",
			text: {
				en: "The test I use is simple: design every screen with the longest real Nepali strings first. If it holds up, English will too.",
				ne: "म प्रयोग गर्ने परीक्षण सरल छ: हरेक स्क्रिन पहिले सबैभन्दा लामा वास्तविक नेपाली स्ट्रिङसँग डिजाइन गर्ने। त्यो टिक्यो भने, अङ्ग्रेजी पनि टिक्छ।",
			},
		},
	],
} satisfies PostRecord;

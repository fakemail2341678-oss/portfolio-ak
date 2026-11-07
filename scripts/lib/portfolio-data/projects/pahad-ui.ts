import type { ProjectRecord } from "../types.ts";

export const pahadUi = {
	slug: "pahad-ui",
	title: "Pahad UI",
	client: { en: "Everest Labs", ne: "एभरेस्ट ल्याब्स" },
	year: 2023,
	disciplines: ["frontend", "product"],
	role: { en: "Design system lead", ne: "डिजाइन सिस्टम लिड" },
	duration: { en: "9 months", ne: "९ महिना" },
	summary: {
		en: "A bilingual design system of 120 accessible components that fourteen product teams build on every day.",
		ne: "चौध प्रोडक्ट टिमले हरेक दिन प्रयोग गर्ने १२० पहुँचयोग्य कम्पोनेन्टको द्विभाषी डिजाइन सिस्टम।",
	},
	stack: ["React", "Radix", "Tailwind CSS", "Storybook", "Figma tokens", "Chromatic"],
	featured: false,
	cover: { motif: "terrain", glyph: "प" },
	links: [{ label: { en: "Browse the docs", ne: "डक्स हेर्नुहोस्" }, href: "https://example.com/pahad" }],
	metrics: [
		{ value: 120, format: "number", label: { en: "Accessible components", ne: "पहुँचयोग्य कम्पोनेन्ट" } },
		{ value: 14, format: "number", label: { en: "Product teams on the system", ne: "सिस्टममा प्रोडक्ट टिम" } },
		{ value: 0.45, format: "percent", label: { en: "Less UI code per feature", ne: "प्रति फिचर कम UI कोड" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Fourteen teams had built fourteen date pickers, none of which worked with a screen reader and three of which broke in Nepali. Every redesign started from zero.",
					ne: "चौध टिमले चौध वटा डेट पिकर बनाएका थिए, जसमध्ये कुनै पनि स्क्रिन रिडरसँग चल्दैनथ्यो र तीन वटा नेपालीमा बिग्रन्थे। हरेक रिडिजाइन शून्यबाट सुरु हुन्थ्यो।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "We built on accessible primitives, wrote tokens once and generated them for code and Figma, and tested every component in both scripts and both themes in a real browser on every commit.",
					ne: "हामीले पहुँचयोग्य प्रिमिटिभमाथि निर्माण गर्‍यौँ, टोकन एक पटक लेखेर कोड र Figma दुवैका लागि जेनेरेट गर्‍यौँ, र हरेक कम्पोनेन्टलाई हरेक कमिटमा वास्तविक ब्राउजरमा दुवै लिपि र दुवै थिममा परीक्षण गर्‍यौँ।",
				},
				{
					en: "Adoption was a product problem, not a technical one: office hours, migration codemods and a changelog people actually read.",
					ne: "अपनाउनु प्राविधिक होइन, प्रोडक्टको समस्या थियो: अफिस आवर, माइग्रेसन कोडमोड र मानिसहरूले साँच्चै पढ्ने चेन्जलग।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "One token source feeds design and code; every story is a test.",
				ne: "एउटै टोकन स्रोतले डिजाइन र कोड दुवैलाई खुवाउँछ; हरेक स्टोरी एउटा टेस्ट हो।",
			},
			nodes: [
				{ id: "figma", label: { en: "Figma library", ne: "Figma लाइब्रेरी" }, detail: "Variables", tier: "client" },
				{ id: "tokens", label: { en: "Tokens", ne: "टोकन" }, detail: "JSON", tier: "data" },
				{ id: "components", label: { en: "Components", ne: "कम्पोनेन्ट" }, detail: "React + Radix", tier: "service" },
				{ id: "storybook", label: { en: "Visual tests", ne: "भिजुअल टेस्ट" }, detail: "Storybook", tier: "edge" },
			],
			edges: [
				["tokens", "figma"],
				["tokens", "components"],
				["components", "storybook"],
			],
		},
		{
			kind: "code",
			language: "css",
			caption: {
				en: "Devanagari gets its own rhythm, not a squeezed copy of Latin.",
				ne: "देवनागरीले ल्याटिनको खुम्चिएको प्रतिलिपि होइन, आफ्नै लय पाउँछ।",
			},
			code: `:lang(ne) {
  --leading-body: 1.75;
  --tracking-label: 0;
  font-feature-settings: "kern", "liga";
}`,
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Teams ship features with 45% less UI code, accessibility bugs dropped by two thirds, and the last redesign took six weeks instead of six months.",
					ne: "टिमहरूले ४५% कम UI कोडमा फिचर पठाउँछन्, पहुँचसम्बन्धी बग दुई तिहाइले घटे, र पछिल्लो रिडिजाइन छ महिना होइन, छ हप्तामै सकियो।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Component overview", ne: "कम्पोनेन्ट सिंहावलोकन" },
				{ en: "Token pipeline", ne: "टोकन पाइपलाइन" },
			],
		},
	],
} satisfies ProjectRecord;

import type { ProjectRecord } from "../types.ts";

export const haat = {
	slug: "haat",
	title: "Haat",
	client: { en: "Haat Collective", ne: "हाट कलेक्टिभ" },
	year: 2025,
	disciplines: ["product", "frontend"],
	role: { en: "Tech lead, frontend architecture", ne: "टेक लिड, फ्रन्टएन्ड आर्किटेक्चर" },
	duration: { en: "5 months", ne: "५ महिना" },
	summary: {
		en: "A marketplace for Nepali makers that loads in a second on a 3G connection and sells in both scripts.",
		ne: "3G जडानमा एक सेकेन्डमै खुल्ने र दुवै लिपिमा बेच्ने नेपाली सिर्जनाकारहरूको बजार।",
	},
	stack: ["React", "TanStack Router", "Paraglide", "Postgres", "Cloudinary", "Khalti"],
	featured: true,
	cover: { motif: "blocks", glyph: "हा" },
	links: [{ label: { en: "Visit the shop", ne: "पसल हेर्नुहोस्" }, href: "https://example.com/haat" }],
	metrics: [
		{ value: 0.38, format: "percent", label: { en: "More checkouts completed", ne: "थप चेकआउट पूरा" } },
		{
			value: 1.1,
			format: "seconds",
			label: { en: "Largest paint on a mid-range phone", ne: "मध्यम फोनमा सबैभन्दा ठूलो पेन्ट" },
		},
		{ value: 3, format: "multiplier", label: { en: "Orders from mobile", ne: "मोबाइलबाट अर्डर" } },
		{ value: 1400, format: "number", label: { en: "Makers selling today", ne: "आज बेचिरहेका सिर्जनाकार" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Haat sells handmade goods from 1,400 makers, most of whom manage their shop from a phone. The old storefront shipped 3 MB of JavaScript and showed a blank screen for six seconds outside Kathmandu.",
					ne: "हाटले १,४०० सिर्जनाकारका हस्तनिर्मित सामान बेच्छ, जसमध्ये धेरैले आफ्नो पसल फोनबाटै चलाउँछन्। पुरानो स्टोरफ्रन्टले ३ MB JavaScript पठाउँथ्यो र काठमाडौँबाहिर छ सेकेन्डसम्म खाली स्क्रिन देखाउँथ्यो।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "Every page now renders on the server and works before JavaScript arrives: filters are plain links, the cart is a form. Images are resized at the edge to exactly the slot they fill, so nothing jumps while loading.",
					ne: "अब हरेक पेज सर्भरमै रेन्डर हुन्छ र JavaScript आउनुअघि नै चल्छ: फिल्टरहरू सादा लिङ्क हुन्, कार्ट एउटा फारम। तस्बिरहरू एजमै तिनले भर्ने ठाउँअनुसार ठ्याक्कै रिसाइज हुन्छन्, त्यसैले लोड हुँदा केही उफ्रिँदैन।",
				},
				{
					en: "We designed in Devanagari first. Product names in Nepali are often twice as long as their English translations, so every card, button and price tag was tested with the longest real names in the catalogue.",
					ne: "हामीले पहिले देवनागरीमा डिजाइन गर्‍यौँ। नेपालीमा प्रोडक्टका नाम प्रायः अङ्ग्रेजी अनुवादभन्दा दोब्बर लामा हुन्छन्, त्यसैले हरेक कार्ड, बटन र मूल्य ट्यागलाई क्याटलगका सबैभन्दा लामा वास्तविक नामसँग परीक्षण गरियो।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "HTML from the server, images from the edge, payments through local wallets.",
				ne: "सर्भरबाट HTML, एजबाट तस्बिर, स्थानीय वालेटबाट भुक्तानी।",
			},
			nodes: [
				{ id: "storefront", label: { en: "Storefront", ne: "स्टोरफ्रन्ट" }, detail: "React SSR", tier: "client" },
				{ id: "cdn", label: { en: "Image CDN", ne: "तस्बिर CDN" }, detail: "Cloudinary", tier: "edge" },
				{ id: "orders", label: { en: "Orders", ne: "अर्डर" }, detail: "Node.js", tier: "service" },
				{ id: "wallets", label: { en: "Wallets", ne: "वालेट" }, detail: "Khalti · eSewa", tier: "service" },
				{ id: "catalogue", label: { en: "Catalogue", ne: "क्याटलग" }, detail: "PostgreSQL", tier: "data" },
			],
			edges: [
				["storefront", "cdn"],
				["storefront", "orders"],
				["orders", "wallets"],
				["orders", "catalogue"],
			],
		},
		{
			kind: "code",
			language: "tsx",
			caption: {
				en: "Filters are links, so they work on the first paint and in every browser.",
				ne: "फिल्टरहरू लिङ्क हुन्, त्यसैले पहिलो पेन्टमै र हरेक ब्राउजरमा चल्छन्।",
			},
			code: `<Link to="/shop" search={(prev) => ({ ...prev, category: "dhaka", page: 1 })}>
  {m.category_dhaka()}
</Link>`,
		},
		{
			kind: "quote",
			text: {
				en: "Our makers in Palpa can finally see their own shop load. That was the whole point.",
				ne: "पाल्पाका हाम्रा सिर्जनाकारहरूले अन्ततः आफ्नै पसल खुलेको देख्न पाए। मुख्य उद्देश्य त्यही थियो।",
			},
			cite: "Rohan Thapa, Founder",
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Completed checkouts rose 38% in the first quarter, mobile orders tripled, and the JavaScript budget is now enforced in CI: 90 kB, or the build fails.",
					ne: "पहिलो त्रैमासिकमा पूरा भएका चेकआउट ३८% ले बढे, मोबाइल अर्डर तेब्बर भए, र अहिले JavaScript बजेट CI मा लागू छ: ९० kB, नत्र बिल्ड फेल।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Product page in Nepali", ne: "नेपालीमा प्रोडक्ट पेज" },
				{ en: "Maker storefront", ne: "सिर्जनाकारको पसल" },
				{ en: "Two-tap checkout", ne: "दुई ट्यापमा चेकआउट" },
			],
		},
	],
} satisfies ProjectRecord;

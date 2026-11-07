import type { PostRecord } from "../types.ts";

export const serverRenderEverything = {
	slug: "server-render-everything",
	title: { en: "Server-render everything", ne: "सबै कुरा सर्भरमै रेन्डर गर्नुहोस्" },
	excerpt: {
		en: "A love letter to complete HTML, and why the spinner is the most expensive component in your app.",
		ne: "पूर्ण HTML प्रतिको प्रेमपत्र, र स्पिनर किन तपाईंको एपको सबैभन्दा महँगो कम्पोनेन्ट हो।",
	},
	publishedAt: "2026-09-02",
	tags: ["React", "Performance", "SSR"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "Every spinner is a small admission: we sent you a page that isn't finished. On a fast laptop in an office, nobody notices. On a mid-range phone in Dhangadhi, the spinner is the product.",
				ne: "हरेक स्पिनर एउटा सानो स्वीकारोक्ति हो: हामीले तपाईंलाई अधुरो पेज पठायौँ। अफिसको छिटो ल्यापटपमा कसैले याद गर्दैन। धनगढीको मध्यम फोनमा भने स्पिनर नै प्रोडक्ट हो।",
			},
		},
		{ kind: "heading", text: { en: "The page should arrive finished", ne: "पेज पूरा भएरै आउनुपर्छ" } },
		{
			kind: "paragraph",
			text: {
				en: "In the apps I build now, the route loader awaits the data on the server, the HTML contains it, and the client hydrates the same cache. There is no loading state on first paint because there is nothing left to load.",
				ne: "अहिले म बनाउने एपहरूमा, रुट लोडरले सर्भरमै डाटा पर्खन्छ, HTML मा त्यो हुन्छ, र क्लाइन्टले त्यही क्यास हाइड्रेट गर्छ। पहिलो पेन्टमा लोडिङ अवस्था हुँदैन, किनकि लोड गर्न बाँकी केही हुँदैन।",
			},
		},
		{
			kind: "code",
			language: "ts",
			caption: { en: "The whole pattern, in two lines.", ne: "सम्पूर्ण ढाँचा, दुई लाइनमा।" },
			code: `loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery()),
// …and in the component:
const { data } = useSuspenseQuery(projectsQuery());`,
		},
		{ kind: "heading", text: { en: "What you get for free", ne: "सित्तैमा के पाइन्छ" } },
		{
			kind: "list",
			items: [
				{
					en: "Search engines and link previews see the real content.",
					ne: "सर्च इन्जिन र लिङ्क प्रिभ्युले वास्तविक सामग्री देख्छन्।",
				},
				{
					en: "Screen readers get a complete document, not a skeleton.",
					ne: "स्क्रिन रिडरले कङ्काल होइन, पूर्ण डकुमेन्ट पाउँछन्।",
				},
				{
					en: "Layout shift disappears, because nothing arrives late.",
					ne: "लेआउट सिफ्ट हराउँछ, किनकि केही पनि ढिलो आउँदैन।",
				},
			],
		},
		{
			kind: "quote",
			text: {
				en: "The fastest request is the one the browser never has to make after the page loads.",
				ne: "सबैभन्दा छिटो रिक्वेस्ट त्यो हो, जुन पेज लोड भएपछि ब्राउजरले कहिल्यै गर्नु पर्दैन।",
			},
		},
		{
			kind: "paragraph",
			text: {
				en: "None of this is new. It is how the web worked in 2005. What is new is that we can keep the interactivity of a single-page app and still send a finished page. That combination is the best default I know.",
				ne: "यीमध्ये केही पनि नयाँ होइन। सन् २००५ मा वेब यसरी नै चल्थ्यो। नयाँ कुरा के हो भने, हामी सिङ्गल-पेज एपको अन्तरक्रियात्मकता राख्दै पूरा पेज पठाउन सक्छौँ। मलाई थाहा भएकामध्ये यो संयोजन नै उत्तम डिफल्ट हो।",
			},
		},
	],
} satisfies PostRecord;

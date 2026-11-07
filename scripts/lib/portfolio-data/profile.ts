import type { ProfileRecord } from "./types.ts";

/** Demo data: a fictional full-stack developer. Replace with your own (docs/guides/portfolio.md). */
export const profile = {
	name: { en: "Aarav Shrestha", ne: "आरव श्रेष्ठ" },
	initials: "AS",
	role: { en: "Full-stack developer", ne: "फुल-स्ट्याक डेभलपर" },
	location: { en: "Kathmandu, Nepal", ne: "काठमाडौँ, नेपाल" },
	timezone: "NPT · UTC+5:45",
	email: "hello@example.com",
	availability: {
		status: "limited",
		note: {
			en: "Booking one product partnership for early 2027.",
			ne: "सन् २०२७ को सुरुका लागि एउटा प्रोडक्ट साझेदारी बुक गर्दैछु।",
		},
	},
	headline: [
		{ en: "I build software", ne: "म यस्तो सफ्टवेयर" },
		{ en: "that feels", ne: "बनाउँछु, जुन" },
		{ en: "inevitable.", ne: "अपरिहार्य लाग्छ।" },
	],
	intro: {
		en: "Ten years of shipping web products end to end, from the first database table to the last pixel, for fintech, commerce and the public good.",
		ne: "पहिलो डाटाबेस टेबलदेखि अन्तिम पिक्सेलसम्म, फिनटेक, कमर्स र सार्वजनिक हितका लागि दस वर्षदेखि वेब प्रोडक्टहरू सुरुदेखि अन्त्यसम्म बनाउँदै आएको छु।",
	},
	manifesto: {
		en: "Good software disappears. It loads before you notice, works on the slowest phone in Jumla, speaks your language, and never makes you wonder whether it saved. I care about the boring parts, the schema, the URL, the error message, because that is where trust is earned. Everything else is decoration.",
		ne: "राम्रो सफ्टवेयर देखिँदैन। तपाईंले थाहा नपाउँदै खुल्छ, जुम्लाको सबैभन्दा ढिलो फोनमा पनि चल्छ, तपाईंकै भाषा बोल्छ, र सेभ भयो कि भएन भनेर कहिल्यै शंका गराउँदैन। म बोरिङ लाग्ने भागहरूको ख्याल गर्छु: स्किमा, URL, त्रुटि सन्देश, किनकि विश्वास त्यहीँ कमाइन्छ। बाँकी सबै सजावट मात्र हो।",
	},
	bio: [
		{
			en: "I grew up between Pokhara and Kathmandu, taught myself PHP on a shared family computer, and shipped my first paid website at sixteen, for a trekking agency that still uses the same domain.",
			ne: "म पोखरा र काठमाडौँबीच हुर्किएँ, परिवारको साझा कम्प्युटरमा आफैँ PHP सिकेँ, र सोह्र वर्षको उमेरमा पहिलो पारिश्रमिक पाउने वेबसाइट बनाएँ, एउटा ट्रेकिङ एजेन्सीका लागि, जसले अझै त्यही डोमेन प्रयोग गर्छ।",
		},
		{
			en: "Since then I have led engineering at two startups, built payment rails that move real money, and helped NGOs collect data in villages without a signal. Today I work independently with a small set of teams who care about craft as much as I do.",
			ne: "त्यसपछि मैले दुई स्टार्टअपमा इन्जिनियरिङको नेतृत्व गरेँ, वास्तविक पैसा चलाउने पेमेन्ट प्रणाली बनाएँ, र सिग्नल नभएका गाउँहरूमा डाटा सङ्कलन गर्न NGO हरूलाई सघाएँ। अहिले म स्वतन्त्र रूपमा केही टिमहरूसँग काम गर्छु, जो सीपको उत्तिकै ख्याल गर्छन्।",
		},
		{
			en: "My work sits where product, design and infrastructure meet. I write TypeScript and SQL every day, sketch interfaces on paper first, and measure success in what users stop complaining about.",
			ne: "मेरो काम प्रोडक्ट, डिजाइन र इन्फ्रास्ट्रक्चर भेटिने ठाउँमा हुन्छ। म हरेक दिन TypeScript र SQL लेख्छु, इन्टरफेस पहिले कागजमा कोर्छु, र प्रयोगकर्ताले गुनासो गर्न छोडेका कुराले सफलता नाप्छु।",
		},
	],
	principles: [
		{
			title: { en: "Server first, always", ne: "सधैँ सर्भर पहिले" },
			body: {
				en: "HTML that arrives complete is faster, more accessible and more honest than any spinner.",
				ne: "पूरा भएर आउने HTML कुनै पनि स्पिनरभन्दा छिटो, पहुँचयोग्य र इमानदार हुन्छ।",
			},
		},
		{
			title: { en: "Design in the real data", ne: "वास्तविक डाटामा डिजाइन" },
			body: {
				en: "Long Nepali names, empty states and slow networks are part of the brief, not edge cases.",
				ne: "लामा नेपाली नाम, खाली अवस्था र ढिलो नेटवर्क अपवाद होइनन्, ब्रिफकै भाग हुन्।",
			},
		},
		{
			title: { en: "Boring technology, sharp edges", ne: "बोरिङ प्रविधि, तिखो धार" },
			body: {
				en: "Postgres and plain HTTP for the foundation; spend the novelty budget where users can feel it.",
				ne: "आधारका लागि Postgres र सादा HTTP; नवीनताको बजेट प्रयोगकर्ताले महसुस गर्ने ठाउँमा खर्च गर्ने।",
			},
		},
		{
			title: { en: "Leave it better documented", ne: "अझ राम्रो दस्तावेज छोड्ने" },
			body: {
				en: "Every project ends with a codebase the next person can own without me.",
				ne: "हरेक प्रोजेक्ट यस्तो कोडबेसमा टुङ्गिन्छ, जुन अर्को व्यक्तिले मविना सम्हाल्न सकोस्।",
			},
		},
	],
	impact: [
		{ value: 10, format: "plus", label: { en: "Years shipping production software", ne: "वर्ष प्रोडक्सन सफ्टवेयर बनाउँदै" } },
		{
			value: 4_200_000,
			format: "compact",
			label: { en: "People using things I built", ne: "मैले बनाएका कुरा प्रयोग गर्ने मानिस" },
		},
		{
			value: 0.999,
			format: "percent",
			label: { en: "Median uptime across client platforms", ne: "क्लाइन्ट प्लेटफर्महरूको औसत अपटाइम" },
		},
		{
			value: 38,
			format: "number",
			label: { en: "Products launched with teams on four continents", ne: "चार महादेशका टिमसँग सुरु गरिएका प्रोडक्ट" },
		},
	],
	socials: [
		{ network: "GitHub", handle: "@aarav-demo", href: "https://example.com/github" },
		{ network: "LinkedIn", handle: "in/aarav-demo", href: "https://example.com/linkedin" },
		{ network: "Read.cv", handle: "aarav", href: "https://example.com/readcv" },
		{ network: "Bluesky", handle: "@aarav.demo", href: "https://example.com/bluesky" },
	],
	/** The scrolling marquee under the capabilities: tools, not claims. */
	toolbox: [
		"TypeScript",
		"React",
		"TanStack",
		"Node.js",
		"PostgreSQL",
		"Drizzle",
		"Tailwind",
		"Vite",
		"Redis",
		"Docker",
		"Terraform",
		"OpenTelemetry",
		"Vitest",
		"Playwright",
	],
	since: 2016,
	updated: 2026,
} satisfies ProfileRecord;

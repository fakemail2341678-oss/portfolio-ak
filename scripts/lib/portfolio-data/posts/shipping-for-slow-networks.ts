import type { PostRecord } from "../types.ts";

export const shippingForSlowNetworks = {
	slug: "shipping-for-slow-networks",
	title: { en: "Shipping for a 3G afternoon in Jumla", ne: "जुम्लाको 3G दिउँसोका लागि सफ्टवेयर" },
	excerpt: {
		en: "A performance budget is a promise to your slowest user. Here's how I keep it.",
		ne: "पर्फर्मेन्स बजेट तपाईंको सबैभन्दा ढिलो प्रयोगकर्तासँगको वाचा हो। म यसलाई यसरी निभाउँछु।",
	},
	publishedAt: "2025-09-20",
	tags: ["Performance", "Mobile"],
	body: [
		{
			kind: "paragraph",
			text: {
				en: "I keep an old Android phone on my desk and a network profile called Jumla Afternoon: 400 kbps, 300 ms latency, occasional loss. Every feature gets tried on it before it ships.",
				ne: "म आफ्नो टेबलमा एउटा पुरानो एन्ड्रोइड फोन र 'जुम्ला दिउँसो' नामको नेटवर्क प्रोफाइल राख्छु: ४०० kbps, ३०० ms ढिलाइ, कहिलेकाहीँ डाटा हराउने। हरेक फिचर पठाउनुअघि यसमा चलाइन्छ।",
			},
		},
		{ kind: "heading", text: { en: "Budgets that fail the build", ne: "बिल्ड फेल गराउने बजेट" } },
		{
			kind: "paragraph",
			text: {
				en: "A budget nobody enforces is a wish. Mine live in CI: if the JavaScript for a route grows past its limit, the pull request goes red and we talk about it.",
				ne: "कसैले लागू नगर्ने बजेट केवल इच्छा हो। मेरा बजेट CI मा बस्छन्: कुनै रुटको JavaScript सीमाभन्दा बढ्यो भने, पुल रिक्वेस्ट रातो हुन्छ र हामी छलफल गर्छौँ।",
			},
		},
		{
			kind: "list",
			items: [
				{ en: "90 kB of JavaScript per route, compressed.", ne: "प्रति रुट ९० kB JavaScript, कम्प्रेस गरिएको।" },
				{ en: "Largest paint under 2.5 seconds on the test phone.", ne: "टेस्ट फोनमा सबैभन्दा ठूलो पेन्ट २.५ सेकेन्डभित्र।" },
				{
					en: "Layout shift under 0.01, measured on production builds.",
					ne: "लेआउट सिफ्ट ०.०१ भन्दा कम, प्रोडक्सन बिल्डमा नापिएको।",
				},
			],
		},
		{
			kind: "quote",
			text: {
				en: "Performance is a feature you only notice when it's missing.",
				ne: "पर्फर्मेन्स यस्तो फिचर हो, जुन नभएपछि मात्र याद आउँछ।",
			},
		},
		{
			kind: "paragraph",
			text: {
				en: "The surprising part is how little it costs when you start early. Retrofitting speed is expensive; keeping it is mostly saying no to one more dependency.",
				ne: "अचम्मको कुरा, चाँडै सुरु गर्दा यसको लागत कति थोरै हुन्छ। पछि गति थप्नु महँगो हुन्छ; कायम राख्नु भनेको प्रायः अर्को एउटा डिपेन्डेन्सीलाई होइन भन्नु मात्र हो।",
			},
		},
	],
} satisfies PostRecord;

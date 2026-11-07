import type { TestimonialRecord } from "./types.ts";

/** Demo data: the people and companies are fictional. */
export const testimonials = [
	{
		id: "himal-capital",
		quote: {
			en: "Aarav rebuilt our treasury dashboard in eleven weeks and our finance team stopped exporting to Excel. That had never happened before.",
			ne: "आरवले एघार हप्तामा हाम्रो ट्रेजरी ड्यासबोर्ड फेरि बनाए र हाम्रो फाइनान्स टिमले Excel मा निर्यात गर्न छोड्यो। यस्तो पहिले कहिल्यै भएको थिएन।",
		},
		name: "Priya Malla",
		role: { en: "CFO", ne: "प्रमुख वित्त अधिकृत" },
		company: "Himal Capital",
	},
	{
		id: "haat",
		quote: {
			en: "He asked to see our worst-performing phone before he asked for a Figma file. Our conversion went up because of that question.",
			ne: "उनले Figma फाइल माग्नुअघि हाम्रो सबैभन्दा कमजोर फोन हेर्न मागे। त्यही प्रश्नका कारण हाम्रो कन्भर्जन बढ्यो।",
		},
		name: "Rohan Thapa",
		role: { en: "Founder", ne: "संस्थापक" },
		company: "Haat Collective",
	},
	{
		id: "jaldhara",
		quote: {
			en: "Our field teams work for days without signal. Aarav built something that simply waits, then syncs. It sounds small; it changed everything.",
			ne: "हाम्रा फिल्ड टिम दिनौँसम्म सिग्नलबिना काम गर्छन्। आरवले यस्तो चिज बनाए जुन बस पर्खन्छ, अनि सिङ्क हुन्छ। सानो सुनिन्छ; तर सबै बदलियो।",
		},
		name: "Sunita Gurung",
		role: { en: "Programme director", ne: "कार्यक्रम निर्देशक" },
		company: "Jaldhara Foundation",
	},
	{
		id: "everest-labs",
		quote: {
			en: "The best engineering lead I have worked with. Calm in incidents, generous in reviews, and allergic to unnecessary complexity.",
			ne: "मैले सँगै काम गरेकामध्ये उत्कृष्ट इन्जिनियरिङ लिड। घटनामा शान्त, रिभ्युमा उदार, र अनावश्यक जटिलताप्रति एलर्जी।",
		},
		name: "Daniel Okafor",
		role: { en: "CTO", ne: "प्रमुख प्रविधि अधिकृत" },
		company: "Everest Labs",
	},
] satisfies TestimonialRecord[];

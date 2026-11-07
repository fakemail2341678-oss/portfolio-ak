import type { ExperienceRecord } from "./types.ts";

/** Demo data: the companies are fictional. */
export const experience = [
	{
		id: "independent",
		company: "Independent",
		role: { en: "Full-stack developer & product partner", ne: "फुल-स्ट्याक डेभलपर र प्रोडक्ट साझेदार" },
		start: "2024-02",
		end: null,
		location: { en: "Kathmandu · remote", ne: "काठमाडौँ · रिमोट" },
		summary: {
			en: "Embedded with three to four teams a year, from first commit to launch: fintech, commerce and civic tech.",
			ne: "वर्षमा तीनदेखि चार टिमसँग पहिलो कमिटदेखि लन्चसम्म: फिनटेक, कमर्स र सिभिक टेक।",
		},
	},
	{
		id: "everest-labs",
		company: "Everest Labs",
		role: { en: "Head of engineering", ne: "इन्जिनियरिङ प्रमुख" },
		start: "2021-04",
		end: "2024-01",
		location: { en: "Kathmandu & Singapore", ne: "काठमाडौँ र सिङ्गापुर" },
		summary: {
			en: "Grew the team from 4 to 22 engineers and rebuilt the payments core that now settles NPR 3 billion a month.",
			ne: "टिमलाई ४ बाट २२ इन्जिनियरसम्म पुर्‍याएँ र महिनाको रु. ३ अर्ब सेटल गर्ने पेमेन्ट कोर फेरि बनाएँ।",
		},
	},
	{
		id: "yatra-tech",
		company: "Yatra Tech",
		role: { en: "Senior software engineer", ne: "सिनियर सफ्टवेयर इन्जिनियर" },
		start: "2019-01",
		end: "2021-03",
		location: { en: "Bengaluru", ne: "बेङ्गलुरु" },
		summary: {
			en: "Led the booking platform rewrite: a React frontend and a Postgres-backed API that halved checkout time.",
			ne: "बुकिङ प्लेटफर्म पुनर्लेखनको नेतृत्व: चेकआउट समय आधा गर्ने React फ्रन्टएन्ड र Postgres-आधारित API।",
		},
	},
	{
		id: "kaagaz-studio",
		company: "Kaagaz Studio",
		role: { en: "Software engineer", ne: "सफ्टवेयर इन्जिनियर" },
		start: "2017-06",
		end: "2018-12",
		location: { en: "Kathmandu", ne: "काठमाडौँ" },
		summary: {
			en: "Built websites and internal tools for publishers, banks and NGOs at a small design studio.",
			ne: "एउटा सानो डिजाइन स्टुडियोमा प्रकाशक, बैंक र NGO हरूका लागि वेबसाइट र आन्तरिक टुल बनाएँ।",
		},
	},
	{
		id: "freelance",
		company: "Freelance",
		role: { en: "Web developer", ne: "वेब डेभलपर" },
		start: "2016-01",
		end: "2017-05",
		location: { en: "Pokhara", ne: "पोखरा" },
		summary: {
			en: "Websites for trekking agencies, hotels and a local newspaper while finishing a computer engineering degree.",
			ne: "कम्प्युटर इन्जिनियरिङ पढ्दै गर्दा ट्रेकिङ एजेन्सी, होटल र एउटा स्थानीय पत्रिकाका लागि वेबसाइट।",
		},
	},
] satisfies ExperienceRecord[];

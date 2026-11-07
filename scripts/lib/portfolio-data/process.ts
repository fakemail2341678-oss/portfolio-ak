import type { ProcessStepRecord } from "./types.ts";

export const processSteps = [
	{
		id: "discover",
		title: { en: "Discover", ne: "खोज" },
		body: {
			en: "Two weeks with your users, your data and your support inbox. We agree on the one number that tells us it worked.",
			ne: "तपाईंका प्रयोगकर्ता, डाटा र सपोर्ट इनबक्ससँग दुई हप्ता। काम भयो भनेर बताउने एउटा सङ्ख्यामा हामी सहमत हुन्छौँ।",
		},
		outputs: [
			{ en: "Problem brief", ne: "समस्याको ब्रिफ" },
			{ en: "Success metric", ne: "सफलताको मेट्रिक" },
			{ en: "Risk map", ne: "जोखिम नक्सा" },
		],
	},
	{
		id: "shape",
		title: { en: "Shape", ne: "आकार" },
		body: {
			en: "Paper sketches become a clickable prototype on real data. The data model is drawn before the first screen is styled.",
			ne: "कागजका स्केचहरू वास्तविक डाटामा क्लिक गर्न मिल्ने प्रोटोटाइप बन्छन्। पहिलो स्क्रिन सजाउनुअघि डाटा मोडेल कोरिन्छ।",
		},
		outputs: [
			{ en: "Prototype", ne: "प्रोटोटाइप" },
			{ en: "Schema", ne: "स्किमा" },
			{ en: "Architecture note", ne: "आर्किटेक्चर नोट" },
		],
	},
	{
		id: "build",
		title: { en: "Build", ne: "निर्माण" },
		body: {
			en: "Vertical slices shipped behind flags every week, each one tested, documented and deployed to a preview you can click.",
			ne: "हरेक हप्ता फ्ल्यागपछाडि भर्टिकल स्लाइसहरू, प्रत्येक टेस्ट गरिएको, दस्तावेज भएको र क्लिक गर्न मिल्ने प्रिभ्युमा डिप्लोय गरिएको।",
		},
		outputs: [
			{ en: "Weekly previews", ne: "साप्ताहिक प्रिभ्यु" },
			{ en: "Test suite", ne: "टेस्ट सुइट" },
			{ en: "Living docs", ne: "जीवित दस्तावेज" },
		],
	},
	{
		id: "ship",
		title: { en: "Ship", ne: "सुरु" },
		body: {
			en: "A staged rollout with dashboards already watching. Launch day is quiet because every scary part already happened in staging.",
			ne: "ड्यासबोर्डहरू पहिल्यै निगरानीमा राखेर चरणबद्ध रोलआउट। लन्चको दिन शान्त हुन्छ, किनकि डरलाग्दा सबै कुरा स्टेजिङमै भइसकेका हुन्छन्।",
		},
		outputs: [
			{ en: "Rollout plan", ne: "रोलआउट योजना" },
			{ en: "Runbooks", ne: "रनबुक" },
			{ en: "Alerts", ne: "अलर्ट" },
		],
	},
	{
		id: "measure",
		title: { en: "Measure", ne: "मापन" },
		body: {
			en: "We read the number we agreed on, talk to users again, and decide together what deserves the next iteration.",
			ne: "सहमत भएको सङ्ख्या पढ्छौँ, प्रयोगकर्तासँग फेरि कुरा गर्छौँ, र अर्को चरण केले पाउनुपर्छ भनी सँगै निर्णय गर्छौँ।",
		},
		outputs: [
			{ en: "Impact report", ne: "प्रभाव रिपोर्ट" },
			{ en: "Handover", ne: "हस्तान्तरण" },
			{ en: "Next bets", ne: "अर्का दाउ" },
		],
	},
] satisfies ProcessStepRecord[];

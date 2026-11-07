import type { ProjectRecord } from "../types.ts";

export const ferry = {
	slug: "ferry",
	title: "Ferry",
	client: { en: "Open source", ne: "खुला स्रोत" },
	year: 2024,
	disciplines: ["platform", "backend"],
	role: { en: "Creator, maintainer", ne: "सर्जक, मेन्टेनर" },
	duration: { en: "Ongoing since 2023", ne: "सन् २०२३ देखि जारी" },
	summary: {
		en: "A command-line tool that gives every pull request its own preview environment, database included, in ninety seconds.",
		ne: "हरेक पुल रिक्वेस्टलाई डाटाबेससहित आफ्नै प्रिभ्यु वातावरण नब्बे सेकेन्डमै दिने कमान्ड-लाइन टुल।",
	},
	stack: ["TypeScript", "Node.js", "Docker", "Neon branching", "GitHub Actions", "Terraform"],
	featured: false,
	cover: { motif: "type", glyph: "›_" },
	links: [{ label: { en: "Source on GitHub", ne: "GitHub मा सोर्स" }, href: "https://example.com/ferry" }],
	metrics: [
		{ value: 4200, format: "compact", label: { en: "GitHub stars", ne: "GitHub स्टार" } },
		{ value: 90, format: "seconds", label: { en: "From push to preview", ne: "पुशदेखि प्रिभ्युसम्म" } },
		{ value: 6, format: "multiplier", label: { en: "Faster than the previous setup", ne: "पहिलेको सेटअपभन्दा छिटो" } },
	],
	body: [
		{
			kind: "chapter",
			title: { en: "The challenge", ne: "चुनौती" },
			body: [
				{
					en: "Reviewing a pull request meant pulling the branch, migrating a local database and hoping the seed data still matched. Most reviewers skipped it and read the diff instead.",
					ne: "पुल रिक्वेस्ट रिभ्यु गर्नु भनेको ब्रान्च तान्ने, लोकल डाटाबेस माइग्रेट गर्ने र सिड डाटा अझै मेल खान्छ भनी आशा गर्नु थियो। धेरैजसो रिभ्युअरले त्यो छोडेर डिफ मात्र पढ्थे।",
				},
			],
		},
		{
			kind: "chapter",
			title: { en: "The approach", ne: "तरिका" },
			body: [
				{
					en: "Ferry branches the production database schema copy-on-write, builds the app once, and posts a link on the pull request. Previews sleep when nobody looks at them and disappear when the branch merges.",
					ne: "फेरीले प्रोडक्सन डाटाबेस स्किमालाई copy-on-write ब्रान्च गर्छ, एप एक पटक बिल्ड गर्छ, र पुल रिक्वेस्टमा लिङ्क राख्छ। कसैले नहेर्दा प्रिभ्यु सुत्छ र ब्रान्च मर्ज हुँदा हराउँछ।",
				},
			],
		},
		{
			kind: "architecture",
			caption: {
				en: "One command, three providers, zero dashboards to click.",
				ne: "एउटा कमान्ड, तीन प्रोभाइडर, क्लिक गर्नुपर्ने शून्य ड्यासबोर्ड।",
			},
			nodes: [
				{ id: "cli", label: { en: "CLI", ne: "कमान्ड लाइन" }, detail: "ferry up", tier: "client" },
				{ id: "actions", label: { en: "CI runner", ne: "CI रनर" }, detail: "GitHub Actions", tier: "edge" },
				{ id: "runtime", label: { en: "Preview runtime", ne: "प्रिभ्यु रनटाइम" }, detail: "Docker", tier: "service" },
				{ id: "branches", label: { en: "Database branch", ne: "डाटाबेस ब्रान्च" }, detail: "Neon", tier: "data" },
			],
			edges: [
				["cli", "actions"],
				["actions", "runtime"],
				["actions", "branches"],
			],
		},
		{
			kind: "code",
			language: "bash",
			caption: {
				en: "The whole interface, most days.",
				ne: "धेरैजसो दिनको सम्पूर्ण इन्टरफेस।",
			},
			code: `$ npx ferry up
✓ database branch  pr-482   (1.8s)
✓ image built      a3f9c1e  (61s)
✓ preview ready    https://pr-482.preview.example.com`,
		},
		{
			kind: "chapter",
			title: { en: "The outcome", ne: "नतिजा" },
			body: [
				{
					en: "Ferry is used by more than a hundred teams. The maintainers' favourite metric: reviewers now click the preview on 80% of pull requests, up from almost none.",
					ne: "फेरी सयभन्दा बढी टिमले प्रयोग गर्छन्। मेन्टेनरहरूको मनपर्ने मेट्रिक: रिभ्युअरहरूले अब ८०% पुल रिक्वेस्टमा प्रिभ्यु क्लिक गर्छन्, पहिले लगभग शून्य थियो।",
				},
			],
		},
		{
			kind: "gallery",
			captions: [
				{ en: "Preview comment on a pull request", ne: "पुल रिक्वेस्टमा प्रिभ्यु कमेन्ट" },
				{ en: "Terminal output", ne: "टर्मिनल आउटपुट" },
			],
		},
	],
} satisfies ProjectRecord;

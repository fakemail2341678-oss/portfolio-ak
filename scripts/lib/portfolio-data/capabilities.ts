import type { CapabilityRecord } from "./types.ts";

export const capabilities = [
	{
		id: "frontend",
		title: { en: "Frontend", ne: "फ्रन्टएन्ड" },
		summary: {
			en: "Server-rendered React that is fast on a cheap phone, accessible by default and fluent in two scripts.",
			ne: "सस्तो फोनमा पनि छिटो, सुरुदेखि नै पहुँचयोग्य र दुवै लिपिमा सहज सर्भर-रेन्डर्ड React।",
		},
		skills: ["React 19", "TanStack Start", "TypeScript", "Tailwind CSS", "Design systems", "Accessibility"],
	},
	{
		id: "backend",
		title: { en: "Backend", ne: "ब्याकएन्ड" },
		summary: {
			en: "APIs and data models that stay boring under load: Postgres, queues, payments and audit trails.",
			ne: "लोडमा पनि शान्त रहने API र डाटा मोडेल: Postgres, क्यू, पेमेन्ट र अडिट ट्रेल।",
		},
		skills: ["Node.js", "PostgreSQL", "Drizzle", "Redis", "Event sourcing", "Payments"],
	},
	{
		id: "infrastructure",
		title: { en: "Infrastructure", ne: "इन्फ्रास्ट्रक्चर" },
		summary: {
			en: "Deploys you can forget about: previews per branch, observability from day one, costs you can read.",
			ne: "बिर्सन मिल्ने डिप्लोय: हरेक ब्रान्चको प्रिभ्यु, पहिलो दिनदेखि अब्जर्भेबिलिटी, बुझ्न सकिने खर्च।",
		},
		skills: ["Vercel", "AWS", "Docker", "Terraform", "OpenTelemetry", "CI/CD"],
	},
	{
		id: "product",
		title: { en: "Product", ne: "प्रोडक्ट" },
		summary: {
			en: "From a vague brief to a measurable launch: discovery, prototypes, metrics and the courage to cut scope.",
			ne: "अस्पष्ट ब्रिफदेखि नाप्न सकिने लन्चसम्म: खोज, प्रोटोटाइप, मेट्रिक्स र स्कोप काट्ने साहस।",
		},
		skills: ["Discovery", "Prototyping", "Analytics", "Experimentation", "Roadmaps", "Mentoring"],
	},
] satisfies CapabilityRecord[];

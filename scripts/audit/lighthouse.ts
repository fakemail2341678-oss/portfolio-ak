/**
 * Audit: Lighthouse (mobile, simulated throttling) for the public home and each product's
 * landing, as earlier measurements did it (decisions 0245, 0292): through a local HTTP/2 proxy
 * with brotli, because that is how Vercel serves the pages and the e2e server does neither.
 *
 *   node e2e/harness/server.ts                 (the production build on :3100, in another shell)
 *   node scripts/audit/lighthouse.ts [runs]    (3 runs a page by default; downloads Lighthouse with `pnpm dlx`)
 *
 * Needs `openssl` on the PATH for the proxy's throwaway certificate (Git Bash has it).
 * Prints each page's median and writes docs/history/part9-audit/lighthouse.json.
 * Part 9 Task 98.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { request } from "node:http";
import { createSecureServer } from "node:http2";
import { brotliCompressSync, constants } from "node:zlib";
import { save } from "./lib.ts";

const ORIGIN = { host: "localhost", port: 3100 };
const PROXY_PORT = 3443;
const DIR = ".data/audit/lighthouse";
const RUNS = Number(process.argv[2] ?? 3);
const PAGES = ["/", "/app/taskline", "/app/parda", "/app/chaal", "/app/kharcha"];
const COMPRESSIBLE = /text\/|javascript|json|xml|svg|manifest/;

mkdirSync(DIR, { recursive: true });
if (!existsSync(`${DIR}/key.pem`)) {
	execFileSync(
		"openssl",
		[
			"req",
			"-x509",
			"-newkey",
			"rsa:2048",
			"-nodes",
			"-keyout",
			`${DIR}/key.pem`,
			"-out",
			`${DIR}/cert.pem`,
			"-days",
			"30",
			"-subj",
			"/CN=localhost",
		],
		{ stdio: "ignore" },
	);
}

/** Headers HTTP/2 forbids, and the ones this proxy rewrites. */
const DROPPED = new Set([
	"connection",
	"keep-alive",
	"transfer-encoding",
	"upgrade",
	"content-length",
	"content-encoding",
]);

const proxy = createSecureServer(
	{ key: readFileSync(`${DIR}/key.pem`), cert: readFileSync(`${DIR}/cert.pem`) },
	(incoming, outgoing) => {
		const headers = Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !name.startsWith(":")));
		const upstream = request(
			{
				...ORIGIN,
				path: incoming.url,
				method: incoming.method,
				headers: { ...headers, host: `${ORIGIN.host}:${ORIGIN.port}`, "accept-encoding": "identity" },
			},
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer) => chunks.push(chunk));
				response.on("end", () => {
					const body = Buffer.concat(chunks);
					const type = String(response.headers["content-type"] ?? "");
					const compress =
						COMPRESSIBLE.test(type) &&
						body.length > 512 &&
						String(incoming.headers["accept-encoding"] ?? "").includes("br");
					const sent = compress ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) : body;
					for (const [name, value] of Object.entries(response.headers)) {
						if (value !== undefined && !DROPPED.has(name)) outgoing.setHeader(name, value);
					}
					if (compress) outgoing.setHeader("content-encoding", "br");
					outgoing.setHeader("content-length", sent.length);
					outgoing.writeHead(response.statusCode ?? 502);
					outgoing.end(sent);
				});
			},
		);
		upstream.on("error", () => {
			outgoing.writeHead(502);
			outgoing.end();
		});
		incoming.pipe(upstream);
	},
);
await new Promise<void>((resolve) => proxy.listen(PROXY_PORT, resolve));
// `--serve`: only the proxy, to look at it with a browser or curl.
if (process.argv.includes("--serve")) {
	console.log(`proxy on https://localhost:${PROXY_PORT}`);
	await new Promise(() => {});
}

type Report = {
	categories: Record<string, { score: number | null }>;
	audits: Record<string, { numericValue?: number }>;
};
type Run = {
	performance: number;
	accessibility: number;
	bestPractices: number;
	seo: number;
	fcp: number;
	lcp: number;
	tbt: number;
	cls: number;
};

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const results: Array<{ page: string; runs: Run[]; median: Run }> = [];
for (const page of PAGES) {
	const runs: Run[] = [];
	for (let run = 1; run <= RUNS; run += 1) {
		const out = `${DIR}/${page.replace(/\W+/g, "-") || "home"}-${run}.json`;
		const command = `pnpm dlx lighthouse@13 https://localhost:${PROXY_PORT}${page} --quiet --output=json --output-path=${out} --only-categories=performance,accessibility,best-practices,seo --chrome-flags=--ignore-certificate-errors`;
		// One flag and no quotes: through two Windows command shims a quoted list loses its second flag, and Chrome
		// then refuses the proxy's certificate. chrome-launcher adds `--headless` itself when HEADLESS is set.
		// Not spawnSync: the proxy above lives in this process and must keep answering while Lighthouse runs.
		const status = await new Promise<number>((resolve) => {
			const child = spawn(command, {
				shell: true,
				stdio: ["ignore", "ignore", "inherit"],
				env: { ...process.env, HEADLESS: "1" },
			});
			child.on("close", (code) => resolve(code ?? 1));
		});
		if (status !== 0 || !existsSync(out)) {
			console.error(`lighthouse failed for ${page} (run ${run})`);
			continue;
		}
		const report = JSON.parse(readFileSync(out, "utf8")) as Report;
		const score = (name: string) => Math.round((report.categories[name]?.score ?? 0) * 100);
		const value = (name: string) => report.audits[name]?.numericValue ?? 0;
		runs.push({
			performance: score("performance"),
			accessibility: score("accessibility"),
			bestPractices: score("best-practices"),
			seo: score("seo"),
			fcp: Math.round(value("first-contentful-paint")),
			lcp: Math.round(value("largest-contentful-paint")),
			tbt: Math.round(value("total-blocking-time")),
			cls: Math.round(value("cumulative-layout-shift") * 1000) / 1000,
		});
	}
	const pick = (key: keyof Run) => median(runs.map((item) => item[key]));
	const middle: Run = {
		performance: pick("performance"),
		accessibility: pick("accessibility"),
		bestPractices: pick("bestPractices"),
		seo: pick("seo"),
		fcp: pick("fcp"),
		lcp: pick("lcp"),
		tbt: pick("tbt"),
		cls: pick("cls"),
	};
	results.push({ page, runs, median: middle });
	console.log(
		`${page.padEnd(16)} performance ${runs.map((item) => item.performance).join(", ")} (median ${middle.performance}); ` +
			`a11y ${middle.accessibility}, best practices ${middle.bestPractices}, SEO ${middle.seo}; ` +
			`FCP ${middle.fcp} ms, LCP ${middle.lcp} ms, TBT ${middle.tbt} ms, CLS ${middle.cls}`,
	);
}
proxy.close();
save("lighthouse", {
	generated: "node scripts/audit/lighthouse.ts",
	setup:
		"Lighthouse 13, mobile, simulated throttling, through a local HTTP/2 proxy with brotli, on the e2e harness's production build",
	runsPerPage: RUNS,
	results,
});
process.exit(0);

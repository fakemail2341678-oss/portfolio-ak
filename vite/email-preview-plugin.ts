import type { IncomingMessage, ServerResponse } from "node:http";
import { createRunnableDevEnvironment, isRunnableDevEnvironment, type Plugin, type ViteDevServer } from "vite";

/**
 * Dev-only email preview at /dev/emails.
 *
 * `apply: "serve"` means Vite only registers this plugin for the dev server,
 * so production builds contain no preview route or code at all.
 *
 * Templates are imported through a dedicated, runnable server environment
 * (Vite Environment API). TanStack Start runs its own "ssr" environment inside
 * Nitro, where modules can't be imported from a plugin, so the preview gets its
 * own. It shares the app's config, so aliases and Paraglide work and edits hot-reload.
 *
 *   /dev/emails                      index of every template in every locale
 *   /dev/emails/<template>/<locale>  rendered HTML
 *   /dev/emails/<template>/<locale>.txt  plain-text version
 */
type PreviewModule = typeof import("../src/server/email/preview");

const MOUNT = "/dev/emails";
const ENVIRONMENT = "email_preview";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const send = (res: ServerResponse, status: number, type: string, body: string) => {
	res.statusCode = status;
	res.setHeader("Content-Type", `${type}; charset=utf-8`);
	res.setHeader("Cache-Control", "no-store");
	res.end(body);
};

const indexPage = async (preview: PreviewModule) => {
	const rows: string[] = [];
	for (const id of preview.previewTemplates()) {
		const cells: string[] = [];
		for (const locale of preview.previewLocales()) {
			const { subject } = await preview.renderPreview(id, locale);
			const base = `${MOUNT}/${id}/${locale}`;
			cells.push(`<td>
  <p class="meta"><strong lang="${locale}">${escapeHtml(subject)}</strong><br>
  <a href="${base}">HTML</a> · <a href="${base}.txt">Plain text</a></p>
  <iframe src="${base}" title="${escapeHtml(`${id} (${locale})`)}" loading="lazy"></iframe>
</td>`);
		}
		rows.push(`<tr><th scope="row"><code>${id}</code></th>${cells.join("")}</tr>`);
	}
	const headers = preview
		.previewLocales()
		.map((locale) => `<th scope="col">${locale}</th>`)
		.join("");
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email preview (dev)</title>
<link rel="icon" href="data:,">
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #18181b; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e4e4e7; padding: 12px; vertical-align: top; text-align: left; }
  iframe { width: 100%; height: 560px; border: 1px solid #e4e4e7; border-radius: 8px; background: #fff; }
  .meta { margin: 0 0 8px; }
</style></head>
<body>
  <h1>Email preview</h1>
  <p>Development only. Rendered with sample data from <code>src/server/email/templates/index.ts</code>.</p>
  <table><thead><tr><th scope="col">Template</th>${headers}</tr></thead><tbody>${rows.join("")}</tbody></table>
</body></html>`;
};

const handle = async (server: ViteDevServer, req: IncomingMessage, res: ServerResponse) => {
	const environment = server.environments[ENVIRONMENT];
	if (!environment || !isRunnableDevEnvironment(environment))
		throw new Error(`Missing runnable "${ENVIRONMENT}" environment`);
	const preview: PreviewModule = await environment.runner.import("/src/server/email/preview.ts");
	const path = (req.url ?? "/").split("?")[0] ?? "/";

	if (path === "/" || path === "") return send(res, 200, "text/html", await indexPage(preview));

	const match = /^\/([a-z-]+)\/([a-z]+)(\.txt)?$/.exec(path);
	const [, id = "", locale = "", txt] = match ?? [];
	if (!match || !preview.isTemplateId(id) || !preview.isLocale(locale)) {
		return send(res, 404, "text/plain", `Unknown email preview: ${path}`);
	}
	const email = await preview.renderPreview(id, locale);
	return txt ? send(res, 200, "text/plain", email.text) : send(res, 200, "text/html", email.html);
};

export const emailPreviewPlugin = (): Plugin => ({
	name: "portfolio:email-preview",
	apply: "serve",
	config: () => ({
		environments: {
			[ENVIRONMENT]: {
				consumer: "server",
				dev: { createEnvironment: (name, config) => createRunnableDevEnvironment(name, config) },
			},
		},
	}),
	configureServer(server) {
		server.middlewares.use(MOUNT, (req, res, next) => {
			handle(server, req, res).catch(next);
		});
	},
});

import "@tanstack/react-start/server-only";

/**
 * A crawler file response. The router maps /ne/... onto the same route, so
 * `onlyAt` (when set) refuses any other path: /ne/robots.txt is a 404, not a
 * second copy. Cached for an hour at the edge.
 */
export async function textResponse(
	request: Request,
	onlyAt: string | null,
	contentType: string,
	body: () => string | Promise<string>,
): Promise<Response> {
	if (onlyAt && new URL(request.url).pathname !== onlyAt) {
		return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
	}
	return new Response(await body(), {
		headers: {
			"content-type": `${contentType}; charset=utf-8`,
			"cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
		},
	});
}

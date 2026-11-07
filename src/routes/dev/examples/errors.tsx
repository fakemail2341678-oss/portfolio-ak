import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { EXAMPLE_ERROR_CASES, type ExampleErrorCase } from "@/features/dev/examples/schema";
import { failExample } from "@/functions/examples";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { setErrorStatus } from "@/lib/start/http-status";
import { m } from "@/paraglide/messages";

/**
 * Error and not-found handling:
 * - a loader that throws notFound() renders the localized 404 page (status 404 on SSR);
 * - a loader whose server function fails renders the route's errorComponent (the
 *   app's ErrorPage, by AppError code) with the matching HTTP status
 *   (setErrorStatus); unexpected errors become INTERNAL and their details stay in
 *   the server log;
 * - an action's failure is caught where it happens and shown as a toast.
 * Expected errors (below 500) aren't logged in the browser (src/client.tsx).
 */
export const Route = createFileRoute("/dev/examples/errors")({
	validateSearch: z.object({ case: z.enum(EXAMPLE_ERROR_CASES).optional().catch(undefined) }),
	loaderDeps: ({ search }) => ({ case: search.case }),
	loader: async ({ deps }) => {
		if (deps.case === undefined) return;
		if (deps.case === "not-found") throw notFound();
		// On demand: the server functions stay out of every page's JavaScript (0194).
		const { failExample } = await import("@/functions/examples");
		try {
			await failExample({ data: { case: deps.case } });
		} catch (error) {
			await setErrorStatus(error);
			throw error;
		}
	},
	staticData: { breadcrumb: staticCrumb(m.examples_errors_title) },
	head: () => privateHead(m.examples_errors_title()),
	component: ErrorsExample,
});

const CASE_LABELS: Record<ExampleErrorCase, () => string> = {
	"not-found": m.examples_errors_not_found,
	forbidden: m.examples_errors_forbidden,
	crash: m.examples_errors_crash,
};

function ErrorsExample() {
	const action = useMutation({
		mutationFn: () => failExample({ data: { case: "forbidden" } }),
		onError: (error) => toast.error(m.examples_failed(), { description: errorMessage(error) }),
	});
	return (
		<ExamplePage slug="errors">
			<Demo title={m.examples_errors_page()} note={m.examples_errors_page_note()}>
				<ul className="flex flex-col gap-2 text-sm">
					{EXAMPLE_ERROR_CASES.map((errorCase) => (
						<li key={errorCase}>
							<Link
								from={Route.fullPath}
								search={{ case: errorCase }}
								className="underline underline-offset-4"
								data-testid={`error-${errorCase}`}
							>
								{CASE_LABELS[errorCase]()}
							</Link>
						</li>
					))}
				</ul>
			</Demo>
			<Demo title={m.examples_errors_action()} note={m.examples_errors_action_note()}>
				<div>
					<Button variant="outline" onClick={() => action.mutate()} disabled={action.isPending}>
						{m.examples_errors_try()}
					</Button>
				</div>
			</Demo>
		</ExamplePage>
	);
}

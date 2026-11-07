import { createMiddleware } from "@tanstack/react-start";
import { DEV_ROUTES } from "@/lib/dev-routes";
import { AppError } from "@/lib/errors";

/** Refuses with NOT_FOUND unless the /dev pages exist (DEV_ROUTES is the constant false in a plain build). */
export const assertDev = () => {
	if (!DEV_ROUTES) throw new AppError("NOT_FOUND", "Not found");
};

/** Server functions that exist for the /dev pages only: NOT_FOUND in production. */
export const devOnlyMiddleware = createMiddleware({ type: "function" }).server(({ next }) => {
	assertDev();
	return next();
});

import { createLink } from "@tanstack/react-router";
import type { ComponentPropsWithRef } from "react";
import { cn } from "../../lib/cn";

/** A link in running text or a list: underlined, its line turns rhododendron on hover. Use TextLink for app routes. */
export function TextAnchor({ className, ...props }: ComponentPropsWithRef<"a">) {
	return <a {...props} className={cn("hm-focus hm-link font-medium", className)} />;
}

/** The one button shape (hm-button: square, filled, 48px) as an anchor. Use ButtonLink for app routes. */
export function ButtonAnchor({ className, ...props }: ComponentPropsWithRef<"a">) {
	return <a {...props} className={cn("hm-button", className)} />;
}

/** A router Link in running text (typed `to`, `params`, `search`). */
export const TextLink = createLink(TextAnchor);

/** A router Link drawn as the primary action. */
export const ButtonLink = createLink(ButtonAnchor);

/**
 * HTML that has been through the server-side rich-text sanitizer
 * (src/server/rich-text/sanitize.ts). The brand only exists at compile time:
 * nothing on the client can mint one, so `RichTextContent` (the only place that
 * sets innerHTML) can't be handed raw user input by mistake.
 */
export type SafeHtml = string & { readonly __brand: "SafeHtml" };

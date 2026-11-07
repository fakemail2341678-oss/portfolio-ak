/**
 * Component-test setup (runs for every file; only acts under jsdom, and only
 * loads Testing Library there, so server tests don't pay for it).
 * - jest-dom matchers (toBeInTheDocument, toHaveAttribute, …)
 * - unmount rendered trees between tests
 * - browser APIs that Radix UI, cmdk and input-otp use but jsdom doesn't implement
 */
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
	await import("@testing-library/jest-dom/vitest");
	const { cleanup } = await import("@testing-library/react");
	afterEach(() => cleanup());

	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver ??= ResizeObserverStub;

	// The sidebar asks whether this is a phone, ThemeSync for the OS theme: a wide, light screen.
	window.matchMedia ??= (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}) satisfies MediaQueryList;

	// The router restores scroll position on navigation; jsdom has no layout to scroll.
	window.scrollTo = () => {};

	const proto = window.HTMLElement.prototype;
	proto.scrollIntoView ??= () => {};
	proto.hasPointerCapture ??= () => false;
	proto.setPointerCapture ??= () => {};
	proto.releasePointerCapture ??= () => {};
	// input-otp probes for password-manager badges at a point next to the input.
	document.elementFromPoint ??= () => null;
	// ProseMirror (Tiptap) measures the selection to scroll it into view.
	const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
	Range.prototype.getClientRects ??= emptyRects;
	Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}

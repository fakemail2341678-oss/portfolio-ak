/**
 * The hero's cursor drift (decision 0181): pointer movement sets --hm-px and
 * --hm-py (each in [-1, 1]) on the range, and himal.css translates each band
 * of sheets by its depth. Loaded after hydration, on fine pointers only, for
 * readers who haven't asked for reduced motion; it does nothing while the
 * range is off screen. Returns a function that stops it.
 */
export function startDrift(element: HTMLElement): () => void {
	const wanted =
		window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!wanted) return () => {};
	let frame = 0;
	let x = 0;
	let y = 0;
	let visible = true;
	const apply = () => {
		frame = 0;
		element.style.setProperty("--hm-px", x.toFixed(3));
		element.style.setProperty("--hm-py", y.toFixed(3));
	};
	const move = (event: PointerEvent) => {
		x = (event.clientX / window.innerWidth) * 2 - 1;
		y = (event.clientY / window.innerHeight) * 2 - 1;
		if (visible && !frame) frame = window.requestAnimationFrame(apply);
	};
	const observer = new IntersectionObserver(([entry]) => {
		visible = entry?.isIntersecting ?? false;
	});
	observer.observe(element);
	window.addEventListener("pointermove", move, { passive: true });
	return () => {
		window.removeEventListener("pointermove", move);
		observer.disconnect();
		window.cancelAnimationFrame(frame);
	};
}

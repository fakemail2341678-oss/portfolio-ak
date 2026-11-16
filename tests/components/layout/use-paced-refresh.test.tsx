// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH_WAIT_MS, usePacedRefresh } from "@/hooks/use-paced-refresh";

/** "A burst of events reloads a route's data once" (PLAN 15, Task 102), asked of TanStack Pacer's throttle. */
describe("usePacedRefresh", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("runs the first request at once, and a burst after it once more when the wait ends", () => {
		const refresh = vi.fn();
		const { result } = renderHook(() => usePacedRefresh(refresh));
		act(() => result.current());
		expect(refresh).toHaveBeenCalledTimes(1);
		act(() => {
			for (let index = 0; index < 9; index++) result.current();
		});
		expect(refresh).toHaveBeenCalledTimes(1);
		act(() => {
			vi.advanceTimersByTime(REFRESH_WAIT_MS);
		});
		// Ten events: two reloads, the second after the last event.
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("adds no trailing reload after a single event, and runs at once again after the wait", () => {
		const refresh = vi.fn();
		const { result } = renderHook(() => usePacedRefresh(refresh));
		act(() => result.current());
		act(() => {
			vi.advanceTimersByTime(REFRESH_WAIT_MS * 2);
		});
		expect(refresh).toHaveBeenCalledTimes(1);
		act(() => result.current());
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it("calls the latest function, and drops a pending reload when the page unmounts", () => {
		const first = vi.fn();
		const second = vi.fn();
		const { result, rerender, unmount } = renderHook(({ refresh }) => usePacedRefresh(refresh), {
			initialProps: { refresh: first },
		});
		act(() => result.current());
		rerender({ refresh: second });
		act(() => result.current());
		unmount();
		act(() => {
			vi.advanceTimersByTime(REFRESH_WAIT_MS * 2);
		});
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).not.toHaveBeenCalled();
	});
});

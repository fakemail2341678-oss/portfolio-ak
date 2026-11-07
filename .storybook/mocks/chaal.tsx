import { type ReactNode, useLayoutEffect } from "react";

/**
 * Chaal's stories: the section on <html> (the root sets it from the brand in the app,
 * Task 73), with the visitor picks most likely to show through, which the section
 * must outrank.
 */
export function ChaalSection({ children }: { children: ReactNode }) {
	useLayoutEffect(() => {
		const { dataset } = document.documentElement;
		const { accent, radius } = dataset;
		dataset.section = "chaal";
		dataset.accent = "rose";
		dataset.radius = "round";
		return () => {
			delete dataset.section;
			if (accent) dataset.accent = accent;
			else delete dataset.accent;
			if (radius) dataset.radius = radius;
			else delete dataset.radius;
		};
	}, []);
	return children;
}

export const withChaal = (Story: () => ReactNode) => (
	<ChaalSection>
		<Story />
	</ChaalSection>
);

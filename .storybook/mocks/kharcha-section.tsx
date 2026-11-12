import { type ReactNode, useLayoutEffect } from "react";

/**
 * Kharcha's stories: the section on <html> (the root sets it from the brand in the app,
 * Task 88), with the visitor picks most likely to show through, which the section must
 * outrank.
 */
export function KharchaSection({ children }: { children: ReactNode }) {
	useLayoutEffect(() => {
		const { dataset } = document.documentElement;
		const { accent, radius } = dataset;
		dataset.section = "kharcha";
		dataset.accent = "emerald";
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

export const withKharcha = (Story: () => ReactNode) => (
	<KharchaSection>
		<Story />
	</KharchaSection>
);

import { createContext, type ReactNode, useContext } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** A form's outcome message on the account page. */
export type Status = { tone: "error" | "success"; text: string } | undefined;

export type AccountSectionProps = {
	id?: string;
	title: string;
	description?: string | undefined;
	children: ReactNode;
};

/**
 * How a section is drawn: a card by default; a product with a look of its own (Parda,
 * decision 0249) provides its own frame, and the sections' forms stay the same.
 */
const AccountSectionFrame = createContext<((props: AccountSectionProps) => ReactNode) | null>(null);

export const AccountSectionFrameProvider = AccountSectionFrame.Provider;

/** One section of the account page, with an h2 title (and an anchor id when it's linked to). */
export function AccountSection(props: AccountSectionProps) {
	const Frame = useContext(AccountSectionFrame);
	if (Frame) return <Frame {...props} />;
	const { id, title, description, children } = props;
	return (
		<Card id={id} className="scroll-mt-20">
			<CardHeader>
				<CardTitle>
					<h2>{title}</h2>
				</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardHeader>
			<CardContent className="flex flex-col gap-4">{children}</CardContent>
		</Card>
	);
}

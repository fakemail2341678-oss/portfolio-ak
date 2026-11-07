// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmProvider, useConfirm } from "@/components/dialogs/confirm";

function Asker({ onAnswer }: { onAnswer: (answer: boolean) => void }) {
	const confirm = useConfirm();
	return (
		<button
			type="button"
			onClick={async () => onAnswer(await confirm({ title: "Delete it?", description: "Gone for good." }))}
		>
			Ask
		</button>
	);
}

describe("useConfirm", () => {
	it("resolves true on confirm and false on cancel or Escape", async () => {
		const user = userEvent.setup();
		const onAnswer = vi.fn();
		render(
			<ConfirmProvider>
				<Asker onAnswer={onAnswer} />
			</ConfirmProvider>,
		);
		await user.click(screen.getByRole("button", { name: "Ask" }));
		expect(await screen.findByRole("alertdialog", { name: "Delete it?" })).toBeInTheDocument();
		await user.click(screen.getByTestId("confirm-action"));
		await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(true));

		await user.click(screen.getByRole("button", { name: "Ask" }));
		await user.click(await screen.findByRole("button", { name: "Cancel" }));
		await waitFor(() => expect(onAnswer).toHaveBeenLastCalledWith(false));

		await user.click(screen.getByRole("button", { name: "Ask" }));
		await screen.findByRole("alertdialog");
		await user.keyboard("{Escape}");
		await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(3));
		expect(onAnswer).toHaveBeenLastCalledWith(false);
	});

	it("needs a provider", () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		expect(() => render(<Asker onAnswer={() => {}} />)).toThrow(/ConfirmProvider/);
		vi.restoreAllMocks();
	});
});

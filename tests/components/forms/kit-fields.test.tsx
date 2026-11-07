// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useAppForm } from "@/components/forms";
import { AsyncComboboxField } from "@/components/forms/fields/async-combobox-field";
import { KeyValueField, SortableListField } from "@/components/forms/fields/list-fields";
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
import { renderField } from "./harness";

const withQuery = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
		{children}
	</QueryClientProvider>
);

describe("AsyncComboboxField", () => {
	it("searches on the server once typing pauses, and stores the chosen option's value", async () => {
		const search = vi.fn(async (q: string) =>
			[
				{ value: "ktm", label: "Kathmandu" },
				{ value: "ltp", label: "Lalitpur" },
			].filter((option) => option.label.toLowerCase().includes(q.toLowerCase())),
		);
		const { user, submit, onSubmit } = renderField(
			<AsyncComboboxField label="City" queryKey={["cities"]} search={search} debounceMs={300} />,
			{ defaultValue: "", schema: z.string(), wrapper: withQuery },
		);
		await user.click(screen.getByRole("combobox", { name: "City" }));
		await waitFor(() => expect(search).toHaveBeenCalledWith(""));
		await user.type(screen.getByPlaceholderText("Search…"), "lal");
		await waitFor(() => expect(search).toHaveBeenLastCalledWith("lal"));
		// The keystrokes in between never reached the server: the query waited for the pause.
		expect(search).not.toHaveBeenCalledWith("l");
		await user.click(await screen.findByRole("option", { name: "Lalitpur" }));
		expect(screen.getByRole("combobox", { name: "City" })).toHaveTextContent("Lalitpur");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("ltp");
	});
});

describe("SortableListField", () => {
	function Steps() {
		const form = useAppForm({ defaultValues: { steps: ["Plan", "Build", "Ship"] } });
		return (
			<form.AppForm>
				<form.Form>
					<form.AppField name="steps" mode="array">
						{() => (
							<SortableListField<string>
								label="Steps"
								addLabel="Add a step"
								newItem={() => ""}
								getItemLabel={(step) => step}
								renderItem={({ index }) => (
									<form.AppField name={`steps[${index}]`}>
										{(field) => <field.TextField label={`Step ${index + 1}`} />}
									</form.AppField>
								)}
							/>
						)}
					</form.AppField>
				</form.Form>
			</form.AppForm>
		);
	}
	const values = () => screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);

	it("moves an entry with Alt + arrow keys on its handle, and announces it", async () => {
		const user = userEvent.setup();
		render(<Steps />);
		screen.getByRole("button", { name: "Move Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(values()).toEqual(["Build", "Plan", "Ship"]);
		expect(screen.getByText("Plan moved to position 2 of 3.")).toBeInTheDocument();
		// The handle keeps focus, so the next press moves the same entry again.
		screen.getByRole("button", { name: "Move Plan" }).focus();
		await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
		expect(values()).toEqual(["Build", "Ship", "Plan"]);
	});

	it("adds and removes entries", async () => {
		const user = userEvent.setup();
		render(<Steps />);
		await user.click(screen.getByRole("button", { name: "Add a step" }));
		expect(values()).toEqual(["Plan", "Build", "Ship", ""]);
		await user.click(screen.getByRole("button", { name: "Remove Build" }));
		expect(values()).toEqual(["Plan", "Ship", ""]);
	});
});

describe("KeyValueField", () => {
	it("adds a row and submits the pairs", async () => {
		const { user, submit, onSubmit } = renderField(
			<KeyValueField label="Metadata" keyLabel="Name" valueLabel="Value" />,
			{
				defaultValue: [{ key: "source", value: "test" }],
				schema: z.array(z.object({ key: z.string().min(1), value: z.string() })),
			},
		);
		await user.click(screen.getByRole("button", { name: "Add a row" }));
		await user.type(screen.getByRole("textbox", { name: "Name 2" }), "lang");
		await user.type(screen.getByRole("textbox", { name: "Value 2" }), "ne");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith([
			{ key: "source", value: "test" },
			{ key: "lang", value: "ne" },
		]);
	});
});

describe("SlugField", () => {
	function TitleAndSlug({ slug = "" }: { slug?: string }) {
		const form = useAppForm({ defaultValues: { title: "", slug } });
		return (
			<form.AppForm>
				<form.Form>
					<form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
					<form.AppField name="slug">{() => <SlugField label="Slug" from="title" fromLabel="Title" />}</form.AppField>
				</form.Form>
			</form.AppForm>
		);
	}

	it("follows the title until edited by hand, and follows it again when linked", async () => {
		const user = userEvent.setup();
		render(<TitleAndSlug />);
		const slug = screen.getByRole("textbox", { name: "Slug" });
		await user.type(screen.getByRole("textbox", { name: "Title" }), "Momo Kitchen");
		expect(slug).toHaveValue("momo-kitchen");
		await user.type(slug, "-ktm");
		await user.type(screen.getByRole("textbox", { name: "Title" }), " 2");
		expect(slug).toHaveValue("momo-kitchen-ktm");
		const link = screen.getByRole("button", { name: "Follow the Title" });
		expect(link).toHaveAttribute("aria-pressed", "false");
		await user.click(link);
		expect(slug).toHaveValue("momo-kitchen-2");
	});

	it("leaves a saved slug alone on mount", () => {
		render(<TitleAndSlug slug="already-published" />);
		expect(within(document.body).getByRole("textbox", { name: "Slug" })).toHaveValue("already-published");
	});
});

describe("Form with an async validator", () => {
	it("submits once the validator settles, even when Save is pressed while it runs", async () => {
		const onSubmit = vi.fn();
		const isAvailable = vi.fn(async () => true);
		function SlugForm() {
			const form = useAppForm({ defaultValues: { title: "", slug: "" }, onSubmit: ({ value }) => onSubmit(value) });
			return (
				<form.AppForm>
					<form.Form>
						<form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
						<form.AppField name="slug" validators={slugValidators({ from: "title", isAvailable, debounceMs: 200 })}>
							{() => <SlugField label="Slug" from="title" fromLabel="Title" />}
						</form.AppField>
						<form.SubmitButton>Save</form.SubmitButton>
					</form.Form>
				</form.AppForm>
			);
		}
		const user = userEvent.setup();
		render(<SlugForm />);
		await user.type(screen.getByRole("textbox", { name: "Title" }), "Momo");
		// Within the debounce: the slug's check hasn't finished yet.
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: "Momo", slug: "momo" }));
		expect(isAvailable).toHaveBeenCalledWith("momo");
	});
});

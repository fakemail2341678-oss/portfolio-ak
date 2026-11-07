// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DateField, DateRangeField, normalizeTime, TimeField } from "@/components/forms/fields/date-fields";
import { dateRange, isoDate, time } from "@/lib/validation";
import { overwriteGetLocale } from "@/paraglide/runtime";
import { expectInvalid, renderField } from "./harness";

afterEach(() => {
	overwriteGetLocale(() => "en");
});

describe("DateField", () => {
	it("shows the stored date in the current language and picks a new one", async () => {
		const { user, submit, onSubmit } = renderField(<DateField label="Start" />, {
			defaultValue: "2026-03-10",
			schema: isoDate(),
		});
		const trigger = screen.getByLabelText("Start");
		expect(trigger).toHaveTextContent("Mar 10, 2026");
		await user.click(trigger);
		expect(await screen.findByText("March 2026")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Saturday, March 14, 2026" }));
		expect(trigger).toHaveTextContent("Mar 14, 2026");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("2026-03-14");
	});

	it("renders Nepali month names, weekdays and digits", async () => {
		overwriteGetLocale(() => "ne");
		const { user } = renderField(<DateField label="सुरु" />, { defaultValue: "2026-03-10", schema: isoDate() });
		const trigger = screen.getByLabelText("सुरु");
		expect(trigger).toHaveTextContent("२०२६");
		await user.click(trigger);
		expect(await screen.findByText("२०२६ मार्च")).toBeInTheDocument();
		expect(screen.getByText("आइत")).toBeInTheDocument();
		expect(screen.getAllByText("१४").length).toBeGreaterThan(0);
	});

	it("disables days outside min/max", async () => {
		const { user } = renderField(<DateField label="Start" min="2026-03-10" max="2026-03-20" />, {
			defaultValue: "2026-03-15",
			schema: isoDate(),
		});
		await user.click(screen.getByLabelText("Start"));
		expect(await screen.findByRole("button", { name: "Monday, March 9, 2026" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Tuesday, March 10, 2026" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Saturday, March 21, 2026" })).toBeDisabled();
	});

	it("reports a missing date", async () => {
		const { submit } = renderField(<DateField label="Start" />, { defaultValue: "", schema: isoDate() });
		await submit();
		expectInvalid(screen.getByLabelText("Start"), "Choose a date.");
	});
});

describe("DateRangeField", () => {
	it("selects a start and an end across two months", async () => {
		const { user, submit, onSubmit } = renderField(<DateRangeField label="Trip" />, {
			defaultValue: { from: "2026-03-10" },
			schema: dateRange(),
		});
		const trigger = screen.getByLabelText("Trip");
		await user.click(trigger);
		expect(await screen.findByText("March 2026")).toBeInTheDocument();
		expect(screen.getByText("April 2026")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Wednesday, April 15, 2026" }));
		expect(trigger).toHaveTextContent("Mar 10, 2026 to Apr 15, 2026");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith({ from: "2026-03-10", to: "2026-04-15" });
	});

	it("clears the range and reports it as missing", async () => {
		const { user, submit } = renderField(<DateRangeField label="Trip" />, {
			defaultValue: { from: "2026-03-10", to: "2026-03-12" },
			schema: dateRange(),
		});
		await user.click(screen.getByLabelText("Trip"));
		await user.click(await screen.findByRole("button", { name: "Clear" }));
		await submit();
		expectInvalid(screen.getByLabelText("Trip"), "Choose a start and an end date.");
	});
});

describe("TimeField", () => {
	it("normalizes typed times to HH:mm", () => {
		expect(normalizeTime("1430")).toBe("14:30");
		expect(normalizeTime("9:05")).toBe("09:05");
		expect(normalizeTime("१४:३०")).toBe("14:30");
		expect(normalizeTime("noon")).toBe("noon");
	});

	it("stores HH:mm and reformats the text on blur", async () => {
		const { user, submit, onSubmit } = renderField(<TimeField label="At" />, { defaultValue: "", schema: time() });
		const input = screen.getByLabelText("At");
		await user.type(input, "930");
		await user.tab();
		expect(input).toHaveValue("09:30");
		await submit();
		expect(onSubmit).toHaveBeenCalledWith("09:30");
	});

	it("shows Devanagari digits in Nepali", () => {
		overwriteGetLocale(() => "ne");
		renderField(<TimeField label="समय" />, { defaultValue: "14:30", schema: time() });
		expect(screen.getByLabelText("समय")).toHaveValue("१४:३०");
	});

	it("reports an invalid time", async () => {
		const { user, submit } = renderField(<TimeField label="At" />, { defaultValue: "", schema: time() });
		await user.type(screen.getByLabelText("At"), "25:00");
		await submit();
		expectInvalid(screen.getByLabelText("At"), "Enter a time in 24-hour format, like 14:30.");
	});
});

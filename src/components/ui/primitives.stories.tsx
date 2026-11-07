import type { Meta, StoryObj } from "@storybook/react-vite";
import { BoldIcon, InfoIcon, ItalicIcon, TriangleAlertIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { ButtonGroup } from "./button-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "./context-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { Progress } from "./progress";
import { ScrollArea } from "./scroll-area";
import { Spinner } from "./spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Toggle } from "./toggle";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

/** The shadcn primitives Task 37 added, restyled for Graphite (density, status tones). */
const meta = { title: "UI/Primitives", component: Alert } satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Alerts: Story = {
	render: () => (
		<div className="grid max-w-xl gap-3">
			{(["default", "info", "success", "warning", "destructive"] as const).map((variant) => (
				<Alert key={variant} variant={variant}>
					{variant === "destructive" || variant === "warning" ? (
						<TriangleAlertIcon aria-hidden />
					) : (
						<InfoIcon aria-hidden />
					)}
					<AlertTitle>{variant}</AlertTitle>
					<AlertDescription>Status text on its tint, 4.5:1 in every theme.</AlertDescription>
				</Alert>
			))}
		</div>
	),
};

export const TabsAndToggles: Story = {
	render: () => (
		<div className="flex flex-col gap-4">
			<Tabs defaultValue="one">
				<TabsList>
					<TabsTrigger value="one">Overview</TabsTrigger>
					<TabsTrigger value="two">Details</TabsTrigger>
				</TabsList>
				<TabsContent value="one">The overview.</TabsContent>
				<TabsContent value="two">The details.</TabsContent>
			</Tabs>
			<div className="flex gap-2">
				<Toggle aria-label="Bold" variant="outline">
					<BoldIcon aria-hidden />
				</Toggle>
				<ToggleGroup type="multiple" variant="outline" aria-label="Text style">
					<ToggleGroupItem value="bold" aria-label="Bold">
						<BoldIcon aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem value="italic" aria-label="Italic">
						<ItalicIcon aria-hidden />
					</ToggleGroupItem>
				</ToggleGroup>
				<ButtonGroup aria-label="Pages">
					<Button variant="outline">Previous</Button>
					<Button variant="outline">Next</Button>
				</ButtonGroup>
			</div>
		</div>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("tab", { name: "Details" }));
		await expect(canvas.getByText("The details.")).toBeVisible();
		const bold = canvas.getAllByRole("button", { name: "Bold" })[0];
		if (!bold) throw new Error("no toggle");
		await userEvent.click(bold);
		await expect(bold).toHaveAttribute("aria-pressed", "true");
	},
};

export const Disclosure: Story = {
	render: () => (
		<div className="flex max-w-md flex-col gap-4">
			<Accordion type="single" collapsible>
				<AccordionItem value="a">
					<AccordionTrigger>What is Graphite?</AccordionTrigger>
					<AccordionContent>The admin design system.</AccordionContent>
				</AccordionItem>
			</Accordion>
			<Collapsible>
				<CollapsibleTrigger asChild>
					<Button variant="outline">Show more</Button>
				</CollapsibleTrigger>
				<CollapsibleContent className="pt-2">More.</CollapsibleContent>
			</Collapsible>
		</div>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: "What is Graphite?" }));
		await expect(canvas.getByText("The admin design system.")).toBeVisible();
	},
};

export const Overlays: Story = {
	render: () => (
		<div className="flex flex-col items-start gap-4">
			<HoverCard>
				<HoverCardTrigger asChild>
					<a href="#profile" className="underline">
						Sita Rai
					</a>
				</HoverCardTrigger>
				<HoverCardContent>Editor since 2024.</HoverCardContent>
			</HoverCard>
			<ContextMenu modal={false}>
				<ContextMenuTrigger className="rounded-md border border-dashed p-6 text-sm">
					Right-click here
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuItem>Edit</ContextMenuItem>
					<ContextMenuItem variant="destructive">Delete</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenu>
		</div>
	),
	play: async ({ canvas, userEvent, canvasElement }) => {
		await userEvent.pointer({ keys: "[MouseRight]", target: canvas.getByText("Right-click here") });
		await expect(await within(canvasElement.ownerDocument.body).findByRole("menuitem", { name: "Edit" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
	},
};

export const Busy: Story = {
	render: () => (
		<div className="flex max-w-sm flex-col gap-4">
			<Progress value={60} aria-label="Upload" />
			<Spinner />
			<ScrollArea className="h-24 rounded-md border" label="Numbers">
				<ol className="p-3 text-sm">
					{Array.from({ length: 12 }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a static list of numbered lines.
						<li key={index}>Line {index + 1}</li>
					))}
				</ol>
			</ScrollArea>
		</div>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("progressbar", { name: "Upload" })).toHaveAttribute("aria-valuenow", "60");
	},
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { m } from "@/paraglide/messages";
import { withParda } from "../../../../.storybook/mocks/parda";
import { PosterCard } from "../kit/cards";
import { pardaLinks } from "../links";
import { PROFILE_AVATARS } from "../profiles/options";
import { ProfileAvatar } from "../profiles/profile-avatar";
import { ProfileFormDialog } from "../profiles/profile-form";
import type { ProfilesData } from "../profiles/types";
import { CardListToggle, HeartButton, ListButton, RateButtons } from "./save-buttons";

/**
 * Parda's library and profiles (Task 67, decision 0240): the buttons that save a title,
 * the profiles' pictures and the profile form. Nobody is signed in to the workshop, so
 * nothing shows as saved.
 */
const meta = {
	title: "Parda/Library",
	decorators: [withParda],
	parameters: { layout: "padded", app: { route: "/app/parda" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TITLE = { media: "movie" as const, id: 11, title: "A Quiet Orbit" };

/** The title page's row and a poster's corner button. */
export const SaveButtons: Story = {
	render: () => (
		<div className="flex flex-col gap-8 bg-pd-mask p-6 text-pd-ink">
			<div className="flex flex-wrap items-center gap-2">
				<ListButton title={TITLE} />
				<HeartButton title={TITLE} />
				<RateButtons title={TITLE} />
			</div>
			<div className="w-40">
				<PosterCard
					item={{ title: TITLE.title, year: 2024, poster: null }}
					link={pardaLinks.title("movie", 11, "a-quiet-orbit")}
					preview={false}
					action={<CardListToggle title={TITLE} />}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByTestId("list-toggle")).toHaveAttribute("aria-pressed", "false");
		await expect(canvas.getByTestId("card-list-toggle")).toHaveAccessibleName(m.pd_list_add({ title: TITLE.title }));
	},
};

/** Every picture, and a profile that chose none (its initial). */
export const Avatars: Story = {
	render: () => (
		<div className="flex flex-wrap items-end gap-4 bg-pd-mask p-6">
			{PROFILE_AVATARS.map((avatar) => (
				<ProfileAvatar key={avatar} avatar={avatar} name={avatar} size="lg" />
			))}
			<ProfileAvatar avatar={null} name="Asha" size="lg" />
			<ProfileAvatar avatar="sun" name="Asha" size="sm" />
		</div>
	),
};

const DATA: ProfilesData = {
	active: "00000000-0000-4000-8000-000000000000",
	canManage: true,
	profiles: [],
	max: 5,
	isGuest: false,
	digest: false,
	defaultCap: "PG",
	regions: [
		{ code: "IN", name: "India" },
		{ code: "US", name: "United States" },
	],
	languages: ["en", "ne"],
};

/** Adding a kids' profile: the cap appears once Kids is on. */
export const ProfileForm: Story = {
	render: () => (
		<ConfirmProvider>
			<ProfileFormDialog open onOpenChange={() => {}} profile={null} data={DATA} onSaved={async () => {}} />
		</ConfirmProvider>
	),
	play: async ({ canvasElement }) => {
		const body = within(canvasElement.ownerDocument.body);
		await expect(await body.findByTestId("profile-form")).toBeVisible();
	},
};

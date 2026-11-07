import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlayIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { expect, waitFor, within } from "storybook/test";
import { Rail, RailItem, RailSkeleton } from "@/components/data-display/rail";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import {
	sampleBillboard,
	sampleEpisodes,
	samplePeople,
	sampleTitles,
	withParda,
} from "../../../../.storybook/mocks/parda";
import { CertBadge, ProgressBar, RatingBadge } from "./badges";
import { Billboard, BillboardSkeleton } from "./billboard";
import {
	BackdropCard,
	BackdropCardSkeleton,
	EpisodeCard,
	EpisodeCardSkeleton,
	PersonCard,
	PersonCardSkeleton,
	PosterCard,
	PosterCardSkeleton,
} from "./cards";
import { Top10Rail, Top10RailSkeleton } from "./top10-rail";

/** Parda's media kit (PLAN Task 61) in "Masking": the pictures are drawn stand-ins, never TMDB's. */
const meta = {
	title: "Parda/Kit",
	decorators: [withParda],
	parameters: { layout: "fullscreen", app: { route: "/app/parda" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const home = { to: "/app/parda" } as const;
const POSTER = "w-36 sm:w-44 lg:w-48";

function Ground({ children }: { children: ReactNode }) {
	return <div className="min-h-dvh bg-pd-ground py-8 text-pd-ink">{children}</div>;
}

/** Posters in a rail: one without a poster (the title on a piece of mask), one with progress. */
export const Posters: Story = {
	render: () => (
		<Ground>
			<Rail title="Popular" titleClassName="pd-display text-pd-head">
				{sampleTitles.map((item, index) => (
					<RailItem key={item.key} className={POSTER}>
						<PosterCard item={item} link={home} progress={index === 1 ? 0.4 : undefined} />
					</RailItem>
				))}
			</Rail>
		</Ground>
	),
	play: async ({ canvas }) => {
		const region = canvas.getByRole("region", { name: "Popular" });
		await expect(within(region).getAllByTestId("poster-card")).toHaveLength(sampleTitles.length);
		await expect(within(region).getByTestId("tmdb-image-missing")).toHaveTextContent("Under the Old Pipal");
		await expect(within(region).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
		// The rail starts at its beginning: back is off until it moves.
		await expect(within(region).getByRole("button", { name: m.rail_previous({ title: "Popular" }) })).toBeDisabled();
	},
};

/** Resting on a poster with a mouse opens the preview: backdrop, year, genres, score, overview. */
export const PosterPreview: Story = {
	render: () => (
		<Ground>
			<div className="px-8">
				<div className={POSTER}>
					<PosterCard item={sampleTitles[0] ?? (undefined as never)} link={home} />
				</div>
			</div>
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		await userEvent.hover(canvas.getByTestId("poster-card"));
		const preview = await waitFor(() => within(document.body).getByTestId("poster-preview"), { timeout: 3000 });
		await expect(within(preview).getByText("The Long Monsoon")).toBeVisible();
		await expect(within(preview).getByText(/lighthouse keeper/)).toBeVisible();
	},
};

/** Today's Top 10: the rank in the lower mask under each poster. */
export const Top10: Story = {
	render: () => (
		<Ground>
			<Top10Rail title="Top 10 today" items={sampleTitles.map((item) => ({ key: item.key, item, link: home }))} />
		</Ground>
	),
	play: async ({ canvas }) => {
		const region = canvas.getByRole("region", { name: "Top 10 today" });
		await expect(within(region).getAllByRole("link")).toHaveLength(10);
		await expect(within(region).getByText(m.pd_top10_rank({ rank: formatNumber(1) }))).toBeInTheDocument();
	},
};

/** Wide cards (Continue watching), episodes and people. */
export const Wide: Story = {
	render: () => (
		<Ground>
			<div className="flex flex-col gap-10">
				<Rail title="Continue watching" titleClassName="pd-display text-pd-head">
					{sampleTitles.slice(0, 6).map((item, index) => (
						<RailItem key={item.key} className="w-64 lg:w-80">
							<BackdropCard
								title={item.title}
								detail={index % 2 ? "S1 · E3" : "1h 12m left"}
								backdrop={item.backdrop ?? null}
								link={home}
								progress={0.15 + index * 0.14}
							/>
						</RailItem>
					))}
				</Rail>
				<section className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
					<h2 className="pd-display text-pd-head">Season 1</h2>
					<ul className="flex max-w-3xl flex-col gap-4">
						{sampleEpisodes.map((item, index) => (
							<li key={item.episode}>
								<EpisodeCard item={item} link={home} progress={index === 0 ? 1 : index === 1 ? 0.5 : undefined} />
							</li>
						))}
					</ul>
				</section>
				<Rail title="Cast" titleClassName="pd-display text-pd-head">
					{samplePeople.map((person) => (
						<RailItem key={person.key} className="w-28 lg:w-36">
							<PersonCard name={person.name} role={person.role} profile={person.profile} link={home} />
						</RailItem>
					))}
				</Rail>
			</div>
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getAllByTestId("episode-card")).toHaveLength(sampleEpisodes.length);
		await expect(canvas.getAllByTestId("person-card")).toHaveLength(samplePeople.length);
		await expect(canvas.getAllByRole("progressbar").length).toBeGreaterThan(6);
	},
};

/** Score, certificate and progress, on the ground and on the mask. */
export const Badges: Story = {
	render: () => (
		<Ground>
			<div className="flex flex-col gap-6 px-8">
				{["bg-pd-ground", "bg-pd-mask"].map((ground) => (
					<div key={ground} className={`flex flex-wrap items-center gap-4 p-4 text-sm ${ground}`}>
						<RatingBadge rating={7.84} />
						<RatingBadge rating={0} />
						<CertBadge certification="PG-13" />
						<CertBadge certification="U/A 13+" />
						<ProgressBar value={0.62} className="w-40" />
					</div>
				))}
			</div>
		</Ground>
	),
	play: async ({ canvas }) => {
		// A score from no votes renders nothing: two grounds, one score each.
		await expect(canvas.getAllByText(/^(7.8|७.८)$/)).toHaveLength(2);
		await expect(canvas.getAllByRole("progressbar")).toHaveLength(2);
	},
};

/** The home's billboard: the screen between the masks, the tagline as a subtitle, the pause button. */
export const BillboardStory: Story = {
	name: "Billboard",
	render: () => (
		<Ground>
			<Billboard
				items={sampleBillboard}
				actions={() => (
					<>
						<Button size="lg">
							<PlayIcon aria-hidden className="fill-current" />
							Play
						</Button>
						<Button size="lg" variant="secondary">
							<PlusIcon aria-hidden />
							My list
						</Button>
					</>
				)}
			/>
		</Ground>
	),
	play: async ({ canvas, userEvent }) => {
		const billboard = canvas.getByTestId("billboard");
		await expect(within(billboard).getByRole("heading", { level: 2 })).toHaveTextContent("The Long Monsoon");
		const pause = within(billboard).getByTestId("billboard-pause");
		await expect(pause).toHaveAccessibleName(m.pd_billboard_pause());
		await userEvent.click(pause);
		await expect(pause).toHaveAccessibleName(m.pd_billboard_play());
		// A picker shows its slide, and only three pictures are ever in the page.
		const pickers = within(billboard).getAllByRole("button", { name: /Glass Harbour/ });
		await userEvent.click(pickers[0] ?? billboard);
		await expect(within(billboard).getByRole("heading", { level: 2 })).toHaveTextContent("Glass Harbour");
		await expect(billboard.querySelectorAll("img").length).toBeLessThanOrEqual(3);
	},
};

/** A title without a backdrop or a poster: its name on the mask, in display type. */
export const BillboardWithoutPicture: Story = {
	render: () => (
		<Ground>
			<Billboard
				items={[{ ...(sampleBillboard[2] ?? (undefined as never)), poster: null, backdrop: null, tagline: "" }]}
			/>
		</Ground>
	),
	play: async ({ canvas }) => {
		await expect(canvas.queryByTestId("billboard-pause")).toBeNull();
	},
};

/** Every skeleton, the size of what it stands for. */
export const Skeletons: Story = {
	render: () => (
		<Ground>
			<div className="flex flex-col gap-10">
				<BillboardSkeleton />
				<Top10RailSkeleton />
				<RailSkeleton item={<PosterCardSkeleton />} itemClassName={POSTER} />
				<RailSkeleton item={<BackdropCardSkeleton />} itemClassName="w-64 lg:w-80" count={4} />
				<div className="flex max-w-3xl flex-col gap-4 px-8">
					<EpisodeCardSkeleton />
					<EpisodeCardSkeleton />
				</div>
				<RailSkeleton item={<PersonCardSkeleton />} itemClassName="w-28 lg:w-36" />
			</div>
		</Ground>
	),
};

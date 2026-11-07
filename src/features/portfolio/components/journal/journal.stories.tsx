import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { demo, withPortfolioCanvas } from "../story-helpers";
import { WorkRow } from "../work/work-row";
import { ArticleBody } from "./article-body";
import { PostLine } from "./post-line";

/** Lists and the article body. */
const meta = {
	title: "Portfolio/Lists and articles",
	decorators: [withPortfolioCanvas],
	parameters: { layout: "fullscreen", app: { route: "/journal" } },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const JournalList: Story = {
	render: () => (
		<ul className="hm-container py-12">
			{demo().posts.map((post) => (
				<PostLine key={post.slug} post={post} headingLevel="h2" withExcerpt />
			))}
		</ul>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getAllByRole("link")).toHaveLength(6);
	},
};

export const Article: Story = {
	render: () => {
		const post = demo().posts.find((each) => each.slug === "designing-for-two-scripts");
		if (!post) throw new Error("demo post missing");
		return (
			<div className="hm-container py-12">
				<ArticleBody html={post.body} />
			</div>
		);
	},
};

export const WorkIndex: Story = {
	parameters: { app: { route: "/work" } },
	render: () => (
		<ul className="hm-container py-12">
			{demo().summaries.map((project) => (
				<WorkRow key={project.slug} project={project} />
			))}
		</ul>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getAllByRole("heading", { level: 2 })).toHaveLength(7);
	},
};

import type { Cover, Project } from "../../types";
import { CodeBlock } from "../content/code-block";
import { PullQuote } from "../content/pull-quote";
import { ArchitectureDiagram } from "./architecture-diagram";
import { Screens } from "./screens";

type CaseStudyBodyProps = {
	blocks: Project["body"];
	gallery: Project["gallery"];
	cover: Cover;
};

/**
 * The story of a project, block by block, each rising into view. Exhaustive:
 * a new block type fails typecheck until it has a renderer. The "Screens"
 * blocks take the gallery's images in order, one per caption.
 */
export function CaseStudyBody({ blocks, gallery, cover }: CaseStudyBodyProps) {
	// Where each Screens block starts in the gallery: the blocks take its images in order.
	const starts = new Map<string, number>();
	let next = 0;
	for (const block of blocks) {
		if (block.type !== "gallery") continue;
		starts.set(block.id, next);
		next += block.captions.length;
	}
	return (
		<div className="flex flex-col gap-[clamp(3.5rem,7vw,6rem)]">
			{blocks.map((block) => {
				switch (block.type) {
					case "chapter":
						return (
							<section key={block.id} lang={block.lang} className="hm-reveal flex flex-col gap-5">
								<h2 className="hm-display text-hm-lead">{block.title}</h2>
								{block.body.map((paragraph) => (
									<p key={paragraph} className="hm-measure text-hm-body">
										{paragraph}
									</p>
								))}
							</section>
						);
					case "quote":
						return <PullQuote key={block.id} text={block.text} cite={block.cite || undefined} className="hm-reveal" />;
					case "code":
						return (
							<CodeBlock
								key={block.id}
								code={block.code}
								language={block.language}
								caption={block.caption || undefined}
								className="hm-reveal"
							/>
						);
					case "architecture":
						return (
							<div key={block.id} className="hm-reveal">
								<ArchitectureDiagram block={block} />
							</div>
						);
					case "gallery": {
						const start = starts.get(block.id) ?? 0;
						const images = gallery.slice(start, start + block.captions.length);
						return (
							<div key={block.id} lang={block.lang} className="hm-reveal">
								<Screens captions={block.captions} images={images} cover={cover} />
							</div>
						);
					}
					default: {
						const unknown: never = block;
						return unknown;
					}
				}
			})}
		</div>
	);
}

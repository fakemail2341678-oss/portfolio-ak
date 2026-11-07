import { useStore } from "@tanstack/react-form";
import { BlocksIcon, CodeIcon, ImagesIcon, NetworkIcon, QuoteIcon } from "lucide-react";
import { withForm } from "@/components/forms";
import { BlocksField, SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { ARCHITECTURE_TIERS, CODE_LANGUAGES } from "../../constants";
import type { CaseStudyBlockRecord } from "../../schema";
import { TIER_LABELS } from "../labels";
import { projectFormOptions } from "./project-form-options";

const EMPTY = { en: "", ne: "" };
const newId = () => crypto.randomUUID();

/** A new, empty block of each type (BlocksField's "Add block" menu). */
const create = {
	chapter: (): CaseStudyBlockRecord => ({ id: newId(), type: "chapter", title: EMPTY, body: [EMPTY] }),
	quote: (): CaseStudyBlockRecord => ({ id: newId(), type: "quote", text: EMPTY, cite: "" }),
	code: (): CaseStudyBlockRecord => ({ id: newId(), type: "code", language: "ts", caption: EMPTY, code: "" }),
	architecture: (): CaseStudyBlockRecord => ({
		id: newId(),
		type: "architecture",
		caption: EMPTY,
		nodes: [
			{ id: "client", label: EMPTY, detail: "", tier: "client" },
			{ id: "server", label: EMPTY, detail: "", tier: "service" },
		],
		edges: [{ from: "client", to: "server" }],
	}),
	gallery: (): CaseStudyBlockRecord => ({ id: newId(), type: "gallery", captions: [EMPTY, EMPTY] }),
};

/**
 * The case study's body (decision 0176): typed blocks in a BlocksField, each
 * with its own fields, reordered by drag or Alt + ↑/↓. The same Zod schema
 * (caseStudyBlockSchema) checks them here and on the server.
 */
export const CaseStudyBlocks = withForm({
	...projectFormOptions(),
	render: function CaseStudyBlocks({ form }) {
		const n = (index: number) => formatNumber(index + 1);
		return (
			<form.AppField name="blocks" mode="array">
				{() => (
					<BlocksField<CaseStudyBlockRecord>
						label={m.portfolio_admin_field_blocks()}
						description={m.portfolio_admin_field_blocks_description()}
						optional
						max={40}
						types={{
							chapter: {
								label: m.portfolio_admin_block_chapter,
								icon: <BlocksIcon aria-hidden />,
								create: create.chapter as () => Extract<CaseStudyBlockRecord, { type: "chapter" }>,
								summary: (block) => block.title.en,
								render: ({ index }) => (
									<>
										<LocalizedField
											form={form}
											fields={`blocks[${index}].title`}
											label={m.portfolio_admin_field_title()}
										/>
										<form.AppField name={`blocks[${index}].body`} mode="array">
											{() => (
												<SortableListField<{ en: string; ne: string }>
													label={m.portfolio_admin_field_paragraphs()}
													addLabel={m.portfolio_admin_add_paragraph()}
													newItem={() => EMPTY}
													getItemLabel={(_, position) => m.portfolio_admin_paragraph_n({ n: n(position) })}
													max={12}
													renderItem={({ index: position }) => (
														<LocalizedField
															form={form}
															fields={`blocks[${index}].body[${position}]`}
															label={m.portfolio_admin_paragraph_n({ n: n(position) })}
															multiline
														/>
													)}
												/>
											)}
										</form.AppField>
									</>
								),
							},
							quote: {
								label: m.portfolio_admin_block_quote,
								icon: <QuoteIcon aria-hidden />,
								create: create.quote as () => Extract<CaseStudyBlockRecord, { type: "quote" }>,
								summary: (block) => block.text.en,
								render: ({ index }) => (
									<>
										<LocalizedField
											form={form}
											fields={`blocks[${index}].text`}
											label={m.portfolio_admin_field_quote()}
											multiline
										/>
										<form.AppField name={`blocks[${index}].cite`}>
											{(field) => <field.TextField label={m.portfolio_admin_field_cite()} optional maxLength={120} />}
										</form.AppField>
									</>
								),
							},
							code: {
								label: m.portfolio_admin_block_code,
								icon: <CodeIcon aria-hidden />,
								create: create.code as () => Extract<CaseStudyBlockRecord, { type: "code" }>,
								summary: (block) => block.caption.en || block.language,
								render: ({ index }) => (
									<>
										<form.AppField name={`blocks[${index}].language`}>
											{(field) => (
												<field.SelectField
													label={m.portfolio_admin_field_language()}
													options={CODE_LANGUAGES.map((language) => ({ value: language, label: language }))}
												/>
											)}
										</form.AppField>
										<form.AppField name={`blocks[${index}].code`}>
											{(field) => (
												<field.TextareaField label={m.portfolio_admin_field_code()} rows={8} maxLength={4000} />
											)}
										</form.AppField>
										<LocalizedField
											form={form}
											fields={`blocks[${index}].caption`}
											label={m.portfolio_admin_field_caption()}
											optional
										/>
									</>
								),
							},
							architecture: {
								label: m.portfolio_admin_block_architecture,
								icon: <NetworkIcon aria-hidden />,
								create: create.architecture as () => Extract<CaseStudyBlockRecord, { type: "architecture" }>,
								summary: (block) => block.caption.en,
								render: ({ index }) => <ArchitectureFields form={form} index={index} />,
							},
							gallery: {
								label: m.portfolio_admin_block_gallery,
								icon: <ImagesIcon aria-hidden />,
								create: create.gallery as () => Extract<CaseStudyBlockRecord, { type: "gallery" }>,
								summary: (block) => block.captions.map((caption) => caption.en).join(" · "),
								render: ({ index }) => (
									<form.AppField name={`blocks[${index}].captions`} mode="array">
										{() => (
											<SortableListField<{ en: string; ne: string }>
												label={m.portfolio_admin_field_screens()}
												description={m.portfolio_admin_field_screens_description()}
												addLabel={m.portfolio_admin_add_screen()}
												newItem={() => EMPTY}
												max={4}
												renderItem={({ index: position }) => (
													<LocalizedField
														form={form}
														fields={`blocks[${index}].captions[${position}]`}
														label={m.portfolio_admin_screen_n({ n: n(position) })}
													/>
												)}
											/>
										)}
									</form.AppField>
								),
							},
						}}
					/>
				)}
			</form.AppField>
		);
	},
});

/** An architecture block: its caption, its nodes (in tiers) and the flows between them. */
const ArchitectureFields = withForm({
	...projectFormOptions(),
	props: { index: 0 },
	render: function ArchitectureFields({ form, index }) {
		const nodes = useStore(form.store, (state) => {
			const block = state.values.blocks[index];
			return block?.type === "architecture" ? block.nodes : [];
		});
		const nodeOptions = nodes
			.filter((node) => node.id)
			.map((node) => ({ value: node.id, label: node.label.en ? `${node.label.en} (${node.id})` : node.id }));
		const tierOptions = ARCHITECTURE_TIERS.map((tier) => ({ value: tier, label: TIER_LABELS[tier]() }));
		const n = (position: number) => formatNumber(position + 1);
		return (
			<>
				<LocalizedField form={form} fields={`blocks[${index}].caption`} label={m.portfolio_admin_field_caption()} />
				<form.AppField name={`blocks[${index}].nodes`} mode="array">
					{() => (
						<SortableListField<{ id: string; label: { en: string; ne: string }; detail: string; tier: string }>
							label={m.portfolio_admin_field_nodes()}
							addLabel={m.portfolio_admin_add_node()}
							newItem={() => ({ id: "", label: EMPTY, detail: "", tier: "service" })}
							getItemLabel={(node, position) => node.id || m.portfolio_admin_node_n({ n: n(position) })}
							max={12}
							renderItem={({ index: position }) => (
								<div className="grid gap-3 sm:grid-cols-2">
									<form.AppField name={`blocks[${index}].nodes[${position}].id`}>
										{(field) => (
											<field.TextField
												label={m.portfolio_admin_field_node_id()}
												description={m.portfolio_admin_field_node_id_description()}
												maxLength={32}
											/>
										)}
									</form.AppField>
									<form.AppField name={`blocks[${index}].nodes[${position}].tier`}>
										{(field) => <field.SelectField label={m.portfolio_admin_field_tier()} options={tierOptions} />}
									</form.AppField>
									<div className="sm:col-span-2">
										<LocalizedField
											form={form}
											fields={`blocks[${index}].nodes[${position}].label`}
											label={m.portfolio_admin_field_label()}
										/>
									</div>
									<form.AppField name={`blocks[${index}].nodes[${position}].detail`}>
										{(field) => <field.TextField label={m.portfolio_admin_field_node_detail()} maxLength={60} />}
									</form.AppField>
								</div>
							)}
						/>
					)}
				</form.AppField>
				<form.AppField name={`blocks[${index}].edges`} mode="array">
					{() => (
						<SortableListField<{ from: string; to: string }>
							label={m.portfolio_admin_field_edges()}
							addLabel={m.portfolio_admin_add_edge()}
							newItem={() => ({ from: nodes[0]?.id ?? "", to: nodes[1]?.id ?? "" })}
							getItemLabel={(edge, position) =>
								edge.from && edge.to ? `${edge.from} → ${edge.to}` : m.portfolio_admin_edge_n({ n: n(position) })
							}
							max={24}
							renderItem={({ index: position }) => (
								<div className="grid gap-3 sm:grid-cols-2">
									<form.AppField name={`blocks[${index}].edges[${position}].from`}>
										{(field) => <field.SelectField label={m.portfolio_admin_field_edge_from()} options={nodeOptions} />}
									</form.AppField>
									<form.AppField name={`blocks[${index}].edges[${position}].to`}>
										{(field) => <field.SelectField label={m.portfolio_admin_field_edge_to()} options={nodeOptions} />}
									</form.AppField>
								</div>
							)}
						/>
					)}
				</form.AppField>
			</>
		);
	},
});

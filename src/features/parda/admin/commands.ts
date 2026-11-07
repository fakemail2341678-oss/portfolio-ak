import { BanIcon, GalleryHorizontalIcon, LayersIcon, PlusIcon } from "lucide-react";
import type { AdminCommand } from "@/features/admin/commands";
import { m } from "@/paraglide/messages";

/** Parda's actions in the command palette and on the dashboard (src/features/admin/commands.ts). */
export const pardaCommands: ReadonlyArray<AdminCommand> = [
	{
		id: "parda.source.new",
		label: m.command_parda_source_new,
		icon: PlusIcon,
		permission: "parda:configure",
		to: "/admin/parda/sources/new",
		keywords: m.command_parda_source_new_keywords,
	},
	{
		id: "parda.title.block",
		label: m.command_parda_title_block,
		icon: BanIcon,
		permission: "parda:moderate",
		to: "/admin/parda/titles/new",
		keywords: m.command_parda_title_block_keywords,
	},
	{
		id: "parda.billboard.new",
		label: m.command_parda_billboard_new,
		icon: GalleryHorizontalIcon,
		permission: "parda:curate",
		to: "/admin/parda/billboard/new",
		keywords: m.command_parda_billboard_new_keywords,
	},
	{
		id: "parda.collection.new",
		label: m.command_parda_collection_new,
		icon: LayersIcon,
		permission: "parda:curate",
		to: "/admin/parda/collections/new",
		keywords: m.command_parda_collection_new_keywords,
	},
];

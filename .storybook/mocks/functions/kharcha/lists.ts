import { fn } from "storybook/test";
import type { KharchaLists } from "../../../../src/features/kharcha/types";
import { sampleKharchaLists } from "../../kharcha";

// Stand-ins for src/functions/kharcha/lists.ts: every change answers with the lists.
const lists = async (): Promise<KharchaLists> => sampleKharchaLists;
export const getKharchaLists = fn(lists).mockName("getKharchaLists");
export const createKharchaCategory = fn(lists).mockName("createKharchaCategory");
export const updateKharchaCategory = fn(lists).mockName("updateKharchaCategory");
export const deleteKharchaCategory = fn(lists).mockName("deleteKharchaCategory");
export const reorderKharchaCategories = fn(lists).mockName("reorderKharchaCategories");
export const createKharchaTag = fn(lists).mockName("createKharchaTag");
export const updateKharchaTag = fn(lists).mockName("updateKharchaTag");
export const deleteKharchaTag = fn(lists).mockName("deleteKharchaTag");
export const createKharchaMethod = fn(lists).mockName("createKharchaMethod");
export const updateKharchaMethod = fn(lists).mockName("updateKharchaMethod");
export const deleteKharchaMethod = fn(lists).mockName("deleteKharchaMethod");
export const reorderKharchaMethods = fn(lists).mockName("reorderKharchaMethods");
export const createKharchaRule = fn(lists).mockName("createKharchaRule");
export const updateKharchaRule = fn(lists).mockName("updateKharchaRule");
export const deleteKharchaRule = fn(lists).mockName("deleteKharchaRule");
export const reorderKharchaRules = fn(lists).mockName("reorderKharchaRules");

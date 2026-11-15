import { isTasklineProjectKeyFree } from "@/functions/taskline-admin/projects";

/** The create form's check while typing. */
export const isProjectKeyFree = (key: string) => isTasklineProjectKeyFree({ data: { key } });

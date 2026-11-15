import type { ExampleTaskSearch } from "./schema";

export const exampleKeys = {
	all: ["examples"] as const,
	snapshot: () => [...exampleKeys.all, "snapshot"] as const,
	tasks: () => [...exampleKeys.all, "tasks"] as const,
	taskList: (search: ExampleTaskSearch) => [...exampleKeys.tasks(), "list", search] as const,
	task: (id: string) => [...exampleKeys.tasks(), "detail", id] as const,
};

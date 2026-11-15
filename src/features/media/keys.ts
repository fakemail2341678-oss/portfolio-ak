import { createCrudKeys } from "@/lib/crud/keys";
import type { MediaListInput } from "./search";

/** The media library's keys (the shared shape), reads and writes. */
export const mediaKeys = createCrudKeys<MediaListInput>("media");

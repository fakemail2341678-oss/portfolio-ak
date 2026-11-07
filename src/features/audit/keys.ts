import { createCrudKeys } from "@/lib/crud/keys";
import type { AuditListInput } from "./search";

/** The audit log's Query keys (the shared shape, src/lib/crud/keys.ts). */
export const auditKeys = createCrudKeys<AuditListInput>("audit");

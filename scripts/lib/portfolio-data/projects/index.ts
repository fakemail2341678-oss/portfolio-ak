import type { ProjectRecord } from "../types.ts";
import { ferry } from "./ferry.ts";
import { haat } from "./haat.ts";
import { jaldhara } from "./jaldhara.ts";
import { khoj } from "./khoj.ts";
import { ledgerline } from "./ledgerline.ts";
import { pahadUi } from "./pahad-ui.ts";
import { sangam } from "./sangam.ts";

/** One file per case study. Seeded newest year first; this order breaks ties. */
export const projects: ProjectRecord[] = [ledgerline, khoj, haat, sangam, ferry, jaldhara, pahadUi];

/** A game's and a player's pages on lichess.org: every Lichess game and profile links there (PLAN 13.6). */
export const lichessGameUrl = (id: string) => `https://lichess.org/${id}`;
export const lichessPlayerUrl = (username: string) => `https://lichess.org/@/${username}`;

/** The `rel` of a link to someone's page or what they wrote (PLAN 13.6, "Untrusted text"). */
export const UGC_REL = "nofollow ugc noopener";

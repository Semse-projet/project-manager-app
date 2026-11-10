/**
 * Org.type is a free-form string and two spellings of the professional kind
 * exist in real data: sign-up and the seed write the role key ("PRO"), while
 * the actor-context and bid paths provision "pro". Every lookup of a
 * professional's org must accept both, or a registered professional's org is
 * never found (e.g. contract creation refuses an accepted reservation).
 */
export const PROFESSIONAL_ORG_TYPE_FILTER = { equals: "pro", mode: "insensitive" } as const;

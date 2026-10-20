/** Secret stays client-only. Do not persist it or put it into redirects. */
export function invitationLink(origin: string, token: string): string {
  return `${origin}/invitations/accept#token=${encodeURIComponent(token)}`;
}

export function consumeInvitationToken(url: URL, scrub: (cleanPath: string) => void): string | null {
  const legacy = url.searchParams.has("token");
  const values = new URLSearchParams(url.hash.slice(1)).getAll("token");
  url.searchParams.delete("token");
  scrub(url.pathname + url.search);
  const token = values.length === 1 ? values[0] : "";
  return !legacy && /^[A-Za-z0-9_.-]{10,200}$/.test(token) ? token : null;
}

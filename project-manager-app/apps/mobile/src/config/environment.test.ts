import { resolveApiBaseUrl } from "./environment";

describe("one API origin for every mobile surface", () => {
  test("uses production when neither historical variable is set", () => {
    expect(resolveApiBaseUrl({})).toBe("https://api.semseproject.com");
  });
  test("normalizes either historical variable and accepts equivalent values", () => {
    expect(resolveApiBaseUrl({ canonical: "https://api.semseproject.com/v1/" })).toBe("https://api.semseproject.com");
    expect(resolveApiBaseUrl({ legacy: "https://api.semseproject.com/" })).toBe("https://api.semseproject.com");
    expect(resolveApiBaseUrl({ canonical: "https://api.semseproject.com/", legacy: "https://api.semseproject.com/v1" })).toBe("https://api.semseproject.com");
  });
  test("rejects conflicting backends", () => {
    expect(() => resolveApiBaseUrl({ canonical: "https://one.example", legacy: "https://two.example" })).toThrow(/distintas/);
  });
  test.each(["https://user:password@api.example", "https://api.example?token=secret", "https://api.example/#token", "file:///tmp/api", "https://api.example/other", "not-a-url", "http://public.example"]) (
    "rejects an unsafe API origin without echoing its value: %s", (canonical) => {
      expect(() => resolveApiBaseUrl({ canonical })).toThrow(/URL/);
    },
  );
  test("allows explicit LAN HTTP only in development", () => {
    expect(resolveApiBaseUrl({ canonical: "http://192.168.1.10:4132", development: true })).toBe("http://192.168.1.10:4132");
    expect(() => resolveApiBaseUrl({ canonical: "http://192.168.1.10:4132" })).toThrow(/URL/);
  });
});

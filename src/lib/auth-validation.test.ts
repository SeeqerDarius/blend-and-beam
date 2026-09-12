import { describe, expect, it } from "vitest";
import { credentials, signupCredentials, safeNext } from "./auth-validation";

describe("authentication input boundaries", () => {
  it.each(["https://evil.example", "//evil.example", "/account/../../evil", "/admin?next=https://evil.example", "/account%2f%2fevil", null, 1])("rejects unsafe return path %s", value => {
    expect(safeNext(value)).toBe("/account");
  });
  it.each(["/admin", "/admin/products", "/account/security"])("allows internal destination %s", value => {
    expect(safeNext(value)).toBe(value);
  });
  it("requires a longer password for new customer accounts", () => {
    expect(signupCredentials.safeParse({ email: "customer@example.com", password: "short" }).success).toBe(false);
    expect(signupCredentials.safeParse({ email: "customer@example.com", password: "a long passphrase" }).success).toBe(true);
  });
  it("strips role injection from credentials", () => {
    expect(credentials.parse({ email: "customer@example.com", password: "existing", role: "Super Admin", is_admin: true })).toEqual({ email: "customer@example.com", password: "existing" });
  });
});

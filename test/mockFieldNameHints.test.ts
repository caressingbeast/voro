import { describe, expect, test } from "vitest";
import { z } from "zod/v4";

import { TypeMocker } from "../src/utils/mock";
import { ZodParser } from "../src/utils/zodParser";

/** Fixed seed so faker output is stable enough for shape assertions */
const SEED = 42_4242;

function strField(key: string) {
  return { [key]: { type: "string" as const, optional: false, metadata: {} } };
}

describe("TypeMocker field-name hints (getKeyFromName → faker)", () => {
  test("address-like fields use street-style strings", () => {
    for (const key of ["address1", "billingAddress", "ship_address"]) {
      const m = new TypeMocker(strField(key), SEED).mock();
      const v = (m as any)[key] as string;
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(4);
    }
  });

  test("city, country, state, zip look like location data", () => {
    const schema = {
      city: { type: "string" as const, optional: false, metadata: {} },
      country: { type: "string" as const, optional: false, metadata: {} },
      state: { type: "string" as const, optional: false, metadata: {} },
      zip: { type: "string" as const, optional: false, metadata: {} },
    };
    const m = new TypeMocker(schema, SEED).mock();
    expect(m.city.length).toBeGreaterThan(2);
    expect(m.country).toBe("United States");
    expect(m.state.length).toBeGreaterThan(1);
    expect(m.zip.length).toBeGreaterThan(2);
  });

  test("nested z.object .describe(@voro.locale) applies to that object’s mocks", () => {
    const schema = z.object({
      address: z
        .object({ country: z.string(), city: z.string() })
        .describe("@voro.locale en_GB"),
    });
    const spec = new ZodParser("").extractProperties(schema as any);
    const m = new TypeMocker(spec, SEED).mock();
    expect((m as any).address.country).toBe("United Kingdom");
  });

  test("country field matches @voro.locale primary country", () => {
    const schema = {
      country: { type: "string" as const, optional: false, metadata: {} },
    };
    expect(new TypeMocker(schema, SEED).mock().country).toBe("United States");
    expect(new TypeMocker(schema, SEED, "de").mock().country).toBe("Germany");
  });

  test("email and url fields", () => {
    const m = new TypeMocker(
      {
        contactEmail: { type: "string", optional: false, metadata: {} },
        websiteUrl: { type: "string", optional: false, metadata: {} },
      },
      SEED
    ).mock();
    expect(m.contactEmail).toMatch(/@/);
    expect(m.websiteUrl).toMatch(/^https?:\/\//);
  });

  test("name fields use person-like strings", () => {
    const m = new TypeMocker(strField("displayName"), SEED).mock();
    expect(m.displayName.length).toBeGreaterThan(3);
    expect(/\s/.test(m.displayName)).toBe(true);
  });

  test("firstName and lastName are single-token person names", () => {
    const m = new TypeMocker(
      {
        firstName: { type: "string", optional: false, metadata: {} },
        last_name: { type: "string", optional: false, metadata: {} },
      },
      SEED
    ).mock();
    expect(m.firstName.length).toBeGreaterThan(1);
    expect(/\s/.test(m.firstName)).toBe(false);
    expect(m.last_name.length).toBeGreaterThan(1);
    expect(/\s/.test(m.last_name)).toBe(false);
  });

  test("username-like fields avoid full-name spaces", () => {
    for (const key of ["username", "login", "githubHandle"]) {
      const m = new TypeMocker(strField(key), SEED).mock();
      const v = (m as any)[key] as string;
      expect(v.length).toBeGreaterThan(0);
      expect(/\s/.test(v)).toBe(false);
    }
  });

  test("id-suffixed fields use UUID shape", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const key of ["id", "userId", "requestId"]) {
      const m = new TypeMocker(strField(key), SEED).mock();
      expect((m as any)[key]).toMatch(uuid);
    }
  });

  test("date-like field names use ISO datetime strings", () => {
    for (const key of ["createdAt", "updatedAt", "eventDate"]) {
      const m = new TypeMocker(strField(key), SEED).mock();
      const t = new Date((m as any)[key]).getTime();
      expect(Number.isNaN(t)).toBe(false);
    }
  });

  test("company, description, password, phone, image", () => {
    const schema = {
      companyName: { type: "string", optional: false, metadata: {} },
      longDescription: { type: "string", optional: false, metadata: {} },
      secretPassword: { type: "string", optional: false, metadata: {} },
      mobilePhone: { type: "string", optional: false, metadata: {} },
      avatarImage: { type: "string", optional: false, metadata: {} },
    };
    const m = new TypeMocker(schema, SEED).mock();
    expect(m.companyName.length).toBeGreaterThan(2);
    expect(m.longDescription.length).toBeGreaterThan(40);
    expect(m.secretPassword.length).toBeGreaterThan(3);
    expect(/\d/.test(m.mobilePhone)).toBe(true);
    expect(m.avatarImage).toMatch(/^https?:\/\//);
  });

  test("generic field falls back to lorem word", () => {
    const m = new TypeMocker(strField("foo"), SEED).mock();
    expect(typeof m.foo).toBe("string");
    expect(m.foo.length).toBeGreaterThan(0);
  });

  test("explicit minLength still uses alphanumeric, not street address", () => {
    const m = new TypeMocker(
      {
        address1: {
          type: "string",
          optional: false,
          metadata: { minLength: 8, maxLength: 8 },
        },
      },
      SEED
    ).mock();
    expect(m.address1).toHaveLength(8);
    expect(m.address1).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

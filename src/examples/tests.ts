import { z } from "zod/v4";

export interface BasicUser {
  id: string;
  age: number;
  isAdmin: boolean;
  name: string;
  status: "active" | "inactive" | "pending";
  tags: string[];
  createdAt: string;
};

export interface MetadataUser {
  /** @voro.format uuid */
  id: string;
  /** @voro.range 18 30 */
  age: number;
  isAdmin: boolean;
  /** @voro.format name */
  name: string;
  status: "active" | "inactive" | "pending";
  /** @voro.length 3 */
  tags: string[];
  /** @voro.date past */
  createdAt: string;
}

interface Address {
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface NestedUser {
  id: string;
  address: Address;
  name: string;
}

export const BasicUserSchema = z.object({
  id: z.uuid({ version: "v4" }),
  age: z.number(),
  isAdmin: z.boolean(),
  name: z.string(),
  status: z.enum(["active", "inactive", "pending"]),
  tags: z.array(z.string()),
  createdAt: z.iso.datetime()
});

export const MetadataUserSchema = z.object({
  id: z.uuid({ version: "v4" }),
  age: z.number().min(18).max(30),
  isAdmin: z.boolean(),
  name: z.string().describe(`@voro.format name`),
  status: z.enum(["active", "inactive", "pending"]),
  tags: z.array(z.string()).describe(`@voro.length 3`),
  createdAt: z.iso.datetime().describe(`@voro.date past`)
});

const AddressSchema = z.object({
  address1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string()
});

export const NestedUserSchema = z.object({
  id: z.uuid({ version: "v4" }),
  address: AddressSchema,
  name: z.string()
});
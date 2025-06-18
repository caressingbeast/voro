import { z } from "zod/v4";

const Address = z.object({
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string()
});

export const User = z.object({
  id: z.uuid({ version: "v4" }),
  address: Address,
  age: z.number().min(18).max(75),
  email: z.email(),
  isAdmin: z.boolean(),
  name: z.string(),
  status: z.enum(["active", "pending"]),
  createdAt: z.iso.datetime(),
});

export const Message = z.object({
  id: z.uuid({ version: "v4" }),
  tags: z.array(z.string()),
  text: z.string(),
  user: User,
  createdAt: z.iso.datetime()
});
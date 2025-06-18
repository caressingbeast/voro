import { z } from "zod/v4";

const Address = z.object({
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  state: z.string().describe(`@voro.value "Arizona"`),
  zip: z.string(),
  country: z.string()
});

export const User = z.object({
  id: z.uuid({ version: "v4" }),
  address: Address,
  age: z.number().min(18).max(75),
  email: z.email(),
  isAdmin: z.boolean(),
  name: z.string().describe(`@voro.format name`),
  status: z.enum(["active", "inactive", "pending"]),
  createdAt: z.iso.datetime().describe(`@voro.date past`),
});

export const Message = z.object({
  id: z.uuid({ version: "v4" }),
  tags: z.array(z.string()).describe(`@voro.length 3`),
  text: z.string().describe(`@voro.format paragraph`),
  user: User,
  createdAt: z.iso.datetime().describe(`@voro.date past`)
});
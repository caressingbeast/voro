import {z} from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().describe(`@voro.format name`),
});

export type UserType = z.infer<typeof userSchema>;
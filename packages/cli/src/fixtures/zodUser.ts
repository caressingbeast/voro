import { z } from "zod/v3";

const Profile = z.object({
  username: z.string(),
  description: z.string()
});

export const User = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  profile: Profile,
  status: z.enum(["active", "inactive"])
});
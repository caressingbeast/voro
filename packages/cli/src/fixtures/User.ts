export type Profile = {
  username: string;
  description: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  profile: Profile;
  status: "active" | "inactive";
};
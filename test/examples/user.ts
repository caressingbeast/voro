type Address = {
  address1: string;
  address2?: string;
  city: string;
  /** @voro.value Arizona */
  state: string;
  zip: string;
  country: string;
}

export type User = {
  /** @voro.format uuid */
  id: string;
  address: Address;
  /** @voro.range 18 75 */
  age: number;
  email: string;
  isAdmin: boolean;
  /** @voro.format name */
  name: string;
  status: "active" | "inactive" | "pending";
  mockFunction: () => {},
  /** @voro.date past */
  createdAt: string;
}

export interface Message {
  /** @voro.format uuid */
  id: string;
  /** @voro.length 3 */
  tags: string[];
  /** @voro.format paragraph */
  text: string;
  user: User;
  /** @voro.date past */
  createdAt: string
}
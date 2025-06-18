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
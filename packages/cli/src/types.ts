export type JSONSchema = {
  $ref?: string;
  definitions?: Record<string, JSONSchema>;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema | JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  enum?: (string | number | boolean | null)[];
  // Add other fields if needed
  [key: string]: any;
};

export type Options = {
  file: string;
  name?: string;
  type?: string;
  out?: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  profile: {
    username: string;
    description: string;
  };
  status: "active" | "inactive";
};

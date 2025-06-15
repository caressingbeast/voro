export type JSONSchema = {
  $ref?: string;
  additionalProperties?: boolean | JSONSchema;
  enum?: (string | number | boolean | null)[];
  items?: JSONSchema | JSONSchema[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  type?: string | string[];
  // Add other fields if needed
  [key: string]: any;
};

export type Options = {
  file: string;
  name?: string;
  type?: string;
  out?: string;
};

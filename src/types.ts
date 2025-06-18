export type VoroMetadata = {
  [key: string]: string | { min: number; max: number };
};

export type PropertySpec = {
  type:
  | string
  | string[]
  | PropertySpec[]
  | Record<string, PropertySpec>;
  optional: boolean;
  metadata: VoroMetadata;
};
export interface BetterAuthSchema {
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

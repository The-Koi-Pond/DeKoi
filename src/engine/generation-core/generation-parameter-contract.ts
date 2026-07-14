export type GenerationJsonValue =
  null | boolean | string | number | GenerationJsonValue[] | { [key: string]: GenerationJsonValue };

export type GenerationReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type GenerationVerbosity = "low" | "medium" | "high" | "xhigh" | "max";
export type GenerationServiceTier =
  "auto" | "default" | "flex" | "scale" | "priority" | "standard_only";

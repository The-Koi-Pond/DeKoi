export type RemoteRuntimeHealthCheck =
  | { status: "ok"; message: string }
  | { status: "unconfigured"; message: string }
  | { status: "invalid"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "not-writable"; message: string };

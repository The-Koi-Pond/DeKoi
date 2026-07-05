export function resolveControlMacro(name: string) {
  switch (name) {
    case "noop":
    case "banned":
      return "";
    default:
      return null;
  }
}

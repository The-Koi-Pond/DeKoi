export function downloadJsonFile({ data, filename }: { data: unknown; filename: string }) {
  if (typeof document === "undefined") {
    throw new Error("JSON download requires a browser document.");
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

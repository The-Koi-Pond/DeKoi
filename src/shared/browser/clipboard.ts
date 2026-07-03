/**
 * Copy text to the system clipboard. Resolves `true` when the write succeeds,
 * `false` when the Clipboard API is unavailable or the write is rejected
 * (permission denied, document not focused, non-secure context, etc.).
 *
 * Rejections are swallowed here so a blocked clipboard never surfaces an
 * unhandled promise rejection; callers decide whether to surface failure.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

import type { ThreadReleaseRequest } from "../types";
import { ThreadReleaseDialog } from "./ThreadReleaseDialog";

interface ThreadReleaseDialogHostProps {
  request: ThreadReleaseRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ThreadReleaseDialogHost({
  request,
  onCancel,
  onConfirm,
}: ThreadReleaseDialogHostProps) {
  if (!request) {
    return null;
  }

  return (
    <ThreadReleaseDialog
      request={request}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

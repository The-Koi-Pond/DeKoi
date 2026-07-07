export function generationOriginStillExists<TThread extends { id: string }>({
  itemId,
  selectItems,
  threadId,
  threads,
}: {
  itemId: string;
  selectItems: (thread: TThread) => readonly { id: string }[];
  threadId: string;
  threads: readonly TThread[];
}) {
  const thread = threads.find((candidate) => candidate.id === threadId);

  return !!thread && selectItems(thread).some((item) => item.id === itemId);
}

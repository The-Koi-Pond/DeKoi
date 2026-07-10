export function reconcileSelectedOptionIds(
  currentOptionIds: readonly string[],
  selectedOptionIds: readonly string[],
) {
  const selected = new Set(selectedOptionIds);
  const reconciled: string[] = [];
  const seen = new Set<string>();

  for (const optionId of currentOptionIds) {
    if (!selected.has(optionId) || seen.has(optionId)) continue;
    seen.add(optionId);
    reconciled.push(optionId);
  }
  for (const optionId of selectedOptionIds) {
    if (seen.has(optionId)) continue;
    seen.add(optionId);
    reconciled.push(optionId);
  }

  return reconciled;
}

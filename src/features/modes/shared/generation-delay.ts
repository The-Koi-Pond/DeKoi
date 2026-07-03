const MIN_TYPING_DELAY_MS = 1400;
const MAX_TYPING_DELAY_MS = 14000;
const MS_PER_CHARACTER = 75;
const MS_PER_WORD = 220;

function estimateGeneratedTypingDelay(text: string) {
  const trimmedText = text.trim();
  const typedCharacters = trimmedText.length;
  const typedWords = trimmedText ? trimmedText.split(/\s+/).length : 0;
  return Math.min(
    MAX_TYPING_DELAY_MS,
    MIN_TYPING_DELAY_MS + typedCharacters * MS_PER_CHARACTER + typedWords * MS_PER_WORD,
  );
}

export function waitForGeneratedTypingDelay(text: string) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, estimateGeneratedTypingDelay(text));
  });
}

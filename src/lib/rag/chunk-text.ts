export function chunkText(params: {
  text: string;
  maxChars?: number;
  overlapChars?: number;
}) {
  const maxChars = params.maxChars ?? 1200;
  const overlapChars = params.overlapChars ?? 150;

  const text = params.text.trim();

  if (text.length === 0) {
    return [];
  }

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= text.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}

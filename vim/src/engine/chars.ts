/** Vim default 'iskeyword' (@,48-57,_,192-255), extended to any Unicode letter or digit. */
export function isWordChar(c: string): boolean {
  if (c === '_') return true;
  if (c.length === 0) return false;
  const code = c.charCodeAt(0);
  if (code < 128) return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
  return /[\p{L}\p{N}]/u.test(c);
}

export function isWhite(c: string | undefined): boolean {
  return c === ' ' || c === '\t';
}

/** Index of first non-blank char; len when the line is all blanks. */
export function firstNonBlankIdx(line: string): number {
  let i = 0;
  while (i < line.length && isWhite(line[i])) i++;
  return i;
}

/** Column Vim's beginline(BL_WHITE | BL_FIX) lands on: first non-blank, never past the last char. */
export function firstNonBlankCol(line: string): number {
  const i = firstNonBlankIdx(line);
  return line.length > 0 && i >= line.length ? line.length - 1 : i;
}

export function toggleCase(c: string): string {
  const up = c.toUpperCase();
  return c === up ? c.toLowerCase() : up;
}

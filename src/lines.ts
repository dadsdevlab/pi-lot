export function pushLines(buffer: string, chunk: string, onLine: (line: string) => void): string {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl >= 0) {
    const line = buffer.slice(0, nl).replace(/\r$/, "");
    buffer = buffer.slice(nl + 1);
    if (line) onLine(line);
    nl = buffer.indexOf("\n");
  }
  return buffer;
}

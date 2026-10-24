export function downloadCsv(filename: string, rows: readonly (readonly unknown[])[]) {
  const content = rows.map((row) => row.map((value) => {
    let cell = String(value ?? "");
    if (/^[\t\r ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let quoteClosed = false;

  function finishCell() {
    row.push(cell);
    cell = "";
    quoteClosed = false;
  }

  function finishRow() {
    finishCell();
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
  }

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        cell += character;
      }
    } else if (quoteClosed) {
      if (character === ",") finishCell();
      else if (character === "\n" || character === "\r") {
        finishRow();
        if (character === "\r" && content[index + 1] === "\n") index += 1;
      } else if (character !== " " && character !== "\t") {
        throw new Error("The CSV has characters after a closing quote.");
      }
    } else if (character === '"') {
      if (cell.length !== 0) throw new Error("The CSV has a quote inside an unquoted value.");
      quoted = true;
    } else if (character === ",") {
      finishCell();
    } else if (character === "\n" || character === "\r") {
      finishRow();
      if (character === "\r" && content[index + 1] === "\n") index += 1;
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  finishCell();
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) throw new Error("The CSV file is empty.");
  return rows;
}

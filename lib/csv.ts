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

// CSV, by hand. The roster export is a safety feature (CLAUDE.md: if the
// app breaks in December, mum falls back to a spreadsheet), so it has no
// dependency to go wrong. Two functions: turn rows into text, and hand the
// text to the browser as a download.

// `columns` is a list of [key, heading]. Every value is quoted if it holds
// a comma, a quote or a line break; quotes inside are doubled. That is the
// whole CSV standard that matters.
//
// One more rule, because a spreadsheet is a program: a cell that starts
// with = + - @ or a tab is a formula to Excel and Google Sheets, and the
// household summary is text a stranger typed. Such a cell gets a leading
// apostrophe, which spreadsheets read as "this is text", and is quoted.
export function toCsv(rows, columns) {
  const escape = (value) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map(([, heading]) => escape(heading)).join(",")];
  for (const row of rows) {
    lines.push(columns.map(([key]) => escape(row[key])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

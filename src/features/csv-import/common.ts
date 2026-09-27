export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ja-JP");
}

export function normalizeText(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim();
}

export function parseNumber(value: string | undefined): number | null {
  const cleaned = normalizeText(value)
    .replace(/[￥$¥,\s]/g, "")
    .replace(/[−ー]/g, "-");
  if (!cleaned || cleaned === "-" || cleaned === "--") return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return Number.NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function isoDate(value: string | undefined): string | null {
  const s = normalizeText(value);
  const m = s.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})日?$/);
  if (!m) return null;
  const year = Number(m[1]),
    month = Number(m[2]),
    day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T12:00:00.000Z`;
}

export type CsvRecord = { cells: string[]; sourceRowNumber: number };

export function parseCsvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [],
    cell = "";
  let state: "plain" | "quoted" | "closed" = "plain";
  let line = 1,
    rowStart = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === "quoted") {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') state = "closed";
      else {
        cell += c;
        if (c === "\r" || c === "\n") {
          if (c === "\r" && text[i + 1] === "\n") {
            cell += "\n";
            i++;
          }
          line++;
        }
      }
      continue;
    }
    if (c === ",") {
      cells.push(cell);
      cell = "";
      state = "plain";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cells.push(cell);
      records.push({ cells, sourceRowNumber: rowStart });
      cells = [];
      cell = "";
      state = "plain";
      line++;
      rowStart = line;
    } else if (c === '"' && state === "plain" && cell.length === 0)
      state = "quoted";
    else if (state === "closed" || c === '"')
      throw new Error(`行 ${line}: CSVの引用符の形式が正しくありません。`);
    else cell += c;
  }
  if (state === "quoted") throw new Error("CSVの引用符が閉じていません。");
  if (cell.length || cells.length || state === "closed") {
    cells.push(cell);
    records.push({ cells, sourceRowNumber: rowStart });
  }
  return records;
}

export function headerIndex(rows: string[][], required: string[]): number {
  return rows.findIndex((row) => required.every((h) => row.includes(h)));
}

export function normalizeAccount(value: string | undefined): string | null {
  const v = normalizeText(value);
  if (!v) return null;
  if (/^NISA/.test(v)) {
    const compact = v.replace(/預り|[()\s]/g, "");
    if (compact === "NISA成長投資枠") return "NISA 成長投資枠";
    if (compact === "NISAつみたて投資枠") return "NISA つみたて投資枠";
    if (compact === "NISA") return "NISA";
    return v;
  }
  if (/^特定/.test(v)) return "特定";
  if (/^一般/.test(v)) return "一般";
  if (/^つみたてNISA$/.test(v)) return "NISA つみたて";
  return v;
}

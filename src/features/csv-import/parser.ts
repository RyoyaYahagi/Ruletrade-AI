import { headerIndex, parseCsvRecords } from "./common";
import { parseNomura } from "./adapters/nomura";
import { parseRakuten } from "./adapters/rakuten";
import { parseSbi } from "./adapters/sbi";
import type { CsvFormat, ParsedCsv } from "./types";

export class CsvFormatError extends Error {
  constructor(message = "CSV形式を判定できませんでした。") {
    super(message);
    this.name = "CsvFormatError";
  }
}

export class UnsupportedCsvFormatError extends Error {
  readonly format: "rakuten-investment-fund";
  constructor() {
    super(
      "このCSVは投資信託の取引履歴です。Ruletradeでは現在、投資信託はインポート対象外です。",
    );
    this.name = "UnsupportedCsvFormatError";
    this.format = "rakuten-investment-fund";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;

function decode(bytes: Uint8Array): {
  rawCsv: string;
  rawEncoding: ParsedCsv["rawEncoding"];
} {
  const bom =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf;
  if (bom)
    return {
      rawCsv: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      rawEncoding: "utf-8-bom",
    };
  try {
    return {
      rawCsv: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      rawEncoding: "utf-8",
    };
  } catch {
    return {
      rawCsv: new TextDecoder("shift_jis", { fatal: true }).decode(bytes),
      rawEncoding: "cp932",
    };
  }
}

function detect(rows: string[][]): { format: CsvFormat; header: number } {
  const jp = [
    "約定日",
    "受渡日",
    "銘柄コード",
    "銘柄名",
    "取引区分",
    "売買区分",
    "数量［株］",
    "単価［円］",
  ];
  const us = [
    "約定日",
    "受渡日",
    "ティッカー",
    "銘柄名",
    "取引区分",
    "売買区分",
    "数量［株］",
    "単価［USドル］",
  ];
  const inv = ["約定日", "受渡日", "ファンド名", "口座", "取引", "数量［口］"];
  const sbi = [
    "約定日",
    "銘柄",
    "銘柄コード",
    "取引",
    "約定数量",
    "約定単価",
    "受渡日",
  ];
  const nomura = [
    "約定日",
    "受渡日",
    "商品",
    "銘柄コード",
    "銘柄名",
    "取引区分",
    "数量",
    "単価",
    "手数料（税込）",
  ];
  const matches = [
    ["rakuten-jp", headerIndex(rows, jp)],
    ["rakuten-us", headerIndex(rows, us)],
    ["rakuten-investment-fund", headerIndex(rows, inv)],
    ["sbi-jp", headerIndex(rows, sbi)],
    ["nomura-jp", headerIndex(rows, nomura)],
  ].filter(([, index]) => (index as number) >= 0) as [CsvFormat, number][];
  if (matches.length !== 1) throw new CsvFormatError();
  return { format: matches[0][0], header: matches[0][1] };
}

export function parseCsv(bytes: Uint8Array): ParsedCsv {
  if (bytes.byteLength > MAX_BYTES)
    throw new Error("CSVファイルは10 MB以下にしてください。");
  const decoded = decode(bytes);
  const records = parseCsvRecords(decoded.rawCsv.replace(/^\uFEFF/, ""));
  const rows = records.map(({ cells }) => cells);
  const { format, header } = detect(rows);
  if (format === "rakuten-investment-fund")
    throw new UnsupportedCsvFormatError();
  const parsed =
    format === "rakuten-jp" || format === "rakuten-us"
      ? {
          ...parseRakuten(
            rows,
            header,
            format,
            records.map(({ sourceRowNumber }) => sourceRowNumber),
          ),
          broker: "rakuten" as const,
        }
      : format === "sbi-jp"
        ? {
            ...parseSbi(
              rows,
              header,
              records.map(({ sourceRowNumber }) => sourceRowNumber),
            ),
            broker: "sbi" as const,
          }
        : {
            ...parseNomura(
              rows,
              header,
              records.map(({ sourceRowNumber }) => sourceRowNumber),
            ),
            broker: "nomura" as const,
          };
  return { ...decoded, format, ...parsed };
}

export { normalizeName } from "./common";
export type {
  Broker,
  CsvFormat,
  ExcludedRow,
  NormalizedTransaction,
  ParsedCsv,
  UnknownRow,
} from "./types";

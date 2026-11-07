// 投資信託協会の基準価額CSVは「年月日,基準価額(円),純資産総額（百万円）,分配金,決算期」の形で、
// 基準価額は1万口あたりの円。取り込んだ取引の単価は1口あたりなので、ここで1口あたりに直す。
const NAV_UNITS = 10_000;
const ROW = /^(\d{4})年(\d{2})月(\d{2})日,(\d+(?:\.\d+)?),/;

export function parseFundNavCsv(
  text: string,
): { price: number; priceAt: string } | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  for (let i = lines.length - 1; i > 0; i--) {
    const m = lines[i].match(ROW);
    if (!m) continue;
    const nav = Number(m[4]);
    if (!Number.isFinite(nav) || nav <= 0) return null;
    // 基準価額はその営業日の東証の取引終了後に算出される値として、日付の15時（日本時間）を時点にする
    return {
      price: nav / NAV_UNITS,
      priceAt: new Date(`${m[1]}-${m[2]}-${m[3]}T15:00:00+09:00`).toISOString(),
    };
  }
  return null;
}

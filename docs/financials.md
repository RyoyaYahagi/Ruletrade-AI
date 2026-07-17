# 財務数値

`financial_statements` はユーザー間で共有する開示数値のテーブルです。銘柄・市場・会計期間・出典をキーに保存し、売上やEPSなど取得できない項目は `null` のまま扱います。`0` への置換は未取得と報告済みゼロを区別できなくなるため行いません。

決算資料本文はユーザー所有の RAG (`earnings_report`) に保存し、財務数値は SQL から取得します。これにより、意味検索が必要な事業説明と、期間キーで厳密に参照する数値を混同しません。

## Provider v1

既定値は `FINANCIALS_PROVIDER=mock` です。週次 cron は保有・ウォッチ銘柄を Mock provider から取得して保存できます。管理者は `/api/admin/financials` に `manual` の数値を登録できます。

EDINET provider は v1 では XBRL の主要項目パーサーを実装していません。`FINANCIALS_PROVIDER=edinet` を指定すると未実装エラーを返し、Mock や手入力へ自動フォールバックしません。XBRL要素の同義語・単位・連結範囲を検証する作業を別変更として扱うためです。

画面とAIには開示された事実だけを渡し、業績評価・将来見通し・売買示唆は生成しません。

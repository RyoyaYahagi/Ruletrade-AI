import { describe, expect, it } from "vitest";

import { convertHtmlToMarkdown } from "@/lib/html/html-to-markdown";

describe("convertHtmlToMarkdown", () => {
  it("記事本文をMarkdownに変換し、ナビゲーションを除外する", () => {
    const result = convertHtmlToMarkdown({
      url: "https://example.com/article",
      html: `
        <html>
          <head><title>記事</title></head>
          <body>
            <nav>トップへ戻る</nav>
            <article>
              <h1>事業方針</h1>
              <p>主力事業の受注は前年同期比で増加しました。</p>
              <h2>今後の見通し</h2>
              <p>設備稼働率を継続して確認します。</p>
            </article>
            <footer>Copyright</footer>
          </body>
        </html>
      `,
    });

    expect(result.usedReadability).toBe(true);
    expect(result.markdown).toContain("# 事業方針");
    expect(result.markdown).toContain("## 今後の見通し");
    expect(result.markdown).toContain("主力事業の受注は前年同期比で増加しました。");
    expect(result.markdown).not.toContain("トップへ戻る");
    expect(result.markdown).not.toContain("Copyright");
  });

  it("非記事ページはbodyにフォールバックし、不要な要素を除外する", () => {
    const result = convertHtmlToMarkdown({
      url: "https://example.com/ir",
      html: `
        <html><body>
          <div class="menu"></div>
          <script>window.secret = "ignored";</script>
          <div class="ir-links"><img src="ir.png" alt="IR資料" /></div>
          <footer>フッター</footer>
        </body></html>
      `,
    });

    expect(result.usedReadability).toBe(false);
    expect(result.markdown).toContain("![IR資料](ir.png)");
    expect(result.markdown).not.toContain("window.secret");
    expect(result.markdown).not.toContain("フッター");
  });

  it("HTMLエンティティを復号する", () => {
    const result = convertHtmlToMarkdown({
      url: "https://example.com/article",
      html: "<article><p>A &amp; B&nbsp; &lt;確認&gt;</p></article>",
    });

    expect(result.markdown).toContain("A & B");
    expect(result.markdown).toContain("<確認>");
  });

  it("途中で切れたHTMLでも例外を投げない", () => {
    expect(() =>
      convertHtmlToMarkdown({
        url: "https://example.com/article",
        html: "<html><body><article><h1>見出し</h1><p>本文が途中で終わる",
      }),
    ).not.toThrow();
  });
});

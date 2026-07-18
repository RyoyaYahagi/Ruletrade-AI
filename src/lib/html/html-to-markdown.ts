import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export function convertHtmlToMarkdown(params: { html: string; url: string }): {
  markdown: string;
  usedReadability: boolean;
} {
  const document = new JSDOM(params.html, { url: params.url });
  const article = new Readability(document.window.document).parse();
  const articleHtml = article?.content;

  // Readability can mutate the parsed document. Re-parse before the body fallback so
  // non-article IR landing pages still retain their content without the reader pass.
  const sourceHtml =
    articleHtml ??
    new JSDOM(params.html, { url: params.url }).window.document.body?.innerHTML ??
    params.html;

  const turndown = new TurndownService({ headingStyle: "atx" });
  turndown.remove([
    "script",
    "style",
    "nav",
    "header",
    "footer",
    "aside",
    "noscript",
    "iframe",
    "form",
  ]);

  return {
    markdown: turndown.turndown(sourceHtml).replace(/\n{3,}/g, "\n\n").trim(),
    usedReadability: Boolean(articleHtml),
  };
}

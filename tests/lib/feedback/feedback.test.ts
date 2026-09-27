import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyFeedback } from "@/lib/feedback/classify";
import {
  createFeedbackIssue,
  formatFeedbackIssue,
} from "@/lib/feedback/github";
import {
  feedbackMetadataSchema,
  unclassifiedFeedback,
} from "@/schemas/feedback";

const fetchMock = vi.fn();
const answers = {
  category: { type: "choice", choice: "data_problem" },
  area: { type: "choice", choice: "import" },
  severity: { type: "score", score: 2.1 },
  needsClarification: { type: "noul", noul: 0.2 },
};
const classified = {
  category: "data_problem",
  area: "import",
  severity: 2,
  needsClarification: false,
  classificationSource: "jev",
} as const;
const input = {
  message: "  CSVの後に銘柄が重複します。\n原文を残してください。  ",
  inputMethod: "voice",
} as const;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("JEV_GATEWAY_URL", "");
  vi.stubEnv("JEV_GATEWAY_TOKEN", "");
  vi.stubEnv("TYPESAFE_API_KEY", "test-jev-secret");
  vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "test-github-secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Jev classification", () => {
  it("validates official answers and converts Score and Noul", async () => {
    fetchMock.mockResolvedValue(Response.json({ answers }));
    expect(await classifyFeedback(input.message)).toEqual(classified);
    const [endpoint, request] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://api.typesafe.ai/v1/systemone");
    expect(JSON.parse(request.body).state.feedback).toBe(input.message);
    expect(JSON.parse(request.body).questions.severity.criteria).toHaveLength(
      4,
    );
  });
  it("supports the local gateway without upstream credentials", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    vi.stubEnv("JEV_GATEWAY_URL", "http://127.0.0.1:4789/v1/systemone");
    fetchMock.mockResolvedValue(Response.json({ answers }));
    expect(await classifyFeedback("問題")).toEqual(classified);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("does not call the API when no credentials or gateway are configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("continues on API errors and network errors", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("secret error", { status: 500 }))
      .mockRejectedValueOnce(new Error("network secret"));
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
  });
  it("aborts a stalled request after three seconds", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockImplementationOnce((ms) => {
      expect(ms).toBe(3000);
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    fetchMock.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("timeout"))),
        ),
    );
    const result = classifyFeedback("問題");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toEqual(unclassifiedFeedback);
    expect(controller.signal.aborted).toBe(true);
  });
  it.each([
    { severity: { type: "score", score: -1 } },
    { severity: { type: "score", score: 3.1 } },
    { severity: { type: "score", score: "2" } },
    { category: { type: "choice", choice: "invented" } },
    { area: { type: "choice", choice: "invented" } },
    { needsClarification: { type: "noul", noul: 2 } },
    { needsClarification: { type: "noul", noul: false } },
  ])("rejects invalid response values %j", async (invalid) => {
    fetchMock.mockResolvedValue(
      Response.json({ answers: { ...answers, ...invalid } }),
    );
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
  });
  it("rejects malformed JSON and missing answers", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{"));
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
    fetchMock.mockResolvedValueOnce(Response.json({}));
    expect(await classifyFeedback("問題")).toEqual(unclassifiedFeedback);
  });
});

describe("GitHub feedback issues", () => {
  it("preserves original text and appends validated metadata and deterministic titles", () => {
    const issue = formatFeedbackIssue(input, classified);
    expect(issue.title).toBe(
      "[Feedback][data_problem] CSVの後に銘柄が重複します。 原文を残してください。",
    );
    expect(issue.body).toContain(`## 問い合わせ内容\n\n${input.message}\n\n`);
    const metadata = JSON.parse(
      issue.body.split("<!-- ruletrade-feedback:v1\n")[1].split("\n-->")[0],
    );
    expect(feedbackMetadataSchema.parse(metadata)).toEqual({
      ...classified,
      inputMethod: "voice",
    });
    expect(
      formatFeedbackIssue({ ...input, message: "あ".repeat(70) }, classified)
        .title,
    ).toBe("[Feedback][data_problem] " + "あ".repeat(50));
  });
  it("creates unclassified issues and returns only the number and canonical URL", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ number: 123, token: "must not return" }),
      )
      .mockResolvedValueOnce(new Response("", { status: 422 }));
    expect(await createFeedbackIssue(input, unclassifiedFeedback)).toEqual({
      number: 123,
      url: "https://github.com/RyoyaYahagi/Ruletrade-AI/issues/123",
    });
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers.Authorization).toBe("Bearer test-github-secret");
    const issue = JSON.parse(request.body);
    expect(issue.title).not.toContain("[other]");
    expect(issue.body).toContain('"severity": null');
    expect(issue.body).toContain('"classificationSource": "none"');
    expect(issue.body).not.toContain("secret");
    expect(issue.labels).toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      labels: ["feedback"],
    });
  });
  it("keeps creation successful even when label assignment throws", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ number: 124 }))
      .mockRejectedValueOnce(new Error("labels failed"));
    expect((await createFeedbackIssue(input, classified)).number).toBe(124);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).labels).toEqual([
      "feedback",
      "feedback:data",
    ]);
  });
  it("fails explicitly on missing token and API failure without retrying creation", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "");
    await expect(createFeedbackIssue(input, classified)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "secret");
    fetchMock.mockResolvedValue(
      new Response("sensitive details", { status: 403 }),
    );
    await expect(createFeedbackIssue(input, classified)).rejects.toThrow(
      "GitHub issue creation failed",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid metadata rather than storing inconsistent classifications", () => {
    expect(
      feedbackMetadataSchema.safeParse({
        ...classified,
        severity: 4,
        inputMethod: "text",
      }).success,
    ).toBe(false);
    expect(
      feedbackMetadataSchema.safeParse({
        ...unclassifiedFeedback,
        severity: 2,
        inputMethod: "text",
      }).success,
    ).toBe(false);
  });
});

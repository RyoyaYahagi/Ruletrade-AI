import { beforeEach, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({
  previewCsv: vi.fn(),
  importCsv: vi.fn(),
  undoImport: vi.fn(),
}));
vi.mock("@/features/csv-import/service", () => service);
import { POST } from "@/app/api/import/route";

beforeEach(() => vi.resetAllMocks());
const upload = (operation: string, digest?: string) => {
  const form = new FormData();
  form.set("operation", operation);
  form.set(
    "file",
    new File(["artificial,csv"], "fiction.csv", { type: "text/csv" }),
  );
  if (digest) form.set("digest", digest);
  return new Request("http://localhost/api/import", {
    method: "POST",
    body: form,
  });
};
it("previews without saving and awaits parsed results", async () => {
  service.previewCsv.mockResolvedValue({
    counts: { new: 1 },
    digest: "preview",
  });
  const response = await POST(upload("preview"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ digest: "preview" });
  expect(service.importCsv).not.toHaveBeenCalled();
});
it("requires a preview digest before committing", async () => {
  expect((await POST(upload("import"))).status).toBe(400);
  expect(service.importCsv).not.toHaveBeenCalled();
  service.importCsv.mockResolvedValue({ importedCount: 1 });
  expect((await POST(upload("import", "digest"))).status).toBe(200);
  expect(service.importCsv).toHaveBeenCalledWith(
    expect.any(Uint8Array),
    "fiction.csv",
    "digest",
    [],
  );
});
it("rejects cross-origin requests and oversized files before parsing", async () => {
  const crossOrigin = upload("import", "digest");
  crossOrigin.headers.set("origin", "https://unrelated.example");
  expect((await POST(crossOrigin)).status).toBe(403);
  const form = new FormData();
  form.set("operation", "preview");
  form.set(
    "file",
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.csv"),
  );
  expect(
    (
      await POST(
        new Request("http://localhost/api/import", {
          method: "POST",
          body: form,
        }),
      )
    ).status,
  ).toBe(413);
  expect(service.previewCsv).not.toHaveBeenCalled();
});
it("returns parser errors and limits undo to its batch identifier", async () => {
  service.previewCsv.mockRejectedValue(new Error("投資信託は対象外です。"));
  const response = await POST(upload("preview"));
  expect(await response.json()).toEqual({ error: "投資信託は対象外です。" });
  const form = new FormData();
  form.set("operation", "undo");
  form.set("batchId", "selected");
  expect(
    (
      await POST(
        new Request("http://localhost/api/import", {
          method: "POST",
          body: form,
        }),
      )
    ).status,
  ).toBe(200);
  expect(service.undoImport).toHaveBeenCalledWith("selected");
});

it("allows a same-origin preview forwarded from HTTPS to the local HTTP server", async () => {
  service.previewCsv.mockResolvedValue({ digest: "preview" });
  const direct = upload("preview");
  const request = new Request("http://127.0.0.1:3001/api/import", {
    method: "POST",
    headers: {
      "content-type": direct.headers.get("content-type")!,
      origin: "https://journal.example",
      host: "journal.example",
      "x-forwarded-host": "journal.example",
      "x-forwarded-proto": "https",
    },
    body: await direct.arrayBuffer(),
  });
  const response = await POST(request);
  expect(response.status).toBe(200);
  expect(service.previewCsv).toHaveBeenCalledOnce();
  expect(service.importCsv).not.toHaveBeenCalled();
});

it("allows the original Host when the HTTPS proxy provides no forwarded headers", async () => {
  service.previewCsv.mockResolvedValue({ digest: "preview" });
  const request = upload("preview");
  request.headers.set("origin", "https://journal.example:9445");
  request.headers.set("host", "journal.example:9445");
  expect((await POST(request)).status).toBe(200);
  expect(service.importCsv).not.toHaveBeenCalled();
});

it("rejects mismatched forwarded hosts, ports, opaque origins and browser cross-site uploads", async () => {
  for (const [origin, host, forwarded, fetchSite] of [
    [
      "https://unrelated.example",
      "journal.example:9445",
      "journal.example:9445",
      "same-origin",
    ],
    [
      "https://journal.example:9444",
      "journal.example:9445",
      "journal.example:9445",
      "same-origin",
    ],
    ["null", "journal.example:9445", "journal.example:9445", "cross-site"],
    [
      "https://journal.example:9445",
      "journal.example:9445",
      "journal.example:9445",
      "cross-site",
    ],
  ]) {
    const request = upload("preview");
    request.headers.set("origin", origin);
    request.headers.set("host", host);
    request.headers.set("x-forwarded-host", forwarded);
    request.headers.set("sec-fetch-site", fetchSite);
    expect((await POST(request)).status).toBe(403);
  }
  expect(service.previewCsv).not.toHaveBeenCalled();
});

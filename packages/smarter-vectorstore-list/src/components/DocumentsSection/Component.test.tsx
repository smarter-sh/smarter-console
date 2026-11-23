import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { server } from "@test/server";

import { documents, makeDocument, makeObject, sessionContext } from "@/mocks/fixtures";
import { DOCUMENT_URL, DOCUMENTS_URL, documentsHandlers } from "@/mocks/handlers";
import { MAX_DOCUMENT_BYTES } from "@/lib/const";

import { addedMessage, isChanging } from "@/lib/documents";

import DocumentsSection from "@/components/DocumentsSection/Component";

function renderSection(overrides = {}, onRequery = () => {}) {
  return render(
    <DocumentsSection sessionContext={sessionContext} vectorstore={makeObject(1, overrides)} onRequery={onRequery} />,
  );
}

/**
 * Record the forms that are given to fetch, until the test ends.
 *
 * A form is checked as it is given to fetch: under Node 24, a request whose body holds a jsdom File can be sent, but
 * not read back, so a handler's request.formData() and request.text() can't check it.
 */
function recordForms(): FormData[] {
  const forms: FormData[] = [];
  const originalFetch = globalThis.fetch;
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    if (init?.body instanceof FormData) {
      forms.push(init.body);
    }
    return originalFetch(input, init);
  });
  onTestFinished(() => fetchSpy.mockRestore());
  return forms;
}

/** The names of the files of a form. */
function fileNames(form: FormData | undefined): string[] {
  return (form?.getAll("files") ?? []).map((entry) => (entry as File).name);
}

/** A small file, or one whose size is said to be size. */
function file(name: string, size?: number): File {
  const made = new File([name], name, { type: "text/markdown" });
  if (size !== undefined) {
    Object.defineProperty(made, "size", { value: size });
  }
  return made;
}

describe("DocumentsSection", () => {
  it("lists the documents, with their status, chunks and size, and why one failed", async () => {
    server.use(...documentsHandlers());
    renderSection();
    const row = await screen.findByRole("row", { name: /stackademy-handbook\.md/ });
    expect(within(row).getByText("Loaded")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("4.0 KB")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/faq.html has no text to load.")).toBeInTheDocument();
    expect(screen.queryByText(/isn't ready/)).not.toBeInTheDocument();
  });

  it("says when there are none, and that a vectorstore that isn't ready loads them later", async () => {
    server.use(...documentsHandlers([]));
    renderSection({ status: "provisioning" });
    expect(await screen.findByText("It has no documents yet.")).toBeInTheDocument();
    expect(screen.getByText(/isn't ready\. Documents added now are loaded once it is deployed/)).toBeInTheDocument();
  });

  it("uploads the files that are chosen, as a multipart form, and requeries the list", async () => {
    const forms = recordForms();
    server.use(
      http.post(DOCUMENTS_URL, () => {
        return HttpResponse.json(
          { documents: [makeDocument(9), makeDocument(10)], duplicates: [makeDocument(1)], queued: true, message: "" },
          { status: 202 },
        );
      }),
      ...documentsHandlers(),
    );
    const onRequery = vi.fn();
    renderSection({}, onRequery);
    await screen.findByText("stackademy-handbook.md");
    await userEvent.upload(screen.getByLabelText("choose files"), [file("a.md"), file("b.md")]);
    expect(
      await screen.findByText(/Added 2 documents\. 1 document was already in the vectorstore\./),
    ).toBeInTheDocument();
    expect(fileNames(forms[0])).toEqual(["a.md", "b.md"]);
    expect(onRequery).toHaveBeenCalled();
  });

  it("uploads the files that are dropped on it", async () => {
    const forms = recordForms();
    server.use(
      http.post(DOCUMENTS_URL, () => {
        return HttpResponse.json(
          { documents: [makeDocument(9)], duplicates: [], queued: true, message: "" },
          { status: 202 },
        );
      }),
      ...documentsHandlers(),
    );
    renderSection();
    const zone = screen.getByLabelText("Drop files here to add them");
    fireEvent.dragOver(zone);
    expect(zone).toHaveClass("border-primary");
    fireEvent.dragLeave(zone);
    expect(zone).not.toHaveClass("border-primary");
    fireEvent.drop(zone, { dataTransfer: { files: [file("dropped.md")] } });
    expect(await screen.findByText("Added 1 document.")).toBeInTheDocument();
    expect(fileNames(forms[0])).toEqual(["dropped.md"]);
  });

  it("refuses a file that is too large, and sends the others", async () => {
    const forms = recordForms();
    server.use(
      http.post(DOCUMENTS_URL, () => {
        return HttpResponse.json(
          { documents: [makeDocument(9)], duplicates: [], queued: false, message: "" },
          { status: 202 },
        );
      }),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.upload(screen.getByLabelText("choose files"), [
      file("huge.pdf", MAX_DOCUMENT_BYTES + 1),
      file("ok.md"),
    ]);
    expect(await screen.findByText("Too large to add: huge.pdf.")).toBeInTheDocument();
    expect(await screen.findByText(/once the vectorstore is deployed and ready/)).toBeInTheDocument();
    expect(fileNames(forms[0])).toEqual(["ok.md"]);
  });

  it("shows the api's reason when an upload fails", async () => {
    server.use(
      http.post(DOCUMENTS_URL, () =>
        HttpResponse.json({ error: "scan.pdf has no text: it may need OCR." }, { status: 400 }),
      ),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.upload(screen.getByLabelText("choose files"), [file("scan.pdf")]);
    expect(await screen.findByText("scan.pdf has no text: it may need OCR.")).toBeInTheDocument();
  });

  it("adds a url", async () => {
    let body: unknown = null;
    server.use(
      http.post(DOCUMENTS_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { documents: [makeDocument(9)], duplicates: [], queued: true, message: "" },
          { status: 202 },
        );
      }),
      ...documentsHandlers(),
    );
    renderSection();
    const add = screen.getByRole("button", { name: "Add url" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Url of a page or file"), " https://example.com/faq.html ");
    await userEvent.click(add);
    expect(await screen.findByText("Added 1 document.")).toBeInTheDocument();
    expect(body).toEqual({ url: "https://example.com/faq.html" });
    expect(screen.getByLabelText("Url of a page or file")).toHaveValue("");
  });

  it("removes a document after it is confirmed, or keeps it", async () => {
    let removed: string | undefined;
    server.use(
      http.delete(DOCUMENT_URL, ({ params }) => {
        removed = String(params.documentId);
        return HttpResponse.json({ document: "stackademy-handbook.md", status: "deleting" }, { status: 202 });
      }),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Remove stackademy-handbook.md" }));
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(removed).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Remove stackademy-handbook.md" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove it" }));
    await waitFor(() => expect(removed).toBe("1"));
  });

  it("says that a url could not be added, when the api gives no reason", async () => {
    server.use(
      http.post(DOCUMENTS_URL, () => new HttpResponse(null, { status: 502 })),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.type(screen.getByLabelText("Url of a page or file"), "https://example.com/faq.html");
    await userEvent.click(screen.getByRole("button", { name: "Add url" }));
    expect(await screen.findByText("The url could not be added (502).")).toBeInTheDocument();
  });

  it("says that a document could not be removed, with the api's reason", async () => {
    server.use(
      http.delete(DOCUMENT_URL, () => HttpResponse.json({ detail: "The vectorstore is busy." }, { status: 409 })),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Remove stackademy-handbook.md" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove it" }));
    expect(await screen.findByText("The vectorstore is busy.")).toBeInTheDocument();
  });

  it("explains that only the owner may change the documents", async () => {
    server.use(
      http.delete(DOCUMENT_URL, () => HttpResponse.json({ detail: "Not found." }, { status: 404 })),
      ...documentsHandlers(),
    );
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Remove stackademy-handbook.md" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove it" }));
    expect(
      await screen.findByText("Only the vectorstore's owner may add or remove its documents."),
    ).toBeInTheDocument();
  });

  it("says when the documents can't be loaded", async () => {
    server.use(http.get(DOCUMENTS_URL, () => HttpResponse.json({}, { status: 500 })));
    renderSection();
    expect(await screen.findByText("The documents could not be loaded (500).")).toBeInTheDocument();
  });
});

describe("isChanging", () => {
  it("is true while a document is loading or being removed, or waits in a ready vectorstore", () => {
    const ready = makeObject(1);
    const pending = makeObject(1, { status: "pending" });
    expect(isChanging(makeDocument(1, { status: "loading" }), pending)).toBe(true);
    expect(isChanging(makeDocument(1, { status: "deleting" }), pending)).toBe(true);
    expect(isChanging(makeDocument(1, { status: "pending" }), ready)).toBe(true);
    expect(isChanging(makeDocument(1, { status: "pending" }), pending)).toBe(false);
    expect(isChanging(documents[2], ready)).toBe(false);
  });
});

describe("addedMessage", () => {
  it("counts what was added and what was already there", () => {
    expect(addedMessage({ documents: [makeDocument(1)], duplicates: [], queued: true, message: "" })).toBe(
      "Added 1 document.",
    );
    expect(
      addedMessage({ documents: [], duplicates: [makeDocument(1), makeDocument(2)], queued: true, message: "" }),
    ).toBe("2 documents were already in the vectorstore.");
    expect(addedMessage({ documents: [makeDocument(1)], duplicates: [], queued: false, message: "" })).toBe(
      "Added 1 document. They are loaded once the vectorstore is deployed and ready.",
    );
  });
});

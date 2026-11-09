import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";

import {
  CONFIG_URL,
  PROMPT_URL,
  PROVIDER_REQUEST_URL,
  SESSION_KEY,
  config,
  configWithCode,
  configWithDiagram,
  configWithImages,
  configWithHistory,
  configWithStyles,
  chatStyles,
  leanConfig,
  progressEvents,
  promptEventStream,
  promptMaxTokensResponse,
  apiErrorResponse,
  promptResponse,
  props,
  providerRequestResponse,
} from "@/mocks/fixtures";
import {
  chatHandlers,
  configErrorHandlers,
  historyHandlers,
  loadingHandlers,
  promptErrorHandlers,
} from "@/mocks/handlers";
import { server } from "@test/server";
import { BANTER_DELAY_MS, BANTER_INTERVAL_MS } from "@/lib/banter";

import SmarterChat from "@/components/SmarterChat/Component";
import HeaderButton from "@/components/SmarterChat/HeaderButton";

vi.mock("mermaid", async () => ({ default: (await import("@/mocks/mermaid")).fakeMermaid }));

const WELCOME = "Welcome to Stackademy! How can I help you today?";

/** Types a message into the chat's input, and sends it with Enter. */
async function send(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole("textbox", { name: "Message" }));
  await user.keyboard(`${text}{Enter}`);
}

/** The chat's root element, whose style has the LLMClient's styles' css variables. */
function chatRoot(): HTMLElement {
  return screen.getByRole("region", { name: "Chat" }).closest(".SmarterChat") as HTMLElement;
}

describe("SmarterChat", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.cookie = "csrftoken=the-csrf-token; path=/";
  });

  it("starts a new chat session with the LLMClient's welcome message and example prompts", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} />);
    expect(screen.getByText("Configuring workbench...")).toBeInTheDocument();
    expect(await screen.findByText(WELCOME)).toBeInTheDocument();
    expect(screen.getByText("Some example prompts to get you started:")).toBeInTheDocument();
    expect(screen.getByText("Do you offer any courses on AI?", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Stackademy v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("openai gpt-4o-mini with 2 additional tools")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "valid" })).toBeInTheDocument();
    expect(screen.getByText("(sandbox)")).toBeInTheDocument();
  });

  it("restores a chat session from its history, with its links", async () => {
    server.use(...historyHandlers);
    render(<SmarterChat {...props} />);
    const link = await screen.findByRole("link", { name: "the catalogue" });
    expect(link).toHaveAttribute("href", "https://stackademy.edu");
    expect(screen.getByText("Do you offer any courses on AI?")).toBeInTheDocument();
    // the tool's response, a JSON array, is pretty printed as a json code block.
    expect(screen.getByText('"CS210"')).toHaveClass("hljs-string");
    expect(screen.getAllByText("json")[0]).toHaveClass("smarter-chat-code-language");
  });

  it("displays the assistant's tool calls in sandbox mode, and hides them in production mode", async () => {
    server.use(...historyHandlers);
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    const tool = await screen.findByText("stackademy_sql", { selector: "summary code" });
    // eslint-disable-next-line testing-library/no-node-access -- the tool call is a details element of the message's html.
    expect(tool.closest("section")).toHaveClass("system-message");
    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(screen.queryByText("stackademy_sql", { selector: "summary code" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sandbox" }));
    expect(screen.getByText("stackademy_sql", { selector: "summary code" })).toBeInTheDocument();
  });

  it("collapses a long code block, and shows all of it when its button is clicked", async () => {
    const code = Array.from({ length: 40 }, (_, index) => `print(${index})`).join("\n");
    const history = [{ role: "assistant", content: "```python\n" + code + "\n```" }];
    server.use(
      http.post(CONFIG_URL, () =>
        HttpResponse.json({ data: { ...config, history: { ...config.history, chat_history: history } } }),
      ),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    const expand = await screen.findByRole("button", { name: "Show all 40 lines" });
    await user.click(expand);
    expect(expand).toHaveTextContent("Show fewer lines");
    expect(expand).toHaveAttribute("aria-expanded", "true");
  });

  it("sends the thread with the user's message, and adds the response's messages", async () => {
    let body: { session_key: string; messages: { role: string; content: string }[] } | undefined;
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(promptResponse());
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);

    await send(user, "Any courses on AI?");

    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(screen.getByText("Smarter selected the stackademy_sql plugin.")).toBeInTheDocument();
    expect(body?.session_key).toBe(SESSION_KEY);
    expect(body?.messages.map((message) => message.role)).toEqual(["system", "assistant", "assistant", "user"]);
    expect(body?.messages.at(-1)?.content).toBe("Any courses on AI?");
  });

  it("does not send an empty message", async () => {
    const prompt = vi.fn();
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, () => {
        prompt();
        return HttpResponse.json(promptResponse());
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "   ");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("displays a failed prompt's error in the thread", async () => {
    server.use(...promptErrorHandlers);
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "hello");
    expect(await screen.findByText("401 error: Incorrect API key provided.")).toBeInTheDocument();
  });

  it("explains an empty response that reached the max tokens, in sandbox mode", async () => {
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, () => HttpResponse.json(promptMaxTokensResponse())),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "What is the weather in San Francisco?");

    const explanation = await screen.findByText(/The LLM reached this LLMClient's max tokens of 256/);
    expect(explanation).toHaveTextContent("so its response is empty. Raise defaultMaxTokens");

    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(screen.queryByText(/The LLM reached this LLMClient's max tokens/)).not.toBeInTheDocument();
  });

  it("displays a network failure in the thread", async () => {
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "hello");
    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });

  it("hides and shows the backend's messages, in production and sandbox mode", async () => {
    server.use(...chatHandlers);
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    expect(screen.getByText((config.llmclient.default_system_role ?? "").trim())).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(screen.queryByText((config.llmclient.default_system_role ?? "").trim())).not.toBeInTheDocument();
    expect(screen.getByText(WELCOME)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sandbox" }));
    expect(screen.getByText((config.llmclient.default_system_role ?? "").trim())).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sandbox" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Production" })).toHaveAttribute("aria-pressed", "false");
  });

  it("downloads the LLM provider request, in sandbox mode only", async () => {
    server.use(...chatHandlers);
    const saved: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.href, download: this.download });
    });
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((value: Blob) => {
      blob = value;
      return "blob:http://localhost/request";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);

    await user.click(screen.getByRole("button", { name: "Download the LLM provider request" }));
    await waitFor(() =>
      expect(saved).toEqual([
        { href: "blob:http://localhost/request", download: `${config.llmclient.name}-request.json` },
      ]),
    );
    expect(JSON.parse((await blob?.text()) ?? "")).toEqual(providerRequestResponse().data);

    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(screen.queryByRole("button", { name: "Download the LLM provider request" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sandbox" }));
    expect(screen.getByRole("button", { name: "Download the LLM provider request" })).toBeEnabled();
  });

  it.each([
    ["can't be read", ""],
    ["holds another LLMClient's session", "a".repeat(64)],
  ])("keeps the configuration's session when the session cookie %s", async (_case, cookieValue) => {
    const sessionKeys: Record<string, string | null> = {};
    const record = (name: string) => (request: Request) => {
      sessionKeys[name] = new URL(request.url).searchParams.get("session_key");
    };
    server.use(
      http.post(PROVIDER_REQUEST_URL, ({ request }) => {
        record("download")(request);
        return HttpResponse.json(providerRequestResponse());
      }),
      http.post(PROMPT_URL, ({ request }) => {
        record("prompt")(request);
        return HttpResponse.json(promptResponse());
      }),
      ...chatHandlers,
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/request") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    // what a browser can show the page after the configuration arrives: no session cookie, or another LLMClient's,
    // e.g. from a cookie of a shorter path. With it, the platform would start a new session on every request.
    const expires = cookieValue ? new Date(Date.now() + 60_000) : new Date(0);
    for (const path of ["/", window.location.pathname]) {
      document.cookie = `${props.sessionCookieName}=${cookieValue}; path=${path}; expires=${expires.toUTCString()}`;
    }

    await send(user, "Do you offer any courses on AI?");
    await waitFor(() => expect(sessionKeys.prompt).toBe(config.session_key));
    await user.click(screen.getByRole("button", { name: "Download the LLM provider request" }));
    await waitFor(() => expect(sessionKeys.download).toBe(config.session_key));

    const expired = new Date(0).toUTCString();
    for (const path of ["/", window.location.pathname]) {
      document.cookie = `${props.sessionCookieName}=; path=${path}; expires=${expired}`;
    }
  });

  it("keeps the chat's session when the configuration is refreshed", async () => {
    const sessionKeys: (string | null)[] = [];
    server.use(
      http.post(CONFIG_URL, ({ request }) => {
        sessionKeys.push(new URL(request.url).searchParams.get("session_key"));
        return HttpResponse.json({ data: config, api: "smarter.sh/v1" });
      }),
      ...chatHandlers,
    );
    const { rerender } = render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    document.cookie = `${props.sessionCookieName}=${"a".repeat(64)}; path=/`;

    rerender(<SmarterChat {...props} verbose />);
    await waitFor(() => expect(sessionKeys).toHaveLength(2));
    expect(sessionKeys[1]).toBe(config.session_key);
    document.cookie = `${props.sessionCookieName}=; path=/; expires=${new Date(0).toUTCString()}`;
  });

  it("displays a failed download of the LLM provider request in the thread", async () => {
    server.use(
      http.post(PROVIDER_REQUEST_URL, () => HttpResponse.json(apiErrorResponse(), { status: 404 })),
      ...chatHandlers,
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await user.click(screen.getByRole("button", { name: "Download the LLM provider request" }));
    expect(await screen.findByText("LLMClient not found.")).toBeInTheDocument();
  });

  it("has no download button without the metadata toggle", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} toggleMetadata={false} />);
    await screen.findByText(WELCOME);
    expect(screen.queryByRole("button", { name: "Download the LLM provider request" })).not.toBeInTheDocument();
  });

  it("has no metadata toggle unless asked for one", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} toggleMetadata={false} />);
    await screen.findByText(WELCOME);
    expect(screen.queryByRole("group", { name: "Chat mode" })).not.toBeInTheDocument();
  });

  it("displays only the conversation, as in production mode, without the metadata toggle", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} toggleMetadata={false} />);
    await screen.findByText(WELCOME);
    expect(screen.queryByText((config.llmclient.default_system_role ?? "").trim())).not.toBeInTheDocument();
  });

  it("starts a new chat session without the old session's key", async () => {
    const sessionKeys: string[] = [];
    server.use(
      http.post(CONFIG_URL, async ({ request }) => {
        sessionKeys.push(((await request.json()) as { session_key: string }).session_key);
        return HttpResponse.json({ data: config });
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await user.click(screen.getByRole("button", { name: "Start a new chat" }));
    await waitFor(() => expect(sessionKeys.length).toBeGreaterThanOrEqual(2));
    expect(sessionKeys.at(-1)).toBe("");
  });

  it("explains why the chat is unavailable when its configuration fails", async () => {
    server.use(...configErrorHandlers);
    render(<SmarterChat {...props} />);
    expect(await screen.findByText("LLMClient not found.")).toBeInTheDocument();
    expect(screen.getByText("Smarter Chat is not available")).toBeInTheDocument();
  });

  it("displays its own text in the language that it is asked for, but the LLMClient's as it is", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} language="es-MX" />);
    expect(screen.getByText("Configurando el área de trabajo...")).toBeInTheDocument();
    expect(await screen.findByText(WELCOME)).toBeInTheDocument();
    expect(screen.getByText("Algunos prompts de ejemplo para empezar:")).toBeInTheDocument();
    expect(screen.getByText("openai gpt-4o-mini con 2 herramientas adicionales")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar un chat nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Modo del chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pruebas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeInTheDocument();
  });

  it("displays its own text in the page's language by default", async () => {
    server.use(...chatHandlers);
    document.documentElement.lang = "fr";
    render(<SmarterChat {...props} />);
    expect(await screen.findByText(WELCOME)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Démarrer un nouveau chat" })).toBeInTheDocument();
  });

  it("is still configuring while the configuration loads", () => {
    server.use(...loadingHandlers);
    render(<SmarterChat {...props} />);
    expect(screen.getByText("Configuring workbench...")).toBeInTheDocument();
  });

  it("sends an attached file's text", async () => {
    let lastMessage = "";
    server.use(
      http.post(CONFIG_URL, () =>
        HttpResponse.json({ data: { ...config, llmclient: { ...config.llmclient, app_file_attachment: true } } }),
      ),
      http.post(PROMPT_URL, async ({ request }) => {
        const body = (await request.json()) as { messages: { content: string }[] };
        lastMessage = body.messages.at(-1)!.content;
        return HttpResponse.json(promptResponse());
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    const file = new File(["print('hello')"], "hello.py", { type: "text/x-python" });
    await user.upload(screen.getByLabelText("Attach a file"), file);
    await waitFor(() => expect(lastMessage).toBe("print('hello')"));
    expect(screen.getByText("print('hello')")).toBeInTheDocument();
  });

  it("displays the prompt's progress while it runs, and replaces it with the response", async () => {
    let finish: () => void = () => {};
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, () => {
        const encoder = new TextEncoder();
        const [progress, result] = promptEventStream().split(": keepalive\n\n");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(progress));
            finish = () => {
              controller.enqueue(encoder.encode(result));
              controller.close();
            };
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "Any courses on AI?");

    expect(await screen.findByText("Calling MCP server github: search_code")).toBeInTheDocument();
    expect(screen.getByText("Calling tool stackademy_sql")).toBeInTheDocument();
    const last = progressEvents.at(-1)!.message;
    expect(screen.getAllByText(last).length).toBeGreaterThan(0);
    expect(screen.getByText(`Stanley: ${last}`)).toBeInTheDocument();
    // the current step has a spinner, and the steps before it have a check mark. Both are css.
    // eslint-disable-next-line testing-library/no-node-access -- the steps are styled by their css class.
    const steps = Array.from(document.querySelectorAll("section.smarter-progress-message"));
    expect(steps.map((step) => step.classList.contains("smarter-progress-message-active"))).toEqual(
      progressEvents.map((_, index) => index === progressEvents.length - 1),
    );
    expect(steps.slice(0, -1).every((step) => step.classList.contains("smarter-progress-message-done"))).toBe(true);

    finish();
    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(screen.queryByText("Calling tool stackademy_sql")).not.toBeInTheDocument();
  });

  it("replies with a chat bubble of idle banter, with a sparkle, while a prompt sends nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      server.use(
        http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
        http.post(PROMPT_URL, () => new Promise<Response>(() => {})),
      );
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SmarterChat {...props} />);
      await screen.findByText(WELCOME);
      await send(user, "Any courses on AI?");
      expect(await screen.findByText("Stanley is typing")).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(BANTER_DELAY_MS));
      const banter = await screen.findByText("Hang on while I flabberjabber the doohickey…");
      // eslint-disable-next-line testing-library/no-node-access -- the bubble and its sparkle are styled by their css class.
      expect(banter.closest("section.smarter-chat-banter-message.cs-message--incoming")).not.toBeNull();
      // eslint-disable-next-line testing-library/no-node-access -- the sparkle is decorative, hidden from the a11y tree.
      expect(banter.querySelector("svg.smarter-chat-banter-sparkle")).not.toBeNull();
      // the typing indicator still reports the prompt's own state.
      expect(screen.getByText("Stanley is typing")).toBeInTheDocument();

      // a new line every BANTER_INTERVAL_MS, in the same bubble.
      vi.mocked(Math.random).mockReturnValue(0.999999);
      await act(() => vi.advanceTimersByTimeAsync(BANTER_INTERVAL_MS));
      expect(await screen.findByText(/^Still here! Just pausing to /)).toBeInTheDocument();
      expect(screen.queryByText("Hang on while I flabberjabber the doohickey…")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("replies with idle banter soon after a prompt is sent, whatever its progress, until it finishes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(Math, "random").mockReturnValue(0);
    let finish: () => void = () => {};
    try {
      server.use(
        http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
        http.post(PROMPT_URL, () => {
          const encoder = new TextEncoder();
          const [progress, result] = promptEventStream().split(": keepalive\n\n");
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(progress));
              finish = () => {
                controller.enqueue(encoder.encode(result));
                controller.close();
              };
            },
          });
          return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
        }),
      );
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SmarterChat {...props} />);
      await screen.findByText(WELCOME);
      await send(user, "Any courses on AI?");
      const last = progressEvents.at(-1)!.message;
      expect(await screen.findByText(`Stanley: ${last}`)).toBeInTheDocument();

      await act(() => vi.advanceTimersByTimeAsync(BANTER_DELAY_MS));
      expect(await screen.findByText("Hang on while I flabberjabber the doohickey…")).toBeInTheDocument();
      // the step is still reported in the typing indicator, not in the bubble.
      expect(screen.getByText(`Stanley: ${last}`)).toBeInTheDocument();

      // the response replaces the bubble.
      finish();
      expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
      expect(screen.queryByText("Hang on while I flabberjabber the doohickey…")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not ask for the prompt's progress unless asked to", async () => {
    let accept: string | null = null;
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, ({ request }) => {
        accept = request.headers.get("Accept");
        return HttpResponse.json(promptResponse());
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} streamProgress={false} />);
    await screen.findByText(WELCOME);
    await send(user, "hello");
    await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.");
    expect(accept).toBe("application/json");
  });

  it("hides the progress, but not the typing indicator's step, with the backend's messages", async () => {
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: config })),
      http.post(PROMPT_URL, () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(promptEventStream().split(": keepalive")[0]));
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await user.click(screen.getByRole("button", { name: "Production" }));
    await send(user, "hello");
    expect(await screen.findByText(`Stanley: ${progressEvents.at(-1)!.message}`)).toBeInTheDocument();
    expect(screen.queryByText("Calling tool stackademy_sql")).not.toBeInTheDocument();
  });

  it("displays markdown images, sized for their chat bubble", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithImages })));
    render(<SmarterChat {...props} />);
    const banner = await screen.findByRole("img", { name: "CS210 course banner" });
    expect(banner).toHaveClass("smarter-chat-image");
    // a data url, which browsers don't open, so it isn't a link.
    expect(screen.queryByRole("link", { name: "CS210 course banner" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "the catalogue" })).toHaveClass("smarter-chat-image");
    expect(screen.getByRole("link", { name: "the catalogue" })).toHaveAttribute("href", "https://stackademy.edu");
  });

  it("replaces a markdown image that fails to load with its description", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithImages })));
    render(<SmarterChat {...props} />);
    const catalogue = await screen.findByRole("img", { name: "the catalogue" });
    fireEvent.error(catalogue);
    expect(screen.queryByRole("img", { name: "the catalogue" })).not.toBeInTheDocument();
    // the link to the image's page stays, with the image's description.
    expect(screen.getByRole("link", { name: "the catalogue" })).toHaveAttribute("href", "https://stackademy.edu");
  });

  it("applies the LLMClient's styles: its colors, font, logo and avatars", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithStyles })));
    render(<SmarterChat {...props} />);
    await screen.findByText("CS301 Applied AI");
    const root = chatRoot();
    expect(root.style.getPropertyValue("--smarter-chat-header-bg")).toBe("#14213d");
    expect(root.style.getPropertyValue("--smarter-chat-outgoing-bg")).toBe("#fca311");
    expect(root.style.getPropertyValue("--smarter-chat-font-family")).toBe('"Nunito", system-ui, sans-serif');
    // the font's stylesheet link is added by an effect, which can run after the text is displayed.
    await waitFor(() =>
      // eslint-disable-next-line testing-library/no-node-access -- the font's stylesheet is a link in the page's head.
      expect(document.getElementById("smarter-chat-google-font")).toHaveAttribute(
        "href",
        expect.stringContaining("family=Nunito"),
      ),
    );
    expect(screen.getByRole("img", { name: "Stackademy" })).toHaveAttribute("src", chatStyles.app_logo_url);
    expect(screen.getAllByRole("img", { name: "Stanley" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "You" })).toHaveAttribute("src", chatStyles.user_avatar_url);
  });

  it("hides a logo or avatar whose image fails to load", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithStyles })));
    render(<SmarterChat {...props} />);
    await screen.findByText("CS301 Applied AI");
    fireEvent.error(screen.getByRole("img", { name: "You" }));
    await waitFor(() => expect(screen.queryByRole("img", { name: "You" })).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: "Stackademy" })).toBeInTheDocument();
  });

  it("has no logo, avatars or style variables without styles", async () => {
    server.use(...chatHandlers);
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    expect(chatRoot().getAttribute("style")).toBeFalsy();
    expect(screen.queryByRole("img", { name: "Stackademy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Stanley" })).not.toBeInTheDocument();
  });

  it("highlights code blocks, and copies their code", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithCode })));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<SmarterChat {...props} />);
    const copy = await screen.findByRole("button", { name: "Copy code" });
    expect(screen.getByText("python")).toHaveClass("smarter-chat-code-language");
    expect(screen.getByText('"CS210"')).toHaveClass("hljs-string");

    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith('import stackademy\n\nstackademy.enroll("CS210")');
    await waitFor(() => expect(copy).toHaveTextContent("Copied!"));
  });

  it("displays mermaid code blocks as diagrams, and shows their code", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithDiagram })));
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    const diagram = await screen.findByRole("figure", { name: "Diagram" });
    expect(screen.getByText("mermaid")).toHaveClass("smarter-chat-code-language");
    expect(screen.getByText(/Browse the catalogue/, { selector: "pre code" })).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show the diagram's code" }));
    expect(diagram).not.toBeVisible();
    expect(screen.getByText(/Browse the catalogue/, { selector: "pre code" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show the diagram" })).toHaveTextContent("Diagram");
  });

  it("adds the page's buttons to its header, after its own", async () => {
    server.use(...chatHandlers);
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SmarterChat
        {...props}
        headerActions={
          <HeaderButton className="extra" onClick={onClick}>
            Docs
          </HeaderButton>
        }
      />,
    );
    await screen.findByText(WELCOME);
    const docs = screen.getByRole("button", { name: "Docs" });
    expect(docs).toHaveClass("smarter-chat-toolbar-button", "extra");
    await user.click(docs);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("puts a header button's label in its own element, and passes its ref to the button", async () => {
    server.use(...chatHandlers);
    const ref = createRef<HTMLButtonElement>();
    render(
      <SmarterChat
        {...props}
        headerActions={
          <>
            <HeaderButton ref={ref}>Help</HeaderButton>
            <HeaderButton aria-label="Icon only" />
          </>
        }
      />,
    );
    await screen.findByText(WELCOME);
    const help = screen.getByRole("button", { name: "Help" });
    expect(ref.current).toBe(help);
    expect(screen.getByText("Help")).toHaveClass("smarter-chat-toolbar-label");
    expect(screen.getByRole("button", { name: "Icon only" })).not.toHaveClass("smarter-chat-toolbar-button-labeled");
  });

  it("passes the configuration, the mode and new chats to the page", async () => {
    server.use(...chatHandlers);
    const user = userEvent.setup();
    const onConfig = vi.fn();
    const onModeChange = vi.fn();
    const onNewChat = vi.fn();
    render(<SmarterChat {...props} onConfig={onConfig} onModeChange={onModeChange} onNewChat={onNewChat} />);
    await screen.findByText(WELCOME);
    await waitFor(() => expect(onConfig).toHaveBeenCalledWith(expect.objectContaining({ session_key: SESSION_KEY })));
    expect(onModeChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(onModeChange).toHaveBeenLastCalledWith(false);
    // the current mode's option changes nothing.
    const calls = onModeChange.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Production" }));
    expect(onModeChange).toHaveBeenCalledTimes(calls);

    await user.click(screen.getByRole("button", { name: "Start a new chat" }));
    expect(onNewChat).toHaveBeenCalledOnce();
    await waitFor(() => expect(onConfig).toHaveBeenCalledTimes(2));
  });

  it("reloads the configuration when the page asks it to, and the chat session continues", async () => {
    server.use(...chatHandlers);
    const { rerender } = render(<SmarterChat {...props} reloadKey={0} />);
    await screen.findByText("Stackademy v1.0.0");

    const renamed = { ...config, llmclient: { ...config.llmclient, app_name: "Stackademy Renamed" } };
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: renamed, api: "smarter.sh/v1" })));
    rerender(<SmarterChat {...props} reloadKey={0} />);
    expect(screen.getByText("Stackademy v1.0.0")).toBeInTheDocument();
    rerender(<SmarterChat {...props} reloadKey={1} />);
    expect(await screen.findByText("Stackademy Renamed v1.0.0")).toBeInTheDocument();
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
  });

  it("logs a failed reload, and keeps the chat", async () => {
    server.use(...chatHandlers);
    const { rerender } = render(<SmarterChat {...props} reloadKey={0} />);
    await screen.findByText(WELCOME);
    server.use(...configErrorHandlers);
    rerender(<SmarterChat {...props} reloadKey={1} />);
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Failed to refresh"), expect.anything()),
    );
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
  });

  it("keeps the latest configuration when an earlier reload finishes after it", async () => {
    server.use(...chatHandlers);
    const { rerender } = render(<SmarterChat {...props} reloadKey={0} />);
    await screen.findByText("Stackademy v1.0.0");

    let finishSlow: () => void = () => {};
    const slow = new Promise<void>((resolve) => (finishSlow = resolve));
    const named = (app_name: string) => ({ ...config, llmclient: { ...config.llmclient, app_name } });
    let requests = 0;
    server.use(
      http.post(CONFIG_URL, async () => {
        requests += 1;
        if (requests === 1) {
          await slow;
          return HttpResponse.json({ data: named("Stackademy Old") });
        }
        return HttpResponse.json({ data: named("Stackademy New") });
      }),
    );
    rerender(<SmarterChat {...props} reloadKey={1} />);
    await waitFor(() => expect(requests).toBe(1));
    rerender(<SmarterChat {...props} reloadKey={2} />);
    expect(await screen.findByText("Stackademy New v1.0.0")).toBeInTheDocument();
    await act(async () => finishSlow());
    expect(screen.getByText("Stackademy New v1.0.0")).toBeInTheDocument();
    expect(screen.queryByText("Stackademy Old v1.0.0")).not.toBeInTheDocument();
  });

  it("logs its steps in debug mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    server.use(...chatHandlers);
    render(<SmarterChat {...props} debugMode />);
    await screen.findByText(WELCOME);
    await waitFor(() => expect(log).toHaveBeenCalledWith(expect.any(String), "chat started", expect.anything()));
  });

  it("logs its steps when the LLMClient's configuration is in debug mode", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    server.use(
      http.post(CONFIG_URL, () => HttpResponse.json({ data: { ...config, debug_mode: true } })),
      http.post(PROMPT_URL, () => HttpResponse.json(promptResponse())),
    );
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await send(user, "Any courses on AI?");
    await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.");
    expect(log).toHaveBeenCalledWith(expect.any(String), "prompt response", expect.anything());
  });

  it("starts without a welcome message, a system role or tools, and with a default version", async () => {
    const bare = {
      ...config,
      llmclient: {
        ...config.llmclient,
        app_welcome_message: null,
        default_system_role: null,
        version: "",
        total_tools: 0,
      },
    };
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: bare })));
    render(<SmarterChat {...props} />);
    expect(await screen.findByText("Stackademy v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("openai gpt-4o-mini")).toBeInTheDocument();
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
  });

  it("hides the response's backend messages in production mode", async () => {
    server.use(...chatHandlers);
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    await user.click(screen.getByRole("button", { name: "Production" }));
    await send(user, "Any courses on AI?");
    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(screen.queryByText("Smarter selected the stackademy_sql plugin.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sandbox" }));
    expect(screen.getByText("Smarter selected the stackademy_sql plugin.")).toBeInTheDocument();
  });

  it("sends nothing when no file is chosen", async () => {
    const prompt = vi.fn();
    server.use(
      http.post(CONFIG_URL, () =>
        HttpResponse.json({ data: { ...config, llmclient: { ...config.llmclient, app_file_attachment: true } } }),
      ),
      http.post(PROMPT_URL, () => {
        prompt();
        return HttpResponse.json(promptResponse());
      }),
    );
    render(<SmarterChat {...props} />);
    await screen.findByText(WELCOME);
    fireEvent.change(screen.getByLabelText("Attach a file"), { target: { files: [] } });
    expect(prompt).not.toHaveBeenCalled();
  });

  it("ignores errors of other elements, and an avatar's image that fails to load again", async () => {
    server.use(http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithStyles })));
    render(<SmarterChat {...props} />);
    await screen.findByText("CS301 Applied AI");
    fireEvent.error(screen.getByRole("textbox", { name: "Message" }));
    expect(screen.getByRole("img", { name: "You" })).toBeInTheDocument();
    // the image fails twice before the avatar is hidden.
    const avatar = screen.getByRole("img", { name: "You" });
    act(() => {
      avatar.dispatchEvent(new Event("error"));
      avatar.dispatchEvent(new Event("error"));
    });
    await waitFor(() => expect(screen.queryByRole("img", { name: "You" })).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: "Stackademy" })).toBeInTheDocument();
  });

  it("puts the assistant's avatar beside its banter", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      server.use(
        http.post(CONFIG_URL, () => HttpResponse.json({ data: configWithStyles })),
        http.post(PROMPT_URL, () => new Promise<Response>(() => {})),
      );
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SmarterChat {...props} />);
      await screen.findByText("CS301 Applied AI");
      const avatars = screen.getAllByRole("img", { name: "Stanley" }).length;
      await send(user, "Any courses on AI?");
      await act(() => vi.advanceTimersByTimeAsync(BANTER_DELAY_MS));
      await waitFor(() => expect(screen.getAllByRole("img", { name: "Stanley" })).toHaveLength(avatars + 1));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("SmarterChat's verbose configuration", () => {
  /** The config api's requests, as whether each asked for the diagnostic parts, with ?verbose=true. */
  function recordConfigRequests(): boolean[] {
    const requests: boolean[] = [];
    server.use(
      http.post(CONFIG_URL, ({ request }) => {
        const verbose = new URL(request.url).searchParams.get("verbose") === "true";
        requests.push(verbose);
        return HttpResponse.json({ data: verbose ? configWithHistory : leanConfig(configWithHistory) });
      }),
      http.post(PROMPT_URL, () => HttpResponse.json(promptResponse())),
    );
    return requests;
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.cookie = "csrftoken=the-csrf-token; path=/";
  });

  it("asks for the diagnostic parts with verbose", async () => {
    const requests = recordConfigRequests();
    render(<SmarterChat {...props} verbose />);
    await screen.findByRole("link", { name: "the catalogue" });
    await waitFor(() => expect(requests).toEqual([true]));
  });

  it("never asks for the diagnostic parts without verbose, nor refreshes after a prompt", async () => {
    const requests = recordConfigRequests();
    const user = userEvent.setup();
    render(<SmarterChat {...props} />);
    await screen.findByRole("link", { name: "the catalogue" });
    await send(user, "Any courses on AI?");
    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(requests).toEqual([false]);
  });

  it("fetches the diagnostic parts when verbose is turned on, and again after a prompt changed them", async () => {
    const requests = recordConfigRequests();
    const user = userEvent.setup();
    const onConfig = vi.fn();
    const { rerender } = render(<SmarterChat {...props} onConfig={onConfig} />);
    await screen.findByRole("link", { name: "the catalogue" });
    expect(requests).toEqual([false]);

    // a prompt without verbose doesn't refresh the configuration.
    await send(user, "Any courses on AI?");
    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(requests).toEqual([false]);

    rerender(<SmarterChat {...props} onConfig={onConfig} verbose />);
    await waitFor(() => expect(requests).toEqual([false, true]));
    await waitFor(() =>
      expect(onConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({ history: expect.objectContaining({ prompt_tool_call_history: expect.any(Array) }) }),
      ),
    );

    // off, and on again: the diagnostic parts are current.
    rerender(<SmarterChat {...props} onConfig={onConfig} />);
    rerender(<SmarterChat {...props} onConfig={onConfig} verbose />);
    expect(requests).toEqual([false, true]);

    // a prompt with verbose refreshes them.
    await send(user, "And on databases?");
    await waitFor(() => expect(requests).toEqual([false, true, true]));
  });

  it("refetches the diagnostic parts that a prompt changed while verbose was off", async () => {
    const requests = recordConfigRequests();
    const user = userEvent.setup();
    const { rerender } = render(<SmarterChat {...props} verbose />);
    await screen.findByRole("link", { name: "the catalogue" });
    await waitFor(() => expect(requests).toEqual([true]));

    rerender(<SmarterChat {...props} />);
    await send(user, "Any courses on AI?");
    expect(await screen.findByText("We offer CS210 Artificial Intelligence, for $700.00.")).toBeInTheDocument();
    expect(requests).toEqual([true]);
    rerender(<SmarterChat {...props} verbose />);
    await waitFor(() => expect(requests).toEqual([true, true]));
  });
});

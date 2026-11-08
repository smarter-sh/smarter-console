/**
 * The console's tool pages, which Django hosted until they moved here: Apply Manifest, the Prompt
 * Passthrough and the Terminal, each a package's component with a session context from the console's session,
 * whose ApiUrl is the page's api. Each shows only while the session's flag is on, as Django's page did: Apply
 * Manifest's (manifestDropZone) and the Prompt Passthrough's platform settings, and the Terminal's, which is on for a superuser only.
 */
import { ApplyManifest } from "@smarter/apply-manifest";
import { PromptPassthrough } from "@smarter/prompt-passthrough";
import { TerminalEmulator } from "@smarter/terminal-emulator";
import { useMemo, type ReactNode } from "react";

import { djangoSessionContext } from "@/lib/djangoSession";
import { KIND_PLACEHOLDER, manifestEditorUrls } from "@/lib/manifestPages";
import { toolUrls } from "@/lib/tools";
import { NotFoundPage } from "@/routes/NotFoundPage";
import { useConsoleSession } from "@/session/context";

/** The session context of a page whose api is apiUrl, made once per session; null without a session. */
function usePageContext(apiUrl: string) {
  const { session } = useConsoleSession();
  const sessionContext = useMemo(() => (session ? djangoSessionContext(session, apiUrl) : null), [session, apiUrl]);
  return { session, sessionContext };
}

/** The page's component, or not found while its flag is off. */
function gated(on: boolean, page: ReactNode) {
  if (!on) return <NotFoundPage />;
  return page;
}

export function ApplyManifestPage() {
  const { session, sessionContext } = usePageContext(toolUrls.apply);
  if (!session || !sessionContext) return null;
  return gated(
    session.flags.manifestDropZone,
    <ApplyManifest
      sessionContext={sessionContext}
      kinds={session.samKinds}
      applyApiUrl={toolUrls.apply}
      validateApiUrl={manifestEditorUrls.validate}
      schemaApiUrl={manifestEditorUrls.schema}
      exampleApiUrl={manifestEditorUrls.example}
      kindPlaceholder={KIND_PLACEHOLDER}
    />,
  );
}

export function PassthroughPage() {
  const { session, sessionContext } = usePageContext(toolUrls.passthrough);
  if (!session || !sessionContext) return null;
  return gated(
    session.flags.passthrough,
    <PromptPassthrough
      sessionContext={sessionContext}
      defaultLLMProviderId={1}
      defaultTemplateId={1}
      providerApiUrl={toolUrls.providers}
      logStreamUrl={session.flags.serverLogs ? toolUrls.logStream : ""}
    />,
  );
}

export function TerminalPage() {
  const { session, sessionContext } = usePageContext(toolUrls.terminalTicket);
  if (!session || !sessionContext) return null;
  return gated(session.flags.terminal, <TerminalEmulator sessionContext={sessionContext} />);
}

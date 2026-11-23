/**
 * WhatsNew dashboard widget.
 *
 * This component renders a card that highlights notable features added in
 * recent Smarter releases, with each entry linking to its documentation page
 * on docs.smarter.sh.
 *
 * :returns: A JSX fragment containing the new features widget.
 * :rtype: JSX.Element
 *
 * :example:
 *
 *     <WhatsNew />
 */
import "./styles.css";
import { gettext } from "@smarter/common";

interface Feature {
  name: string;
  version: string;
  description: string;
  docsPath: string;
}

const DOCS_BASE_URL = "https://docs.smarter.sh";

const FEATURES: Feature[] = [
  {
    name: gettext("Vector Search"),
    version: "0.47",
    description: gettext("Let an LLMClient search its own documents, as a tool, for answers grounded in them"),
    docsPath: "smarter-resources/smarter-vectorsearch.html",
  },
  {
    name: gettext("Orchestrations"),
    version: "0.46",
    description: gettext("Run several LLMClients as one workflow, in sequence or in parallel"),
    docsPath: "smarter-resources/smarter-orchestrator.html",
  },
  {
    name: gettext("Organizations and Sharing"),
    version: "0.46",
    description: gettext("Nest accounts, e.g. a school's classes, share resources down them, and name account admins"),
    docsPath: "smarter-resources/account/resources/account.html#organizations-and-sharing",
  },
  {
    name: gettext("New Web Console"),
    version: "0.43",
    description: gettext("A faster, single-page web console, with a guided tour and onboarding hints"),
    docsPath: "smarter-platform/system-administration/tools/smarter-web-console.html",
  },
  {
    name: gettext("Slack Bot"),
    version: "0.39",
    description: gettext("Answer questions in your Slack workspace with any deployed LLMClient"),
    docsPath: "smarter-framework/smarter-on-kubernetes/slack-bot.html",
  },
  {
    name: gettext("Languages"),
    version: "0.30",
    description: gettext("Use the web console in English, Spanish, French or Brazilian Portuguese"),
    docsPath: "smarter-framework/developer-reference/translations.html",
  },
  {
    name: gettext("Extensions"),
    version: "0.27",
    description: gettext("Install signed, third-party LLM tools from the Smarter Extension registry"),
    docsPath: "smarter-framework/smarter-extensions.html",
  },
  {
    name: "MCPServer",
    version: "0.24",
    description: gettext("Ask any MCP client about The Smarter Project, from its own code, docs and blog"),
    docsPath: "smarter-platform/smarter-project-mcp-server.html",
  },
  {
    name: gettext("Budgets"),
    version: "0.16",
    description: gettext("Cap the tokens or cost of any resource, user or account, with a Budget manifest"),
    docsPath: "smarter-resources/smarter-budget.html",
  },
  {
    name: gettext("Self-Hosted LLMs"),
    version: "0.16",
    description: gettext("Run open-weight LLMs on your own Kubernetes cluster, with an LLMHost manifest"),
    docsPath: "smarter-resources/smarter-llmhost.html",
  },
  {
    name: gettext("Guardrails"),
    version: "0.15",
    description: gettext("Govern what goes into and comes out of an LLMClient, declared in its manifest"),
    docsPath: "smarter-resources/smarter-guardrail.html",
  },
  {
    name: "MCPClient",
    version: "0.15",
    description: gettext("Connect an LLMClient to any remote MCP server's tools"),
    docsPath: "smarter-resources/smarter-mcpclient.html",
  },
];

function WhatsNew() {
  return (
    <>
      {/* begin::What's New widget */}
      <section id="whats-new" aria-label={gettext("What's New")} className="card border-transparent h-xl-100">
        {/* begin::Header */}
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold text-gray-900">{gettext("What's New")}</span>
            <span className="text-muted mt-1 fw-semibold fs-7">{gettext("Recently added Smarter features")}</span>
          </h3>
        </div>
        {/* end::Header */}
        {/* begin::Body */}
        <div className="card-body pt-3">
          <ul className="whats-new-list list-unstyled row g-4 mb-0">
            {FEATURES.map((feature) => (
              <li key={feature.name} className="col-md-6 d-flex align-items-start">
                <span className="badge badge-light-primary fw-bold me-3 mt-1">{feature.version}</span>
                <div>
                  <a
                    href={`${DOCS_BASE_URL}/${feature.docsPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 text-hover-primary fw-bold fs-6"
                  >
                    {feature.name}
                  </a>
                  <div className="text-gray-600 fs-7">{feature.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {/* end::Body */}
      </section>
      {/* end::What's New widget */}
    </>
  );
}

export default WhatsNew;

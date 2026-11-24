/**
 * Example data for this package's stories and tests: the props that the console gives the page, and the answers
 * of the cli api (see smarter.apps.api.v1.cli.views: apply, validate, json-schema and example-manifest) and of the
 * repository apply api (smarter.apps.account.api.web.repository_apply).
 *
 * The repository apply runs are shaped like real runs of smarter-sh/example-manifests: its manifests, in apply
 * order; its Budgets skipped, because they exist and are kept as they are; and its MCPClients whose Secret
 * doesn't exist failed, with the broker's messages.
 */
import type { SessionContext } from "@smarter/common";

import type { AppProps } from "../App";
import {
  summaryOf,
  type ManifestStatus,
  type Run,
  type RunCounts,
  type RunList,
  type RunManifest,
} from "../lib/repositoryApply";
import { EXAMPLE_MANIFESTS } from "./exampleManifests";

export const APPLY_API_URL = "/api/v1/cli/apply/";
export const VALIDATE_API_URL = "/api/v1/cli/validate/";
export const SCHEMA_API_URL = "/api/v1/cli/json-schema/__kind__/";
export const EXAMPLE_API_URL = "/api/v1/cli/example-manifest/__kind__/";
export const REPOSITORY_APPLY_API_URL = "/api/web/account/repository-apply/";

export const sessionContext: SessionContext = {
  ApiUrl: APPLY_API_URL,
  csrfCookieName: "csrftoken",
  djangoSessionCookieName: "sessionid",
  cookieDomain: "localhost",
  debugMode: false,
  smarterClient: "@smarter/apply-manifest",
  smarterClientVersion: "0.0.0",
  smarterRequestId: "storybook-request-id",
};

export const appProps: AppProps = {
  sessionContext,
  kinds: ["LLMClient", "Secret"],
  applyApiUrl: APPLY_API_URL,
  validateApiUrl: VALIDATE_API_URL,
  schemaApiUrl: SCHEMA_API_URL,
  exampleApiUrl: EXAMPLE_API_URL,
  kindPlaceholder: "__kind__",
  repositoryApplyApiUrl: REPOSITORY_APPLY_API_URL,
};

export const SECRET_MANIFEST = `apiVersion: smarter.sh/v1
kind: Secret
metadata:
  name: example_secret
  description: An example secret.
  version: 1.0.0
spec:
  config:
    value: not-a-real-secret
`;

/** What the example-manifest command returns for a Secret. */
export const EXAMPLE_SECRET = {
  apiVersion: "smarter.sh/v1",
  kind: "Secret",
  metadata: { name: "example_secret", description: "An example secret.", version: "1.0.0" },
  spec: { config: { value: "not-a-real-secret" } },
};

/** What the apply api returns for SECRET_MANIFEST. */
export const applyResult = { message: "Secret example_secret applied successfully" };

// ---------------------------------------------------------------------------------------------------------------
// The repository apply api
// ---------------------------------------------------------------------------------------------------------------

export const EXAMPLE_REPOSITORY = "https://github.com/smarter-sh/example-manifests";
export const EXAMPLE_COMMIT = "a2ca1f7f43a72b3bd89abf19b601abfcb535c8be";
export const STACKADEMY_REPOSITORY = "https://github.com/smarter-sh/stackademy";
export const STACKADEMY_COMMIT = "5d0c1e9b7a3f2e4d6c8b0a1f3e5d7c9b1a3f5e7d";

/** The Secret that each MCPClient of example-manifests needs, and that a new account doesn't have. */
const MISSING_SECRETS: Record<string, string> = {
  asana: "asana_access_token",
  atlassian: "atlassian_api_token",
  context7: "context7_api_key",
  github: "github_personal_access_token",
  hugging_face: "hugging_face_access_token",
  linear: "linear_api_key",
  neon: "neon_api_key",
  notion: "notion_integration_token",
  sentry: "sentry_auth_token",
  square: "square_access_token",
  stripe: "stripe_secret_key",
  supabase: "supabase_access_token",
};

const VECTORSTORE_ERROR = `1 validation error for SAMVectorstore
spec.config.connection.apiKey
  Value error, Secret pinecone_api_key not found, or not shared with you. [type=value_error, input_value='pinecone_api_key', input_type=str]
    For further information visit https://errors.pydantic.dev/2.12/v/value_error`;

/** What became of a manifest of example-manifests in a finished run, and why. */
function outcome(kind: string, name: string): Pick<RunManifest, "status" | "message" | "output"> {
  if (kind === "Budget") {
    return {
      status: "skipped",
      message: `Budget ${name} already exists, and is kept as it is: applying its manifest again would reset its spending.`,
      output: "",
    };
  }
  if (kind === "MCPClient" && MISSING_SECRETS[name]) {
    const secret = MISSING_SECRETS[name];
    return {
      status: "failed",
      message: `SAMBrokerErrorNotFound: Smarter API MCPClient manifest broker: apply() not found error. Secret ${secret} not found, or not shared with you.\nCreate the Secret ${secret}, then apply this manifest again.`,
      output: `Applying MCPClient ${name}\nResolving credentials: Secret ${secret}\n`,
    };
  }
  if (kind === "Vectorstore" && name === "example_research_papers") {
    return { status: "failed", message: VECTORSTORE_ERROR, output: `Applying Vectorstore ${name}\n` };
  }
  if (kind === "LLMClient" && name === "repo_explorer") {
    return {
      status: "failed",
      message:
        "SAMBrokerErrorNotFound: Smarter API LLMClient manifest broker: apply() not found error. MCPClient github not found, or not shared with you.",
      output: `Applying LLMClient ${name}\nResolving mcpClients: github\n`,
    };
  }
  return { status: "applied", message: "", output: `${kind} ${name} applied successfully\n` };
}

/** The manifests of example-manifests, at a commit, with each one's outcome; or pending from position done on. */
export function exampleManifests(commit = EXAMPLE_COMMIT, done = EXAMPLE_MANIFESTS.length): RunManifest[] {
  return EXAMPLE_MANIFESTS.map(([path, kind, name], position) => ({
    position,
    path,
    kind,
    name,
    sourceUrl: `${EXAMPLE_REPOSITORY}/blob/${commit}/${path}`,
    ...(position < done ? outcome(kind, name) : { status: "pending" as ManifestStatus, message: "", output: "" }),
  }));
}

/** How many manifests have each status. */
export function countsOf(manifests: RunManifest[]): RunCounts {
  const counts: RunCounts = { pending: 0, applied: 0, skipped: 0, failed: 0 };
  for (const manifest of manifests) counts[manifest.status] += 1;
  return counts;
}

const NO_MANIFESTS: RunCounts = { pending: 0, applied: 0, skipped: 0, failed: 0 };

/** A run of example-manifests, by default finished; overrides change it, and its counts follow its manifests. */
export function makeRun(overrides: Partial<Run> = {}): Run {
  const manifests = overrides.manifests ?? exampleManifests();
  return {
    id: 12,
    url: EXAMPLE_REPOSITORY,
    commit: EXAMPLE_COMMIT,
    status: "finished",
    error: "",
    createdAt: "2026-11-23T14:02:11Z",
    completedAt: "2026-11-23T14:04:37Z",
    ...overrides,
    manifests,
    counts: overrides.counts ?? countsOf(manifests),
  };
}

/** Every manifest attempted: most applied, the Budgets skipped, and the MCPClients without Secrets failed. */
export const finishedRun = makeRun();

const IN_PROGRESS = { id: 13, createdAt: "2026-11-23T15:20:05Z", completedAt: null };

/** Just started: nothing cloned yet, so nothing discovered. */
export const queuedRun = makeRun({
  ...IN_PROGRESS,
  status: "queued",
  commit: "",
  manifests: [],
  counts: NO_MANIFESTS,
});

/** Cloning: the commit is not known yet. */
export const cloningRun = makeRun({ ...queuedRun, status: "cloning" });

/** Applying: the first 64 manifests attempted, the 65th being applied, and the rest pending. */
export const applyingRun = makeRun({
  ...IN_PROGRESS,
  status: "applying",
  manifests: exampleManifests(EXAMPLE_COMMIT, 64),
});

/** The same run, finished. */
export const applyingRunFinished = makeRun({ ...IN_PROGRESS, completedAt: "2026-11-23T15:22:41Z" });

/** A run that failed as a whole: the repository could not be cloned. */
export const failedRun = makeRun({
  id: 11,
  url: "https://github.com/smarter-sh/example-manifest",
  commit: "",
  status: "failed",
  error: "The repository could not be cloned. Check that it exists, and that it is public.",
  createdAt: "2026-11-23T13:58:40Z",
  completedAt: "2026-11-23T13:58:44Z",
  manifests: [],
  counts: NO_MANIFESTS,
});

/** A run that failed after cloning: the repository holds no manifest. */
export const emptyRepositoryRun = makeRun({
  id: 10,
  url: "https://github.com/smarter-sh/smarter-console",
  commit: "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432",
  status: "failed",
  error: "The repository holds no Smarter manifest.",
  createdAt: "2026-11-22T09:12:00Z",
  completedAt: "2026-11-22T09:12:09Z",
  manifests: [],
  counts: NO_MANIFESTS,
});

/** A small run whose every manifest applied. */
export const stackademyRun = makeRun({
  id: 9,
  url: STACKADEMY_REPOSITORY,
  commit: STACKADEMY_COMMIT,
  createdAt: "2026-11-21T17:45:30Z",
  completedAt: "2026-11-21T17:46:02Z",
  manifests: [
    ["smarter/secrets/stackademy-db-password.yaml", "Secret", "stackademy_db_password"],
    ["smarter/connections/stackademy-sql.yaml", "SqlConnection", "stackademy_sql"],
    ["smarter/plugins/stackademy-courses.yaml", "SqlPlugin", "stackademy_courses"],
    ["smarter/plugins/stackademy-enrollment.yaml", "SqlPlugin", "stackademy_enrollment"],
    ["smarter/llm-clients/stackademy.yaml", "LLMClient", "stackademy"],
  ].map(([path, kind, name], position) => ({
    position,
    path,
    kind,
    name,
    status: "applied" as ManifestStatus,
    message: "",
    output: `${kind} ${name} applied successfully\n`,
    sourceUrl: `${STACKADEMY_REPOSITORY}/blob/${STACKADEMY_COMMIT}/${path}`,
  })),
});

export const RUNS_PER_DAY = 20;

/** The user's runs, newest first, with no run in progress. */
export const recentRuns: RunList = {
  runs: [finishedRun, failedRun, emptyRepositoryRun, stackademyRun].map(summaryOf),
  runsPerDay: RUNS_PER_DAY,
};

/** The user's runs, newest first, the newest in progress. */
export const recentRunsInProgress: RunList = {
  runs: [applyingRun, finishedRun, failedRun].map(summaryOf),
  runsPerDay: RUNS_PER_DAY,
};

/** No runs yet. */
export const noRuns: RunList = { runs: [], runsPerDay: RUNS_PER_DAY };

/** The api's answer to a url that isn't a public GitHub repository's. */
export const NOT_A_REPOSITORY_ERROR =
  "This is not the url of a public GitHub repository. Use https://github.com/<owner>/<repo>.";

/** The api's answer once the day's runs are used up. */
export const DAILY_LIMIT_ERROR = "You can apply 20 repositories a day. Please try again tomorrow.";

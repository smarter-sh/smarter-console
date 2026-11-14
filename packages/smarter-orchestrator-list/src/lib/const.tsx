import packageJson from "../../package.json" with { type: "json" };

export const platformName = "Smarter";
export const projectName = packageJson.name;
export const projectVersion = packageJson.version;
export const loggerPrefix = `[${platformName} ${projectName} v${projectVersion}]`;

/**
 * The url of an orchestrator's runs, in the api: GET lists the user's newest, and POST starts one.
 *
 * @param hashedId - The orchestrator's hashed id.
 * @returns The url.
 */
export function runsUrl(hashedId: string): string {
  return `/api/v1/orchestrators/${hashedId}/runs/`;
}

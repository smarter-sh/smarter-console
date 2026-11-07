/**
 * The Smarter backend that the end-to-end tests run against: a local development stack, the smarter repository's
 * make run, with the Django dev server on :9357 and its smarter-api container.
 *
 * The tests sign in as a throwaway user, in an account of their own, which global-setup.ts creates and
 * global-teardown.ts deletes, with the Python scripts in backend/, run in the container by manage.py shell. The
 * user's email and password are written to .auth/user.json, which git ignores, and live only while the tests run.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** The Django dev server, which Vite's dev server proxies the backend's paths to. */
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:9357";

/** The container of the backend's Django app, where manage.py runs. */
export const BACKEND_CONTAINER = process.env.E2E_BACKEND_CONTAINER ?? "smarter-api";

/** Where the throwaway user is written while the tests run. */
export const USER_FILE = path.join(import.meta.dirname, ".auth", "user.json");

/** The throwaway user, and the ids of the rows that make it. */
export interface TestUser {
  email: string;
  password: string;
  userId: number;
  accountId: number;
  userProfileId: number;
}

/**
 * Runs one of backend/'s Python scripts with manage.py shell, in the backend's container.
 *
 * @param script - The script's file name, in backend/.
 * @param env - Environment variables for the script.
 * @returns What it printed.
 */
function runInBackend(script: string, env: Record<string, string> = {}): string {
  const source = fs.readFileSync(path.join(import.meta.dirname, "backend", script), "utf-8");
  const envArgs = Object.entries(env).flatMap(([name, value]) => ["-e", `${name}=${value}`]);
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      ...envArgs,
      BACKEND_CONTAINER,
      "bash",
      "-c",
      "cd /home/smarter_user/smarter && python manage.py shell",
    ],
    { input: source, encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 },
  );
}

/**
 * Fails with what to do when the backend isn't running.
 *
 * @throws Error - When the backend's dev server doesn't answer.
 */
export async function requireBackend(): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/`, { redirect: "manual" });
  } catch {
    throw new Error(
      `The end-to-end tests need a Smarter backend at ${BACKEND_URL}: run make run in the smarter repository, ` +
        "and wait for its dev server.",
    );
  }
}

/**
 * Creates the throwaway user, and writes it to USER_FILE.
 *
 * @returns The user.
 */
export function createTestUser(): TestUser {
  const output = runInBackend("create_user.py");
  const line = output.split("\n").find((text) => text.startsWith("E2E_USER="));
  if (!line) throw new Error(`The backend didn't create the test user:\n${output}`);
  const user = JSON.parse(line.slice("E2E_USER=".length)) as TestUser;
  fs.mkdirSync(path.dirname(USER_FILE), { recursive: true });
  fs.writeFileSync(USER_FILE, JSON.stringify(user), { mode: 0o600 });
  return user;
}

/** The throwaway user, from USER_FILE. */
export function readTestUser(): TestUser {
  return JSON.parse(fs.readFileSync(USER_FILE, "utf-8")) as TestUser;
}

/** Deletes the throwaway user, their profile and their account, and USER_FILE. */
export function deleteTestUser(): void {
  if (!fs.existsSync(USER_FILE)) return;
  const user = readTestUser();
  runInBackend("delete_user.py", {
    E2E_USER_ID: String(user.userId),
    E2E_ACCOUNT_ID: String(user.accountId),
    E2E_USER_PROFILE_ID: String(user.userProfileId),
  });
  fs.rmSync(USER_FILE);
}

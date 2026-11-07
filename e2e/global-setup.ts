/** Before the end-to-end tests: the backend must be running, and the throwaway user is created. See backend.ts. */
import { createTestUser, requireBackend } from "./backend";

export default async function globalSetup(): Promise<void> {
  await requireBackend();
  createTestUser();
}

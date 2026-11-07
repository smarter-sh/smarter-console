/** After the end-to-end tests: the throwaway user, their profile and their account are deleted. See backend.ts. */
import { deleteTestUser } from "./backend";

export default function globalTeardown(): void {
  deleteTestUser();
}

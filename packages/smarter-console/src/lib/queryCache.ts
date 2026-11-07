/**
 * The console's cache of api responses, per user and account.
 *
 * Every page shares one QueryClient (see @smarter/common's lib/query), in memory. A response belongs to the user who
 * asked for it, and to their account: signing out, signing in as someone else, or switching to another profile's
 * account gives the pages a new, empty client, in the same render, so that no page shows another user's or account's
 * data, even for a moment. The old client is cleared.
 */
import { createSmarterQueryClient } from "@smarter/common";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import type { ConsoleSession } from "@/contract.gen";

/**
 * Who a session's responses belong to: its user and account, or a visitor.
 *
 * @param session - The console's session, or null while it loads.
 * @returns The user's username and the account's number, e.g. "ann@example.com 3141-5926-5359".
 */
export function cacheOwner(session: ConsoleSession | null): string {
  const username = session?.user?.username ?? "";
  const accountNumber = session?.account?.accountNumber ?? "";
  return `${username} ${accountNumber}`;
}

/**
 * The QueryClient of the session's user and account: the same one while they stay the same, and a new one when they
 * change.
 *
 * @param session - The console's session, or null while it loads.
 * @returns The client.
 */
export function useSessionQueryClient(session: ConsoleSession | null): QueryClient {
  const owner = cacheOwner(session);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new client for each owner, on purpose.
  const client = useMemo(() => createSmarterQueryClient(), [owner]);
  // the previous owner's responses are dropped, and their requests cancelled.
  useEffect(() => () => client.clear(), [client]);
  return client;
}

/** MSW handlers of the console's backend calls, for the stories and tests. */
import { http, HttpResponse } from "msw";

import type { ConsoleSession } from "@/contract.gen";
import { DOODLE_API_URL, SESSION_API_URL } from "@/lib/const";
import { userSession, visitorSession } from "@/mocks/fixtures";

/** GET /api/web/session/ answers with this session. */
export function sessionHandler(session: ConsoleSession) {
  return http.get(SESSION_API_URL, () => HttpResponse.json(session));
}

export const userSessionHandler = sessionHandler(userSession);
export const visitorSessionHandler = sessionHandler(visitorSession);

/** GET /api/web/session/ fails. */
export const sessionErrorHandler = http.get(SESSION_API_URL, () =>
  HttpResponse.json({ error: "Server error" }, { status: 500 }),
);

/** The account api answers with this session after signing in, out or up. */
export function accountSessionHandler(url: string, session: ConsoleSession) {
  return http.post(url, () => HttpResponse.json(session));
}

/** The account api refuses with these errors and status. */
export function accountErrorsHandler(
  url: string,
  detail: string,
  fieldErrors: Record<string, string[]> = {},
  status = 400,
) {
  return http.post(url, () => HttpResponse.json({ detail, fieldErrors }, { status }));
}

/** GET /api/v1/doodles/today/ answers with a holiday's doodle. See smarter.apps.doodle.contract.models. */
export const doodleHandler = http.get(DOODLE_API_URL, () =>
  HttpResponse.json({
    date: "2026-11-08",
    region: "south-asia",
    theme: "diwali",
    title: "Diwali",
    caption: "Happy Diwali!",
    altText: "Glowing diyas line the ground below a Smarter LLMClient.",
    linkUrl: "https://en.wikipedia.org/wiki/Diwali",
    imageUrl: "/static/doodle/base.svg",
    isDefault: false,
    aiCredit: "",
    learnHowUrl: "https://docs.smarter.sh/",
    animated: false,
    showCaption: true,
  }),
);

/** A doodle that the Smarter Doodle Artist drew, as GET /api/v1/doodles/2026-11-19/mx/ returns it. */
export const drawnDoodle = {
  date: "2026-11-19",
  region: "mx",
  theme: "ai-2026-11-19-mx-revolution-day-1a2b3c4d",
  title: "Revolution Day",
  caption: "Happy Revolution Day!",
  altText: "Paper flags in green, white and red hang above a Smarter LLMClient.",
  linkUrl: "https://en.wikipedia.org/wiki/Mexican_Revolution",
  imageUrl: "/static/doodle/base.svg",
  isDefault: false,
  aiCredit: "drawn",
  learnHowUrl: "https://docs.smarter.sh/",
  animated: false,
  showCaption: true,
};

/** GET /api/v1/doodles/<date>/<region>/ answers with drawnDoodle on its day and region, and 404 on any other. */
export const doodleByDayHandler = http.get("/api/v1/doodles/:date/:region/", ({ params }) =>
  params.date === drawnDoodle.date && params.region === drawnDoodle.region
    ? HttpResponse.json(drawnDoodle)
    : HttpResponse.json({ detail: "Not found." }, { status: 404 }),
);

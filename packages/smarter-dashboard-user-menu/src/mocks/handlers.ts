/**
 * MSW request handlers for the user profile and profile image endpoints of the console's account api. Stories and tests use them
 * to answer their requests. See storybook/preview.ts and test/server.ts in the workspace.
 */
import { http, HttpResponse } from "msw";

import {
  appContext,
  dataExportOverview,
  queuedExport,
  runningExport,
  succeededExport,
  failedExport,
  switchedUserProfiles,
  userProfiles,
} from "./fixtures";

export const userProfilesHandler = http.get(appContext.urls.userProfilesApi, () => HttpResponse.json(userProfiles));
export const userProfileSelectHandler = http.post(appContext.urls.userProfileSelectApi, () =>
  HttpResponse.json(switchedUserProfiles),
);

/** Both user profile apis. */
export const userProfileHandlers = [userProfilesHandler, userProfileSelectHandler];

/** The user profiles api fails. */
export const userProfilesErrorHandlers = [
  http.get(appContext.urls.userProfilesApi, () => HttpResponse.json({ error: "Service unavailable" }, { status: 503 })),
];

/** The account api signs the user out. */
export const signOutHandler = http.post(appContext.urls.logout, () => HttpResponse.json({ isAuthenticated: false }));

/** The account api refuses to sign the user out, e.g. without the CSRF token. */
export const signOutErrorHandler = http.post(appContext.urls.logout, () =>
  HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
);

/** The profile image api accepts an upload, and a removal. */
export const profileImageHandlers = [
  http.post(appContext.urls.profileImageApi, () =>
    HttpResponse.json({ profile_image_url: "https://example.com/media/profile-images/ada.png" }),
  ),
  http.delete(appContext.urls.profileImageApi, () =>
    HttpResponse.json({ profile_image_url: "http://localhost:9357/static/images/avatars/default-profile.svg" }),
  ),
];

const dataExportApi = appContext.urls.dataExportApi;
const dataExportDetail = `${dataExportApi}:id/`;

/**
 * The data export api: the overview, a new export, and its progress, which moves on one step each time that
 * it is asked for, from writing the manifests to done.
 */
export function dataExportHandlers(finish = succeededExport) {
  const answers = [runningExport, { ...runningExport, step: "archive" as const, manifestCount: 23 }, finish];
  let asked = 0;
  return [
    http.get(dataExportApi, () => HttpResponse.json(dataExportOverview)),
    http.post(dataExportApi, () => HttpResponse.json(queuedExport, { status: 202 })),
    http.get(dataExportDetail, () => {
      const answer = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      return HttpResponse.json(answer);
    }),
  ];
}

/** The data export api, whose export fails. */
export const dataExportFailureHandlers = () => dataExportHandlers(failedExport);

/** The data export api refuses a new export: the day's exports are used up. */
export const dataExportLimitHandlers = [
  http.get(dataExportApi, () => HttpResponse.json({ ...dataExportOverview, exportsLeftToday: 0 })),
];

/** The data export api, with an export already in progress. */
export const dataExportInProgressHandlers = [
  http.get(dataExportApi, () => HttpResponse.json({ ...dataExportOverview, latest: runningExport })),
  http.get(dataExportDetail, () => HttpResponse.json(succeededExport)),
];

/** The data export api refuses to start, with its reason. */
export const dataExportRefusedHandlers = [
  http.get(dataExportApi, () => HttpResponse.json(dataExportOverview)),
  http.post(dataExportApi, () =>
    HttpResponse.json(
      { error: "You can download your data 5 times a day. Please try again tomorrow." },
      { status: 429 },
    ),
  ),
];

/** The data export api can't be reached. */
export const dataExportErrorHandlers = [
  http.get(dataExportApi, () => HttpResponse.json({ error: "Service unavailable" }, { status: 503 })),
];

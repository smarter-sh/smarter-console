/**
 * Example data for this package's development page, stories and tests: the menu's context, as the
 * console builds it from its session, and what the console's account api's user profile, profile
 * image and data export endpoints return. See smarter.apps.account.api.web.user_profiles,
 * smarter.apps.account.api.web.profile_image and smarter.apps.account.api.web.data_export.
 */
import type { SessionContext } from "@smarter/common";

import type { AppContext, DataExportOverview, DataExportProgress, UserProfilesApiResponse } from "@/lib/Types";

export const sessionContext: SessionContext = {
  ApiUrl: "/api/web/account/profile-image/",
  csrfCookieName: "csrftoken",
  djangoSessionCookieName: "sessionid",
  cookieDomain: "localhost",
  debugMode: false,
  smarterClient: "@smarter/dashboard-user-menu",
  smarterClientVersion: "0.0.0",
  smarterRequestId: "storybook-request-id",
};

/** The Django dev server's static files, which Storybook's stylesheets also come from. */
const STATIC_URL = "http://localhost:9357/static/";

/** A student who is enrolled in two courses, so has two profiles. */
export const appContext: AppContext = {
  sessionContext,
  isAuthenticated: true,
  user: {
    username: "ada",
    email: "ada@example.edu",
    firstName: "Ada",
    lastName: "Lovelace",
    isSuperuser: false,
    isStaff: false,
  },
  profileImageUrl: `${STATIC_URL}images/avatars/default-profile.svg`,
  userProfileCount: 2,
  accountNumber: "1234-5678-9012",
  accountName: "Introduction to Prompt Engineering",
  languages: [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "pt-br", name: "Português Brasileiro" },
  ],
  currentLanguage: "en",
  urls: {
    setLanguage: "/i18n/setlang/",
    next: "/dashboard/",
    profileImageApi: "/api/web/account/profile-image/",
    userProfilesApi: "/api/web/account/user-profiles/",
    userProfileSelectApi: "/api/web/account/user-profiles/select/",
    dataExportApi: "/api/web/account/data-export/",
    login: "/login/",
    logout: "/api/web/account/logout/",
  },
};

/** A user with one profile, who has no Change Profile item. */
export const singleProfileAppContext: AppContext = { ...appContext, userProfileCount: 1 };

/** An anonymous request: Sign In, and the languages. */
export const anonymousAppContext: AppContext = {
  ...appContext,
  isAuthenticated: false,
  user: { username: "", email: "", firstName: "", lastName: "", isSuperuser: false, isStaff: false },
  userProfileCount: 0,
  accountNumber: "",
  accountName: "",
};

export const userProfiles: UserProfilesApiResponse = {
  userProfiles: [
    {
      id: 12,
      accountNumber: "1234-5678-9012",
      accountName: "Introduction to Prompt Engineering",
      createdAt: "2026-09-01T14:03:00Z",
      isCurrent: true,
    },
    {
      id: 7,
      accountNumber: "9876-5432-1098",
      accountName: "Building AI Agents",
      createdAt: "2026-01-15T09:30:00Z",
      isCurrent: false,
    },
  ],
};

/** What the select api returns once the second profile is chosen. */
export const switchedUserProfiles: UserProfilesApiResponse = {
  userProfiles: userProfiles.userProfiles.map((userProfile) => ({ ...userProfile, isCurrent: userProfile.id === 7 })),
};

/** What the data export api says before the student starts: the address, and the day's limit. */
export const dataExportOverview: DataExportOverview = {
  email: "ada@example.edu",
  linkHours: 24,
  exportsPerDay: 5,
  exportsLeftToday: 4,
  latest: null,
};

/** An export that was just started. */
export const queuedExport: DataExportProgress = {
  id: 41,
  status: "queued",
  step: "queued",
  resourceCount: 0,
  manifestCount: 0,
  failedCount: 0,
  sizeBytes: 0,
  email: "ada@example.edu",
  createdAt: "2026-11-08T14:43:57Z",
  expiresAt: null,
  error: "",
};

/** The same export, writing its manifests. */
export const runningExport: DataExportProgress = {
  ...queuedExport,
  status: "running",
  step: "manifests",
  resourceCount: 24,
  manifestCount: 10,
};

/** The same export, done and emailed. */
export const succeededExport: DataExportProgress = {
  ...runningExport,
  status: "succeeded",
  step: "done",
  manifestCount: 23,
  failedCount: 1,
  sizeBytes: 28_400,
  expiresAt: "2026-11-09T14:44:00Z",
};

/** The same export, which couldn't be saved to private storage. */
export const failedExport: DataExportProgress = {
  ...runningExport,
  status: "failed",
  step: "upload",
  manifestCount: 24,
  error: "The private storage could not be reached.",
};

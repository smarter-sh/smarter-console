/**
 * Types of the user menu: its context, which the console builds from its session, and what the
 * Django apis return. See smarter.apps.account.api.web.profile_image,
 * smarter.apps.account.api.web.user_profiles and smarter.apps.account.api.web.data_export.
 */
import type { SessionContext } from "@smarter/common";

/** One of the languages of the console, in its own name. */
export interface Language {
  /** The language code, e.g. "pt-br", which the Language item posts to set_language. */
  code: string;
  /** The language's name in that language, e.g. "Español". */
  name: string;
}

/** Who the signed-in user is. */
export interface MenuUser {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperuser: boolean;
  isStaff: boolean;
  /** Whether they administer the account that the console acts for, e.g. as a department's head. */
  administersAccount: boolean;
}

/** The urls of the menu's items. */
export interface MenuUrls {
  /** Django's set_language view, which the Language item posts to. */
  setLanguage: string;
  /** The page to return to after choosing a language: this one. */
  next: string;
  /** Uploads (POST) and removes (DELETE) the user's profile image. */
  profileImageApi: string;
  /** Lists the user's profiles. */
  userProfilesApi: string;
  /** Chooses the profile that the console acts as. */
  userProfileSelectApi: string;
  /** Download My Data: GET its overview, POST to start an export, GET <id>/ for an export's progress. */
  dataExportApi: string;
  login: string;
  logout: string;
}

/** The menu's context, which the console builds from its session (src/lib/userMenu.ts in @smarter/console). */
export interface AppContext {
  sessionContext: SessionContext;
  /** Whether a user is signed in. An anonymous menu has only the Sign In item and the languages. */
  isAuthenticated: boolean;
  user: MenuUser;
  /** The image that represents the user. */
  profileImageUrl: string;
  /** How many profiles the user has. The Change Profile item shows with two or more. */
  userProfileCount: number;
  /** The account of the profile that the console acts as. */
  accountNumber: string;
  accountName: string;
  languages: Language[];
  /** The code of the page's language. */
  currentLanguage: string;
  urls: MenuUrls;
}

/** One of the user's profiles. See UserProfileChoice in smarter.apps.account.api.web.user_profiles. */
export interface UserProfileChoice {
  id: number;
  accountNumber: string;
  accountName: string;
  /** When the profile was created, as an ISO 8601 date. */
  createdAt: string;
  /** Whether the console acts as this profile. */
  isCurrent: boolean;
}

/** The response of both user profile apis. */
export interface UserProfilesApiResponse {
  userProfiles: UserProfileChoice[];
}

/** The response of the profile image api. */
export interface ProfileImageApiResponse {
  profile_image_url?: string;
  profile_image?: string[];
  error?: string;
}

/** Where a data export is. See DataExportStatus in smarter.apps.account.models. */
export type DataExportState = "queued" | "running" | "succeeded" | "failed";

/** The step that a data export is on, in order. See DataExportStep in smarter.apps.account.models. */
export type DataExportStepName = "queued" | "inventory" | "manifests" | "archive" | "upload" | "email" | "done";

/** A data export's progress. See DataExportStatusResponse in smarter.apps.account.data_export. */
export interface DataExportProgress {
  id: number;
  status: DataExportState;
  step: DataExportStepName;
  /** How many resources the user owns. */
  resourceCount: number;
  /** How many manifests have been written so far. */
  manifestCount: number;
  /** How many resources had no manifest. */
  failedCount: number;
  /** The size of the zip file, in bytes. */
  sizeBytes: number;
  /** The address that the link is emailed to. */
  email: string;
  /** When the export was started, as an ISO 8601 date. */
  createdAt: string;
  /** When the emailed link expires, as an ISO 8601 date, or null before it is made. */
  expiresAt: string | null;
  /** Why the export failed, or an empty string. */
  error: string;
}

/** What the dialog says before the user starts. See DataExportOverviewResponse in smarter.apps.account.data_export. */
export interface DataExportOverview {
  /** The address that the link is emailed to, or an empty string. */
  email: string;
  /** How many hours the emailed link works. */
  linkHours: number;
  /** The most exports that a user may start in 24 hours. */
  exportsPerDay: number;
  /** How many more the user may start now. */
  exportsLeftToday: number;
  /** The user's most recent export, or null. */
  latest: DataExportProgress | null;
}

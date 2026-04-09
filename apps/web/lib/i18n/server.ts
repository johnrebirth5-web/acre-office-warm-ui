import "server-only";

import { cookies, headers } from "next/headers";
import { getCurrentSessionContext } from "../auth-session";
import { createI18nHelpers } from "./index";
import { localeCookieName, resolvePreferredLocale, type LocaleCode } from "./config";

export async function getRequestLocale(input?: { userLocale?: string | null | undefined }) {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return resolvePreferredLocale({
    userLocale: input?.userLocale,
    cookieLocale: cookieStore.get(localeCookieName)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
}

export async function getCurrentLocale() {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true,
  });

  return getRequestLocale({
    userLocale: context?.currentUser.locale,
  });
}

export async function getServerI18n(input?: { userLocale?: string | null | undefined; locale?: LocaleCode }) {
  const locale = input?.locale ?? (await getRequestLocale({ userLocale: input?.userLocale }));
  return createI18nHelpers(locale);
}

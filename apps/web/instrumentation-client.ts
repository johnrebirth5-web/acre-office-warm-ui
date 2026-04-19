import * as Sentry from "@sentry/nextjs";
import { getSentryInitOptions } from "./sentry.shared";

const initOptions = getSentryInitOptions();

if (initOptions) {
  Sentry.init(initOptions);
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

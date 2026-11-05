import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
import * as Updates from 'expo-updates';

import { redactLocation } from './redact';

/**
 * Crash and error reporting. Off in development; release builds report to the `rtap` project with the update channel as
 * the environment. Nothing that identifies the user or says where they are leaves the phone: no PII, no replay, no console
 * breadcrumbs, and grids or coordinates in messages are redacted.
 */
export function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: !__DEV__ && !!dsn,
    environment: Updates.channel || 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    integrations: [Sentry.expoRouterIntegration()],
    beforeBreadcrumb: (crumb) => (crumb.category === 'console' ? null : crumb),
    beforeSend: redactEvent,
  });
  Sentry.setTag('expo-channel', Updates.channel || 'none');
  Sentry.setTag('expo-update-id', Updates.updateId ?? 'none');
  Sentry.setTag('expo-is-embedded-update', Updates.isEmbeddedLaunch);
}

function redactEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) event.message = redactLocation(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactLocation(ex.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = redactLocation(crumb.message);
  }
  return event;
}

/**
 * Something that looks like a bug being chased, not an error: a warning in the Metro log while developing (Sentry is off
 * then), a Sentry message in release builds. `data` must not say where the user is (it is not redacted).
 */
export function reportSuspect(message: string, data: Record<string, number | string>) {
  if (__DEV__) console.warn(message, data);
  else Sentry.captureMessage(message, { level: 'warning', extra: data });
}

export const wrapRoot = Sentry.wrap;

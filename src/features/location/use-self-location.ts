import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { normalizeDeg } from '@/lib/geo/units/angle';
import { useMyLocation } from '@/stores/my-location';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import {
  screenHeadingOffset,
  shouldEmitHeading,
  smoothHeading,
  trueHeadingFrom,
  type HeadingSample,
  type ScreenOrientation as Orientation,
} from './heading';

function orientationName(o: ScreenOrientation.Orientation): Orientation {
  switch (o) {
    case ScreenOrientation.Orientation.PORTRAIT_UP:
      return 'portrait-up';
    case ScreenOrientation.Orientation.PORTRAIT_DOWN:
      return 'portrait-down';
    case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
      return 'landscape-left';
    case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
      return 'landscape-right';
    default:
      return 'unknown';
  }
}

/**
 * Streams the device position and heading into the presence store while mounted
 * (foreground, when-in-use only). Retries when the app returns to the foreground so
 * enabling location in Settings takes effect without restarting.
 *
 * With the Manual source it stops using location altogether (no watch, no prompt) and publishes the position set by
 * hand instead, marked `manual`, so everything that uses "me" works from it. Permission is still read, without
 * prompting, for the location-off notices.
 */
export function useSelfLocation(): void {
  useEffect(() => {
    let disposed = false;
    let starting = false;
    let subscriptions: { remove: () => void }[] = [];
    let lastHeading: HeadingSample | null = null;
    // The compass smoothed (before turning it for the screen, so a rotation still applies at once).
    let smoothed: HeadingSample | null = null;
    // The heading follows the screen, not the phone's top edge (landscape is 90° off otherwise).
    let orientation: Orientation = 'unknown';
    let lastEvent: Location.LocationHeadingObject | null = null;

    const manualSource = () => useMyLocation.getState().source === 'manual';

    const onPosition = (loc: Location.LocationObject) => {
      if (manualSource()) return;
      usePresence.getState().setSelfPosition({
        position: { lat: loc.coords.latitude, lon: loc.coords.longitude },
        accuracyM: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
        altitudeM: Number.isFinite(loc.coords.altitude) ? loc.coords.altitude : null,
      });
    };

    const onHeading = (event: Location.LocationHeadingObject, force = false) => {
      if (manualSource()) return;
      lastEvent = event;
      const presence = usePresence.getState();
      const compass = trueHeadingFrom(
        event,
        presence.selfPosition?.position ?? null,
        new Date(),
        useSettings.getState().declinationOverrideDeg,
      );
      if (compass === null) smoothed = null;
      // A forced update (the screen turned) reuses the last reading: it must not count as a new one.
      else if (!force || smoothed === null) smoothed = smoothHeading(smoothed, compass, Date.now());
      const heading = smoothed === null ? null : normalizeDeg(smoothed.heading + screenHeadingOffset(orientation));
      if (heading === null) {
        lastHeading = null;
        if (presence.selfHeading !== null) presence.setSelfHeading(null);
        return;
      }
      const now = Date.now();
      if (!force && !shouldEmitHeading(lastHeading, heading, now)) return;
      lastHeading = { heading, at: now };
      presence.setSelfHeading(heading);
    };

    const stopGps = () => {
      subscriptions.forEach((sub) => sub.remove());
      subscriptions = [];
      lastHeading = null;
      smoothed = null;
      lastEvent = null;
    };

    const applyManual = async () => {
      stopGps();
      const presence = usePresence.getState();
      if (presence.selfHeading !== null) presence.setSelfHeading(null);
      const { manual } = useMyLocation.getState();
      if (manual) presence.setSelfPosition({ position: manual, accuracyM: null, timestamp: Date.now(), altitudeM: null, manual: true });
      else presence.clearSelfPosition();
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (disposed || !manualSource()) return;
        // Not yet decided (e.g. iOS "Allow Once" expired) is not off: GPS stays selectable and asks when chosen.
        usePresence.getState().setLocationStatus(status === 'granted' ? 'granted' : status === 'undetermined' ? 'unknown' : 'denied');
      } catch (e) {
        console.warn('[location] permission unavailable', e);
        if (!disposed && manualSource()) usePresence.getState().setLocationStatus('unavailable');
      }
    };

    const startGps = async () => {
      if (starting || subscriptions.length > 0) return;
      starting = true;
      // A manual position must not stay up as "me" once GPS is the source again.
      if (usePresence.getState().selfPosition?.manual) usePresence.getState().clearSelfPosition();
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (disposed || manualSource()) return;
        if (status !== 'granted') {
          usePresence.getState().setLocationStatus('denied');
          return;
        }
        const position = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
          onPosition,
        );
        if (disposed || manualSource()) {
          position.remove();
          return;
        }
        subscriptions.push(position);
        usePresence.getState().setLocationStatus('granted');
        try {
          const heading = await Location.watchHeadingAsync(onHeading);
          if (disposed || manualSource()) heading.remove();
          else subscriptions.push(heading);
        } catch (e) {
          // No compass: position still works; the self icon shows without a heading.
          console.warn('[location] heading unavailable', e);
        }
      } catch (e) {
        console.warn('[location] unavailable', e);
        if (!disposed) usePresence.getState().setLocationStatus('unavailable');
      } finally {
        starting = false;
      }
    };

    const start = () => (manualSource() ? applyManual() : startGps());

    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Manual only re-reads permission; GPS retries after a denial.
      if (manualSource()) void applyManual();
      else if (usePresence.getState().locationStatus !== 'granted') void startGps();
    });
    const source = useMyLocation.subscribe((next, prev) => {
      if (next.source !== prev.source || next.manual !== prev.manual) void start();
    });
    void start();

    const setOrientation = (next: ScreenOrientation.Orientation) => {
      if (disposed) return;
      orientation = orientationName(next);
      // Turning the phone changes where the screen faces: redraw from the latest compass reading now.
      if (lastEvent) onHeading(lastEvent, true);
    };
    const orientationChange = ScreenOrientation.addOrientationChangeListener((e) => setOrientation(e.orientationInfo.orientation));
    void ScreenOrientation.getOrientationAsync()
      .then(setOrientation)
      .catch(() => {});

    return () => {
      disposed = true;
      orientationChange.remove();
      appState.remove();
      source();
      stopGps();
      usePresence.getState().reset();
    };
  }, []);
}

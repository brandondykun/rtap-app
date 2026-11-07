import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { normalizeDeg } from '@/lib/geo/units/angle';
import { useGpsAverage } from '@/stores/gps-average';
import { useMyLocation } from '@/stores/my-location';
import { usePresence, type SelfPosition } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import {
  screenHeadingOffset,
  shouldEmitHeading,
  smoothHeading,
  trueHeadingFrom,
  type HeadingSample,
  type ScreenOrientation as Orientation,
} from './heading';

/**
 * Average mode wants every reading (no distance filter): to average, and while paused so how far the user is from
 * the average stays current. Otherwise a 1 m filter saves battery.
 */
export function watchOptions(averageOn: boolean): Location.LocationOptions {
  return { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: averageOn ? 0 : 1, timeInterval: 1000 };
}

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
    // The newest GPS fix as it came, so "me" can drop back to it the moment Average mode turns off.
    let lastLive: SelfPosition | null = null;

    const averageOn = () => useGpsAverage.getState().phase !== 'off';
    const manualSource = () => useMyLocation.getState().source === 'manual';

    const onPosition = (loc: Location.LocationObject) => {
      if (manualSource()) return;
      const live: SelfPosition = {
        position: { lat: loc.coords.latitude, lon: loc.coords.longitude },
        accuracyM: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
        altitudeM: Number.isFinite(loc.coords.altitude) ? loc.coords.altitude : null,
      };
      lastLive = live;
      const average = useGpsAverage.getState();
      // Before addFix: a pause it triggers is dated by this fix.
      average.noteLive(live);
      const published = average.phase === 'averaging' ? average.addFix(live, loc.coords.speed ?? null) : null;
      // Paused (including a pause this fix just caused), the average is held as "me"; with nothing averaged
      // yet, or Average mode off, the live fix is.
      usePresence.getState().setSelfPosition(published ?? useGpsAverage.getState().held(live.timestamp) ?? live);
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
      lastLive = null;
    };

    const applyManual = async () => {
      stopGps();
      useGpsAverage.getState().stop();
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
          useGpsAverage.getState().stop();
          usePresence.getState().setLocationStatus('denied');
          return;
        }
        const position = await Location.watchPositionAsync(watchOptions(averageOn()), onPosition);
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
        if (!disposed) {
          useGpsAverage.getState().stop();
          usePresence.getState().setLocationStatus('unavailable');
        }
      } finally {
        starting = false;
      }
    };

    // Only the position watch restarts (the heading watch is untouched), and only while it is running.
    let restarting = false;
    const restartPosition = async () => {
      if (restarting || subscriptions.length === 0) return;
      restarting = true;
      try {
        let on = averageOn();
        // Re-check after the await: Average mode may have flipped again while the watch was starting.
        for (;;) {
          const old = subscriptions[0];
          const next = await Location.watchPositionAsync(watchOptions(on), onPosition);
          if (disposed || manualSource() || subscriptions[0] !== old) {
            next.remove();
            return;
          }
          old.remove();
          subscriptions[0] = next;
          if (on === averageOn()) return;
          on = averageOn();
        }
      } catch (e) {
        console.warn('[location] could not restart the position watch', e);
      } finally {
        restarting = false;
      }
    };
    let wasOn = averageOn();
    const averageWatch = useGpsAverage.subscribe((state, prev) => {
      if (state.phase !== prev.phase) {
        const presence = usePresence.getState();
        // Paused by any signal (the motion sensor, leaving the app): hold the average now, not at the next fix.
        const held = state.held(lastLive?.timestamp ?? Date.now());
        if (held) presence.setSelfPosition(held);
        // Off, or a new average with nothing in it yet: the average must not stay up as "me". Fall back to the last
        // live fix, or to nothing.
        else if (state.phase !== 'averaging' || state.samples.length === 0) {
          if (presence.selfPosition?.averaged) {
            if (lastLive) presence.setSelfPosition(lastLive);
            else presence.clearSelfPosition();
          }
        }
      }
      const on = averageOn();
      if (on === wasOn) return;
      wasOn = on;
      void restartPosition();
    });

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
      averageWatch();
      stopGps();
      usePresence.getState().reset();
    };
  }, []);
}

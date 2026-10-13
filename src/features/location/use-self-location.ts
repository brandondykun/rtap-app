import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { normalizeDeg } from '@/lib/geo/units/angle';
import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import {
  screenHeadingOffset,
  shouldEmitHeading,
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
 */
export function useSelfLocation(): void {
  useEffect(() => {
    let disposed = false;
    let starting = false;
    let subscriptions: { remove: () => void }[] = [];
    let lastHeading: HeadingSample | null = null;
    // The heading follows the screen, not the phone's top edge (landscape is 90° off otherwise).
    let orientation: Orientation = 'unknown';
    let lastEvent: Location.LocationHeadingObject | null = null;

    const onPosition = (loc: Location.LocationObject) => {
      usePresence.getState().setSelfPosition({
        position: { lat: loc.coords.latitude, lon: loc.coords.longitude },
        accuracyM: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
        altitudeM: Number.isFinite(loc.coords.altitude) ? loc.coords.altitude : null,
      });
    };

    const onHeading = (event: Location.LocationHeadingObject, force = false) => {
      lastEvent = event;
      const presence = usePresence.getState();
      const compass = trueHeadingFrom(
        event,
        presence.selfPosition?.position ?? null,
        new Date(),
        useSettings.getState().declinationOverrideDeg,
      );
      const heading = compass === null ? null : normalizeDeg(compass + screenHeadingOffset(orientation));
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

    const start = async () => {
      if (starting || subscriptions.length > 0) return;
      starting = true;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (disposed) return;
        if (status !== 'granted') {
          usePresence.getState().setLocationStatus('denied');
          return;
        }
        const position = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1 },
          onPosition,
        );
        if (disposed) {
          position.remove();
          return;
        }
        subscriptions.push(position);
        usePresence.getState().setLocationStatus('granted');
        try {
          const heading = await Location.watchHeadingAsync(onHeading);
          if (disposed) heading.remove();
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

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && usePresence.getState().locationStatus !== 'granted') void start();
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
      subscriptions.forEach((s) => s.remove());
      subscriptions = [];
      usePresence.getState().reset();
    };
  }, []);
}

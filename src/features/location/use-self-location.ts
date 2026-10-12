import * as Location from 'expo-location';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { usePresence } from '@/stores/presence';
import { useSettings } from '@/stores/settings';

import { shouldEmitHeading, trueHeadingFrom, type HeadingSample } from './heading';

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

    const onPosition = (loc: Location.LocationObject) => {
      usePresence.getState().setSelfPosition({
        position: { lat: loc.coords.latitude, lon: loc.coords.longitude },
        accuracyM: loc.coords.accuracy ?? null,
        timestamp: loc.timestamp,
      });
    };

    const onHeading = (event: Location.LocationHeadingObject) => {
      const presence = usePresence.getState();
      const heading = trueHeadingFrom(
        event,
        presence.selfPosition?.position ?? null,
        new Date(),
        useSettings.getState().declinationOverrideDeg,
      );
      if (heading === null) {
        lastHeading = null;
        if (presence.selfHeading !== null) presence.setSelfHeading(null);
        return;
      }
      const now = Date.now();
      if (!shouldEmitHeading(lastHeading, heading, now)) return;
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

    return () => {
      disposed = true;
      appState.remove();
      subscriptions.forEach((s) => s.remove());
      subscriptions = [];
      usePresence.getState().reset();
    };
  }, []);
}

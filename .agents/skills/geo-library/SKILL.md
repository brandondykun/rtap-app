---
name: geo-library
description: Use whenever you compute or display coordinates, MGRS, distances, bearings, azimuths, mils, grid convergence or magnetic declination, or add a function to src/lib/geo. Defines the canonical forms, where geo code lives, and the test bar.
---

# Geo library (`src/lib/geo`)

## Rules
1. **Canonical forms.** Positions are WGS84 `{ lat, lon }` decimal degrees (`LatLon`).
   Bearings are **true north, decimal degrees**. Convert to grid/magnetic, mils, or strings
   only at the edge, with `fromTrue` / `formatAngle` / `formatMgrs`.
2. **Features never do trigonometry.** For range/bearing call
   `describeVector(from, to, { unit, ref, date, declinationOverrideDeg })` from
   `@/lib/geo/vector`. Every readout must go through it so they agree.
3. **Libraries are wrapped.** Only `src/lib/geo/**` may import `mgrs`,
   `geographiclib-geodesic`, `geomagnetism` (lint enforced). Add new geodesy libraries the
   same way: wrap them, export our own types.
4. **No React / React Native** in `src/lib/geo` (lint enforced). Functions are pure and
   synchronous; they run on every camera frame.
5. **Errors are values.** Return `Result` (`@/lib/result`) for bad input (unparseable MGRS,
   polar positions). Never throw, never return `NaN`.
6. **Mils are NATO 6400 only** (`MILS_PER_CIRCLE`).
7. **Sign conventions** (east positive): `gridConvergence` = true→grid north,
   `declination` = true→magnetic north. `ref azimuth = true azimuth − offset`.
8. **Dates are injected** (`NorthContext.date`) so tests are deterministic.

## Map of the module
| Need | Function |
|------|----------|
| MGRS string for a position | `toMgrs(p, precision)` → `formatMgrs(...)` |
| Position from typed MGRS | `parseMgrs(stringOrFourFields)` |
| Distance / azimuth | `inverse(a, b)` (`azimuthTrue` is null under 0.5 m) |
| Point at range/bearing | `destination(p, azTrue, m)` |
| Convert north reference | `fromTrue` / `toTrue` / `northOffset` / `gridMagneticAngle` |
| Labels | `formatAngle`, `formatDistance`, `refLabel`, `formatLatLon` |

## Adding a function
1. Put it in the folder for its concern (`coords/`, `measure/`, `north/`, `units/`, `format/`).
2. Write golden-vector tests first, from an authoritative source (GeographicLib, NGA, NOAA
   WMM test values, or a published worked example). Note the source in the test.
3. Cover edges: zone/band boundaries, Norway/Svalbard, the antimeridian, poles/out of range,
   0/360 wrap, zero distance.
4. Run `npx jest src/lib/geo`.

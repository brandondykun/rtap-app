# Manual location

## Why

Some users don't want GPS on but still need to plot points and measure range and bearing from where they stand. Others
are where GPS is being jammed: location permission is on, but the fix is wrong or jumping, so the app would measure from
a bad position. Both need to tell the app where they are by hand.

Today, with location denied the map still works, but the ME readout says "Location is off", the CTR readout shows "—"
for distance and bearing, there is no self icon, and a new mission opens at world zoom. A dismissible banner explains
this, but it comes back every time the map screen mounts. OP mode can measure "FROM OP", but it also forces 3D and locks
the camera, so it is not a stand-in for "this is where I am".

## Goals

- A user can set their position by hand, by typing an MGRS grid or by choosing a spot on the map, and the app then treats
  it as "me" everywhere.
- A user decides when to use GPS and when to use the manual position. The app never switches between them on its own.
- A user with location off is told once on the map, and always in Settings, how to turn it back on.
- After setting a position by hand, the user is told where to change it.

## Non-goals

- Detecting jamming or a bad fix, or warning about one.
- A heading for the manual position (no compass cone).
- Changing the manual position from the map once it is set. That happens only in Settings, for now.
- Android-specific behaviour beyond what works the same way.

## Anti-goals

- A manual position that can be mistaken for a live GPS fix. It is marked wherever "me" appears: MANUAL in the ME
  readout, a distinct self icon on the map, and "(MAN)" after "from you" in the range readouts.
- The app quietly changing which position "me" is.
- The location-off banner nagging: once closed, it never returns.

## Position source

- There are two sources for "me": **GPS** and **Manual**. The chosen source is saved and survives restarts.
- The default is GPS.
- The user switches source in Settings → Location. Setting a position through "Tap to set your location" on the map
  also switches the source to Manual (that is the only way the source changes outside Settings, and it is the user's own
  action).
- Switching to GPS **clears** the manual position. Switching to Manual again starts from "Not set".
- If location permission is granted later while the source is Manual, the source stays Manual.
- While the source is Manual, "me" is the manual position everywhere the app uses the user's position today:
  - the CTR readout's distance and bearing, labelled "from you (MAN)" instead of "from you";
  - quick plot's range line, with its text reading "… from you (MAN)";
  - the range line while placing or editing a point or unit;
  - the self icon on the map, drawn differently from a GPS fix (e.g. a hollow or dashed blue ring instead of the
    solid disc) and without a heading cone, so it can't be mistaken for GPS even when the ME readout is hidden;
  - tapping the ME readout recenters on it;
  - a mission with no saved camera opens centered on it (as it does today on the first GPS fix);
  - staking an OP by tapping the user's location icon.
- While the source is Manual, the app **stops using location**: it does not watch position or heading, even if
  permission is on (saves battery, and the iPhone's location indicator goes away). Switching back to GPS starts it
  again (asking for permission if needed).
- The manual position is one position for the whole app, not per mission.

## On the map

### Location-off notice

- The existing `LocationBanner` is kept, but its text says location can be turned on any time in Settings, e.g.
  "Location is off, so your position and range are hidden. You can turn it on any time in Settings." Its **Settings**
  link still opens the iPhone's settings for RTAP.
- It shows only while location is denied or unavailable, it has never been closed, **and** no manual position is set.
  Closing it with ✕ hides it for good (saved across restarts). Being hidden because a manual position is set does not
  count as closing it: if the user switches back to GPS with location still off and never closed it, it shows again.

### ME readout (portrait dock row and landscape `SelfCard`)

- **Source GPS, location off:** shows "Location is off" and, as text (not a button), "Tap to set your location". The
  whole row/card is tappable and opens the Set manually box. Today the row is disabled-looking and does nothing in this
  state.
- **Source Manual, position set:** shows the manual grid in the usual position style, and **MANUAL** where the accuracy
  reading normally is. No altitude. Tapping recenters on the manual position, like tapping ME with a GPS fix.
- **Source Manual, not set** (switched to Manual in Settings but never set): same as location off, "Tap to set your
  location", and tapping opens the Set manually box.
- **Source GPS, location on:** unchanged from today.
- OP mode keeps showing the OP in this spot, as today.

### Set manually box

- Opens under the toolbar like the quick plot entry (`QuickPlotEntry`), titled MY POSITION, with a close ✕.
- Four MGRS fields (zone, square, easting, northing), like quick plot. Zone and square start filled from the crosshair,
  as in quick plot.
- **Choose on map** button: hides the box and shows the placing bar at the bottom ("Tap your position", like `PlaceBar`),
  with CTR (use the crosshair) and Cancel. The map can be panned and zoomed while choosing. A tap on the map sets the
  spot. Cancel returns to the box unchanged.
- After a spot is chosen, the box comes back with that grid in the fields, and a marker shows the spot on the map. The
  button now reads **Adjust on map** and works the same way. Editing the fields moves the marker.
- **Set** is disabled until the fields hold a valid grid. Set saves the position, makes Manual the source, and closes
  the box.
- After Set from the map, a message appears: "Position set by hand. You can change it any time in Settings → Location."
  It stays until the user closes it with ✕. It appears every time a position is set from the map; not when it is changed
  from Settings.

## In Settings

- **Location-off notice:** while location is denied or unavailable, a red notice is shown at the very top of the
  Settings menu, above all groups: "Location is off. Your GPS position is hidden until you turn it on." with an
  **Open Settings** link to the iPhone's settings for RTAP.
- **Location group:** a new group, first in the menu (above Profile).
  - "Use my position from": GPS / Manual. GPS is greyed out and can't be chosen while location permission is off.
  - The manual position row appears **only while Manual is selected**:
    - not set: "Not set" with **Set**;
    - set: the grid with **Change**.
  - Set / Change closes Settings and opens the Set manually box on the map (pre-filled with the current position for
    Change). The "Position set by hand" message does not appear for these.

## Decided by the user

Everything above except the items listed under "Builder's calls" below. After a builder review the user also decided:
the distinct self icon and "(MAN)" marking, stopping location while Manual is selected, and hiding the banner while a
manual position is set.

## Builder's calls

These were proposed by me (Claude) and not explicitly confirmed:

- The picking bar offers CTR alongside a map tap, matching the existing placing bar.
- Settings' Set / Change close Settings and open the box on the map, rather than editing the grid inside Settings.
- The "Position set by hand" message is not shown when the position is set or changed from Settings.
- A switch to Manual made by "Tap to set your location" counts as the user's choice (it does not break "never
  switches on its own").
- How the manual position and source are stored (settings store, profile store, or a new store), as long as they persist
  and are validated like the other persisted settings.
- How "me" is resolved: one selector/hook giving the active position (and whether it is manual) is the natural shape;
  today consumers read `usePresence().selfPosition` directly.
- The look of the marker shown while choosing, and of the MANUAL tag, within the existing readout and map styles
  (see the readout outline and crosshair standards).
- How the persistent "close it yourself" message is built: the existing toast auto-hides, so it needs either a variant
  that stays until closed or its own component.
- Exact copy, within the meaning given above.

## Mockups

Browser mockups from the design conversation: `.superpowers/brainstorm/64103-1793193950/content/`
(`location-off-map-v4.html`, `manual-entry-flow-v2.html`, `manual-entry-and-settings-v2.html`; the settings mockup
predates the decision that switching to GPS clears the manual position).

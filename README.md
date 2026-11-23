# Travel map for Home Assistant

A private travel map for a Home Assistant dashboard. Your photos stay on your own storage; the card shows each trip on Home Assistant's own map, with one numbered marker per place and a route line between the places. Press play and the photos and videos of each place grow out of its marker, one after the other, while the map stays in view.

The integration reads a plain folder tree, for example a share on a NAS. There is no cloud service and no separate photo server.

## Use cases

- A slideshow of a holiday on the living-room TV, with the map showing where each photo was taken.
- A dashboard tab to browse earlier trips by clicking the places on the map.
- An automation that reacts to new trips or to places that still miss coordinates.

## Requirements

- Home Assistant 2026.10 or newer. The card uses the map component that Home Assistant introduced in that release.
- A folder that Home Assistant can read, laid out as described below.

## Folder layout

One folder per trip, one subfolder per place.

```
trips/
  2026-japan/
    trip.yaml
    tokyo/
      001.jpg
      002.mp4
    kyoto/
      011.jpg
```

`trip.yaml` is optional and carries what the files cannot tell:

```yaml
title: Japan
country: Japan
start: 2026-04-01
finish: 2026-04-14
places:
  tokyo:
    lat: 35.6762
    lon: 139.6503
  kyoto:
    name: Kyōto        # optional display name; the folder name is the default
    lat: 35.0116
    lon: 135.7681
```

- The order of `places` is the order of travel, and so the order of the route. Folders that are not listed follow in alphabetical order.
- A place takes its position from the EXIF GPS data of its first JPEG that has any. Without GPS data, the coordinates in `trip.yaml` are used. A place with neither gets no marker and is reported (see Repairs).
- Folders whose name starts with `.`, `_`, `@` or `#` are skipped, which keeps Synology's `@eaDir` and `#recycle` out.
- Photos: jpg, jpeg, png, webp, avif, gif. Videos: mp4, m4v, mov, webm.

## Installation

1. Open Settings → Marketplace, choose the menu → Custom repositories and add `https://github.com/Meppies/ha-travelmap` as an integration.
2. Install Travel map and restart Home Assistant.

### Making the folder available (Home Assistant OS)

1. On the NAS, create a user that can read the share and nothing else.
2. In Home Assistant, go to Settings → System → Storage → Add network storage. Name `trips`, usage Media, and the server, share and credentials of the NAS.
3. The share is now at `/media/trips`.

## Setup

Settings → Devices & services → Add integration → Travel map.

| Field | Meaning |
|---|---|
| Folder | Absolute path of the folder that holds the trips, as Home Assistant sees it. Default `/media/trips`. The folder must be one that Home Assistant may read: anything under `/media`, or a folder listed in `allowlist_external_dirs`. |

The folder does not have to exist when you add the integration. You can set up the integration and the card first and add the network storage afterwards: until then the entities are unavailable, a repair issue says which folder is missing, and the integration looks again every minute.

The folder can be changed later with Reconfigure. Add the integration again for a second folder.

### Options

| Option | Meaning |
|---|---|
| Scan interval | Minutes between two scans of the folder, 5 to 1440. Default 60. |

## The card

The card registers itself. Edit a dashboard, choose Add card and look under "By card" for Travel map. For a TV, put it alone in a view of type Panel.

```yaml
type: custom:travelmap-card
height: calc(100vh - 56px)
autoplay: true
```

| Option | Default | Meaning |
|---|---|---|
| `trip` | newest trip | Folder name of the trip to start with. |
| `height` | `70vh` | Any CSS length. |
| `view` | `world` | What the map shows while playing. `world` shows the whole world, `trip` keeps the whole trip in view, `place` flies to each place. |
| `projection` | `flat` | `flat` draws a flat world map. `globe` leaves the map as Home Assistant draws it, which is a globe when zoomed out. |
| `max_zoom` | `6` | Closest zoom for the `trip` view. A lower number shows more of the world around the trip. |
| `photo_size` | `70` | Largest size of a photo, as a percentage of the card. A photo is made smaller when that keeps its marker in view. |
| `autoplay` | `false` | Start playing when the card loads. |
| `photo_seconds` | `6` | Time per photo. |
| `video_seconds` | `15` | Longest time per video. Videos play without sound. |
| `place_zoom` | `12` | Zoom level for `view: place`. |
| `route_color` | accent colour | Colour of the route and the markers. |
| `entry` | all | Title or id of one config entry, when there are several folders. |

Click a marker to jump to that place. The card follows the language of the user profile (English or Dutch).

Dashboards in YAML mode do not get the resource automatically. Add it by hand:

```yaml
lovelace:
  resources:
    - url: /travelmap/travelmap-card.js
      type: module
```

## Entities

| Entity | Meaning |
|---|---|
| Trips | Number of trips; the attribute `trips` lists the folder names. |
| Places | Number of places over all trips. |
| Media files (diagnostic) | Number of photos and videos. |
| Places without coordinates (diagnostic) | Places that get no marker; the attribute `places` lists them. |
| Last scan (diagnostic, disabled by default) | Time of the last successful scan. |
| Scan now (button) | Scans the folder straight away, for example after copying photos. |

### Example automation

```yaml
automation:
  - alias: Tell me when a place has no coordinates
    triggers:
      - trigger: numeric_state
        entity_id: sensor.trips_places_without_coordinates
        above: 0
    actions:
      - action: persistent_notification.create
        data:
          message: >
            No coordinates for: {{ state_attr('sensor.trips_places_without_coordinates', 'places') | join(', ') }}
```

## How data is updated

The integration scans the folder at startup, then once per scan interval, and when Scan now is pressed. A scan reads the folder listing, each `trip.yaml` and the first 256 kB of JPEGs until one with GPS data is found per place. Nothing is written to the folder.

The card fetches the trip list over the websocket connection and asks Home Assistant for a signed, short-lived link per photo. Photos are served only to signed-in users, and only files that the last scan found.

## Repairs

When the folder does not exist or cannot be read, a repair issue names it. It clears itself as soon as the folder is found.

When places have no coordinates, a repair issue lists them. Add `lat` and `lon` for each under `places` in the `trip.yaml` of that trip and press Scan now; the issue then clears itself.

## Known limitations

- Photos are sent to the browser at full size. Export JPEGs at screen resolution for a smooth slideshow; 20 MB originals load slowly.
- RAW files and HEIC are not shown. GPS data is read from JPEG only.
- A browser may refuse to start a video without a user gesture; photos always play.
- The route is a straight line between places, in the order of `trip.yaml`.
- The flat world map is not something Home Assistant's map component offers: its map style draws a globe when zoomed out. The card switches the map engine behind it to a flat projection. If a later Home Assistant release changes that engine, the map falls back to the globe and everything else keeps working.
- Map tiles come from the map service of Home Assistant, so the map needs the same internet access as the built-in map card. Photos never leave the local network.

## Troubleshooting

- The card says the folder is not available yet: add the network storage, or check the path in Settings → System → Storage. Network storage with usage Media is under `/media/<name>`. The card picks it up by itself within about a minute.
- "GitHub answered with an error: Not Found" when adding the repository: the repository is private. The Marketplace needs a GitHub token with access to it.
- "Home Assistant may not read this folder": use a folder under `/media`, or add the folder to `allowlist_external_dirs` in `configuration.yaml`.
- Entities are unavailable: the folder cannot be read, because the network storage has not been added yet, the NAS is off or the storage is disconnected. They recover by themselves.
- The card is not in the card picker: check Settings → Dashboards → Resources for `/travelmap/travelmap-card.js` and reload the browser without cache.
- For more detail, enable debug logging on the integration page; every skipped place and unreadable `trip.yaml` is logged.

## Removal

Delete the entry under Settings → Devices & services → Travel map. Removing the last entry also removes the card resource. Then remove the integration in the Marketplace and restart. Your photos are not touched.

## Development

```
pip install -r requirements_test.txt
pytest --cov
mypy
ruff check custom_components tests
```

## Licence

MIT.

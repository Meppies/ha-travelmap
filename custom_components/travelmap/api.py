"""Websocket command and media view used by the dashboard card."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from aiohttp import web
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import (
    async_response,
    require_admin,
    websocket_command,
)
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.http import KEY_HASS, HomeAssistantView
import probatio as vol

from .const import DOMAIN, MEDIA_URL_PREFIX
from .coordinator import TravelmapConfigEntry
from .scanner import ROOT_PLACE, Trip
from .writer import TripFileError, update_trip_file


def media_url(entry_id: str, trip: str, place: str, file: str) -> str:
    """Return the path under which the media view serves one file."""
    return "/".join(
        [MEDIA_URL_PREFIX, entry_id, *(quote(part, safe="") for part in (trip, place, file))]
    )


def _trip_payload(entry_id: str, trip: Trip) -> dict[str, Any]:
    return {
        "id": trip.id,
        "title": trip.title,
        "country": trip.country,
        "start": trip.start,
        "finish": trip.finish,
        "year": trip.year,
        "zoom": trip.zoom,
        "places": [
            {
                "id": place.id,
                "name": place.name,
                "latitude": place.latitude,
                "longitude": place.longitude,
                "source": place.source,
                "media": [
                    {
                        "url": media_url(entry_id, trip.id, place.id, item.file),
                        "type": item.kind,
                    }
                    for item in place.media
                ],
            }
            for place in trip.places
        ],
    }


@websocket_command({vol.Required("type"): f"{DOMAIN}/library"})
@callback
def websocket_library(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return every trip of every loaded entry."""
    entries: list[TravelmapConfigEntry] = hass.config_entries.async_loaded_entries(DOMAIN)
    connection.send_result(
        msg["id"],
        {
            "entries": [
                {
                    "entry_id": entry.entry_id,
                    "title": entry.title,
                    "path": str(entry.runtime_data.root),
                    "available": entry.runtime_data.last_update_success,
                    "trips": [
                        _trip_payload(entry.entry_id, trip)
                        for trip in entry.runtime_data.data.trips
                    ],
                }
                for entry in entries
            ]
        },
    )


def _clean(value: Any) -> Any:
    """Strip texts, so a field of spaces counts as empty."""
    return value.strip() if isinstance(value, str) else value


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save",
        vol.Required("entry_id"): str,
        vol.Required("trip"): str,
        vol.Optional("place"): str,
        vol.Optional("title"): vol.Any(str, None),
        vol.Optional("country"): vol.Any(str, None),
        vol.Optional("year"): vol.Any(
            vol.All(vol.Coerce(int), vol.Range(min=1800, max=2099)), None
        ),
        vol.Optional("zoom"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=1, max=20)), None),
        vol.Optional("name"): vol.Any(str, None),
        vol.Optional("latitude"): vol.All(vol.Coerce(float), vol.Range(min=-90, max=90)),
        vol.Optional("longitude"): vol.All(vol.Coerce(float), vol.Range(min=-180, max=180)),
    }
)
@require_admin
@async_response
async def websocket_save(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Save what the management panel changed for a trip or a place."""
    entry: TravelmapConfigEntry | None = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
        connection.send_error(msg["id"], "not_found", "Entry not loaded")
        return
    coordinator = entry.runtime_data
    trip = next((t for t in coordinator.data.trips if t.id == msg["trip"]), None)
    place = msg.get("place")
    # Only folders the last scan found: nothing else is ever written to.
    if trip is None or (place is not None and all(p.id != place for p in trip.places)):
        connection.send_error(msg["id"], "not_found", "Unknown trip or place")
        return

    trip_fields: dict[str, Any] = {
        key: _clean(msg[key]) for key in ("title", "country", "year", "zoom") if key in msg
    }
    place_fields: dict[str, Any] = {}
    if "name" in msg:
        place_fields["name"] = _clean(msg["name"])
    if "latitude" in msg and "longitude" in msg:
        place_fields["lat"] = round(msg["latitude"], 6)
        place_fields["lon"] = round(msg["longitude"], 6)
    try:
        await hass.async_add_executor_job(
            update_trip_file, coordinator.root, trip.id, trip_fields, place, place_fields
        )
    except TripFileError:
        connection.send_error(msg["id"], "trip_file_invalid", "trip.yaml is not valid YAML")
        return
    except OSError as err:
        connection.send_error(msg["id"], "write_failed", str(err))
        return
    await coordinator.async_refresh()
    connection.send_result(
        msg["id"],
        {"trips": [_trip_payload(entry.entry_id, t) for t in coordinator.data.trips]},
    )


class TravelmapMediaView(HomeAssistantView):
    """Serve photos and videos to authenticated users.

    The card asks Home Assistant to sign the path, so an ``<img>`` can load it
    without a bearer token. Only files that the last scan found are served,
    which rules out path traversal.
    """

    url = MEDIA_URL_PREFIX + "/{entry_id}/{trip}/{place}/{file}"
    name = f"api:{DOMAIN}:media"

    async def get(
        self, request: web.Request, entry_id: str, trip: str, place: str, file: str
    ) -> web.StreamResponse:
        """Return one media file."""
        hass = request.app[KEY_HASS]
        entry: TravelmapConfigEntry | None = hass.config_entries.async_get_entry(entry_id)
        if entry is None or entry.domain != DOMAIN or entry.state is not ConfigEntryState.LOADED:
            raise web.HTTPNotFound
        coordinator = entry.runtime_data
        if not coordinator.data.has_media(trip, place, file):
            raise web.HTTPNotFound
        folder = coordinator.root / trip
        if place != ROOT_PLACE:
            folder /= place
        return web.FileResponse(
            folder / file,
            headers={"Cache-Control": "private, max-age=3600"},
        )

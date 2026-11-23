"""Websocket command and media view used by the dashboard card."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from aiohttp import web
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import websocket_command
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.http import KEY_HASS, HomeAssistantView
import probatio as vol

from .const import DOMAIN, MEDIA_URL_PREFIX
from .coordinator import TravelmapConfigEntry
from .scanner import Trip


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
        return web.FileResponse(
            coordinator.root / trip / place / file,
            headers={"Cache-Control": "private, max-age=3600"},
        )

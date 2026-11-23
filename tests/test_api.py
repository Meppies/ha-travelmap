"""Tests for the websocket command and the media view."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import (
    ClientSessionGenerator,
    WebSocketGenerator,
)

from custom_components.travelmap.const import DOMAIN

from .conftest import setup_integration

pytestmark = pytest.mark.usefixtures("card")
BASE = "/api/travelmap/media/entry1"


async def test_websocket_library(
    hass: HomeAssistant, mock_entry: MockConfigEntry, hass_ws_client: WebSocketGenerator
) -> None:
    """The card gets every trip, with a URL per media file."""
    await setup_integration(hass, mock_entry)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "travelmap/library"})
    response = await client.receive_json()
    assert response["success"]
    (entry,) = response["result"]["entries"]
    assert (entry["entry_id"], entry["title"], entry["available"]) == ("entry1", "trips", True)
    japan = entry["trips"][0]
    assert japan["id"] == "2026-japan"
    assert japan["start"] == "2026-04-01"
    kyoto = japan["places"][1]
    assert kyoto["name"] == "Kyōto"
    assert kyoto["source"] == "trip.yaml"
    assert kyoto["media"] == [
        {"url": f"{BASE}/2026-japan/kyoto/001%20temple.jpg", "type": "image"},
        {"url": f"{BASE}/2026-japan/kyoto/clip.MP4", "type": "video"},
    ]
    assert japan["places"][2]["latitude"] is None
    assert japan["places"][3]["source"] == "exif"


async def test_media_view(
    hass: HomeAssistant,
    mock_entry: MockConfigEntry,
    hass_client: ClientSessionGenerator,
    hass_client_no_auth: ClientSessionGenerator,
) -> None:
    """Scanned files are served to signed-in users, and nothing else is."""
    await setup_integration(hass, mock_entry)
    client = await hass_client()

    response = await client.get(f"{BASE}/2026-japan/kyoto/clip.MP4")
    assert response.status == 200
    assert await response.read() == b"video"
    assert response.headers["Cache-Control"] == "private, max-age=3600"
    response = await client.get(f"{BASE}/2026-japan/kyoto/001%20temple.jpg")
    assert response.status == 200

    for path in (
        f"{BASE}/2026-japan/kyoto/nope.jpg",
        f"{BASE}/2026-japan/tokyo/notes.txt",
        "/api/travelmap/media/unknown/2026-japan/kyoto/clip.MP4",
    ):
        assert (await client.get(path)).status == 404, path
    # Home Assistant's own filter stops traversal before the view sees it.
    for path in (
        f"{BASE}/2026-japan/kyoto/..%2Ftrip.yaml",
        f"{BASE}/2026-japan/..%2F..%2Fx/kyoto/clip.MP4",
    ):
        assert (await client.get(path)).status in (400, 404), path

    anonymous = await hass_client_no_auth()
    assert (await anonymous.get(f"{BASE}/2026-japan/kyoto/clip.MP4")).status == 401

    # Another integration's entry id, and an unloaded entry, are not served.
    foreign = MockConfigEntry(domain="other", entry_id="foreign")
    foreign.add_to_hass(hass)
    assert (await client.get("/api/travelmap/media/foreign/a/b/c.jpg")).status == 404
    assert await hass.config_entries.async_unload(mock_entry.entry_id)
    assert (await client.get(f"{BASE}/2026-japan/kyoto/clip.MP4")).status == 404
    assert DOMAIN in hass.config.components

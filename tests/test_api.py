"""Tests for the websocket command and the media view."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

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
    library_root: Path,
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

    # Photos in a trip folder itself are served from that folder.
    bali = library_root / "Bali"
    bali.mkdir()
    (bali / "b.jpg").write_bytes(b"bali")
    await mock_entry.runtime_data.async_refresh()
    response = await client.get(f"{BASE}/Bali/_/b.jpg")
    assert (response.status, await response.read()) == (200, b"bali")

    anonymous = await hass_client_no_auth()
    assert (await anonymous.get(f"{BASE}/2026-japan/kyoto/clip.MP4")).status == 401

    # Another integration's entry id, and an unloaded entry, are not served.
    foreign = MockConfigEntry(domain="other", entry_id="foreign")
    foreign.add_to_hass(hass)
    assert (await client.get("/api/travelmap/media/foreign/a/b/c.jpg")).status == 404
    assert await hass.config_entries.async_unload(mock_entry.entry_id)
    assert (await client.get(f"{BASE}/2026-japan/kyoto/clip.MP4")).status == 404
    assert DOMAIN in hass.config.components


async def test_websocket_save(
    hass: HomeAssistant,
    mock_entry: MockConfigEntry,
    library_root: Path,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """The panel saves trip and place fields into trip.yaml."""
    await setup_integration(hass, mock_entry)
    client = await hass_ws_client(hass)

    async def save(**fields: object) -> dict:
        await client.send_json_auto_id({"type": "travelmap/save", "entry_id": "entry1", **fields})
        return await client.receive_json()

    response = await save(trip="2026-japan", title=" Japan trip ", year=2024, zoom=9, country="")
    assert response["success"]
    japan = response["result"]["trips"][0]
    assert (japan["title"], japan["year"], japan["zoom"], japan["country"]) == (
        "Japan trip",
        "2024",
        9.0,
        None,
    )
    response = await save(
        trip="2026-japan", place="nara", name="Nara", latitude=34.6851, longitude=135.8048
    )
    nara = response["result"]["trips"][0]["places"][2]
    assert (nara["latitude"], nara["longitude"], nara["source"]) == (34.6851, 135.8048, "trip.yaml")
    # Year and zoom back to automatic; a name without a position is fine.
    response = await save(trip="2026-japan", year=None, zoom=None)
    assert response["result"]["trips"][0]["year"] == "2026"
    assert (await save(trip="2026-japan", place="tokyo", name=None))["success"]

    # A trip folder with its own photos, and no trip.yaml yet.
    bali = library_root / "Bali"
    bali.mkdir()
    (bali / "b.jpg").write_bytes(b"jpg")
    await mock_entry.runtime_data.async_refresh()
    response = await save(trip="Bali", place="_", year=2018, latitude=-8.4095, longitude=115.1889)
    assert response["success"]
    assert (bali / "trip.yaml").read_text() == "year: 2018\nlat: -8.4095\nlon: 115.1889\n"

    for fields, code in (
        ({"trip": "nope"}, "not_found"),
        ({"trip": "2026-japan", "place": "../x"}, "not_found"),
        ({"trip": "2026-japan", "year": 99}, "invalid_format"),
        ({"trip": "2026-japan", "place": "nara", "latitude": 95, "longitude": 1}, "invalid_format"),
    ):
        response = await save(**fields)
        assert response["error"]["code"] == code, fields

    trip_file = library_root / "2026-japan" / "trip.yaml"
    good = trip_file.read_text(encoding="utf-8")
    trip_file.write_text("a: [unclosed", encoding="utf-8")
    assert (await save(trip="2026-japan", title="x"))["error"]["code"] == "trip_file_invalid"
    trip_file.write_text(good, encoding="utf-8")
    with patch("custom_components.travelmap.writer.os.replace", side_effect=PermissionError):
        assert (await save(trip="2026-japan", title="x"))["error"]["code"] == "write_failed"

    await client.send_json_auto_id({"type": "travelmap/save", "entry_id": "other", "trip": "x"})
    assert (await client.receive_json())["error"]["code"] == "not_found"

    # Only administrators may write.
    reader = await hass_ws_client(hass, hass_read_only_access_token)
    await reader.send_json_auto_id(
        {"type": "travelmap/save", "entry_id": "entry1", "trip": "2026-japan", "title": "x"}
    )
    assert (await reader.receive_json())["error"]["code"] == "unauthorized"


async def test_arrange_and_rescan(
    hass: HomeAssistant,
    mock_entry: MockConfigEntry,
    library_root: Path,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    hass_storage: dict,
) -> None:
    """The panel sets the order of trips and places, keeps groups, and rescans."""
    await setup_integration(hass, mock_entry)
    client = await hass_ws_client(hass)

    async def call(kind: str, **fields: object) -> dict:
        await client.send_json_auto_id({"type": f"travelmap/{kind}", **fields})
        return await client.receive_json()

    # Order of the trips; a trip that is not in the list comes after it.
    response = await call("arrange", entry_id="entry1", order=["2025-loose", "gone", "2025-loose"])
    assert [trip["id"] for trip in response["result"]["trips"]] == ["2025-loose", "2026-japan"]
    assert hass_storage["travelmap.entry1"]["data"]["order"] == ["2025-loose", "gone"]

    # Groups: named, ordered, and without what does not exist (any more).
    groups = [
        {
            "name": " Asia ",
            "items": [
                {"trip": "2026-japan", "place": "kyoto"},
                {"trip": "2025-loose"},
                {"trip": "2026-japan", "place": "kyoto"},
                {"trip": "2026-japan", "place": "nowhere"},
                {"trip": "gone"},
            ],
        },
        {"name": "  ", "items": []},
    ]
    response = await call("arrange", entry_id="entry1", groups=groups)
    (group,) = response["result"]["groups"]
    assert group["name"] == "Asia"
    assert len(group["id"]) == 8
    assert group["items"] == [{"trip": "2026-japan", "place": "kyoto"}, {"trip": "2025-loose"}]
    # The stored group keeps the items whose folder may come back.
    assert len(hass_storage["travelmap.entry1"]["data"]["groups"][0]["items"]) == 4
    # Saving a group again keeps its id.
    response = await call("arrange", entry_id="entry1", groups=[{**group, "name": "Azië"}])
    assert response["result"]["groups"][0] == {**group, "name": "Azië"}

    # Order of the places of a trip: written to trip.yaml.
    response = await call(
        "arrange",
        entry_id="entry1",
        place_order={"trip": "2026-japan", "places": ["osaka", "tokyo"]},
    )
    japan = next(trip for trip in response["result"]["trips"] if trip["id"] == "2026-japan")
    assert [place["id"] for place in japan["places"]] == ["osaka", "tokyo", "kyoto", "nara"]
    assert japan["places"][0]["source"] == "exif"

    for fields, code in (
        ({"entry_id": "other"}, "not_found"),
        ({"entry_id": "entry1", "place_order": {"trip": "nope", "places": []}}, "not_found"),
        (
            {"entry_id": "entry1", "place_order": {"trip": "2026-japan", "places": ["x"]}},
            "not_found",
        ),
        ({"entry_id": "entry1", "groups": [{"items": []}]}, "invalid_format"),
    ):
        assert (await call("arrange", **fields))["error"]["code"] == code, fields
    order = {"trip": "2026-japan", "places": ["tokyo"]}
    trip_file = library_root / "2026-japan" / "trip.yaml"
    good = trip_file.read_text(encoding="utf-8")
    trip_file.write_text("places: [a]\n", encoding="utf-8")
    response = await call("arrange", entry_id="entry1", place_order=order)
    assert response["error"]["code"] == "trip_file_invalid"
    trip_file.write_text(good, encoding="utf-8")
    with patch("custom_components.travelmap.writer.os.replace", side_effect=PermissionError):
        response = await call("arrange", entry_id="entry1", place_order=order)
    assert response["error"]["code"] == "write_failed"

    # New photos show up after a rescan.
    (library_root / "2025-loose" / "a" / "new.jpg").write_bytes(b"jpg")
    response = await call("rescan")
    (entry,) = response["result"]["entries"]
    assert len(entry["trips"][0]["places"][0]["media"]) == 2
    assert entry["last_scan"] is not None

    reader = await hass_ws_client(hass, hass_read_only_access_token)
    for message in (
        {"type": "travelmap/rescan"},
        {"type": "travelmap/arrange", "entry_id": "entry1"},
    ):
        await reader.send_json_auto_id(message)
        assert (await reader.receive_json())["error"]["code"] == "unauthorized"

    # The settings come back after a restart, and go with the entry.
    await hass.config_entries.async_reload(mock_entry.entry_id)
    await hass.async_block_till_done()
    response = await call("library")
    (entry,) = response["result"]["entries"]
    assert [trip["id"] for trip in entry["trips"]] == ["2025-loose", "2026-japan"]
    assert entry["groups"][0]["name"] == "Azië"
    await hass.config_entries.async_remove(mock_entry.entry_id)
    await hass.async_block_till_done()
    assert "travelmap.entry1" not in hass_storage

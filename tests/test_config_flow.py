"""Tests for the config flow."""

from __future__ import annotations

from pathlib import Path
import shutil
from unittest.mock import patch

from homeassistant.config_entries import SOURCE_USER, ConfigEntryState, ConfigFlowResult
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.travelmap.const import CONF_PATH, CONF_SCAN_INTERVAL, DOMAIN

from .conftest import setup_integration

pytestmark = pytest.mark.usefixtures("card")


async def test_user_flow(hass: HomeAssistant, library_root: Path, tmp_path: Path) -> None:
    """Each error is shown, and the flow recovers to create the entry."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"

    outside = tmp_path.parent
    for path, error in (
        ("relative/path", "path_not_absolute"),
        (str(library_root / "index.json"), "path_not_a_folder"),
        (str(outside), "path_not_allowed"),
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], {CONF_PATH: path}
        )
        assert result["type"] is FlowResultType.FORM
        assert result["errors"] == {CONF_PATH: error}

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: f" {library_root}/ "}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "trips"
    assert result["data"] == {CONF_PATH: str(library_root)}


async def test_user_flow_duplicate(hass: HomeAssistant, mock_entry: MockConfigEntry) -> None:
    """The same folder cannot be set up twice."""
    mock_entry.add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: mock_entry.data[CONF_PATH]}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_reconfigure(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path
) -> None:
    """Reconfigure moves the entry to another folder."""
    await setup_integration(hass, mock_entry)
    other = library_root.parent / "other"
    other.mkdir()

    result = await mock_entry.start_reconfigure_flow(hass)
    assert result["step_id"] == "reconfigure"
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {CONF_PATH: "nope"})
    assert result["errors"] == {CONF_PATH: "path_not_absolute"}
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: str(other)}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert mock_entry.data[CONF_PATH] == str(other)
    assert mock_entry.title == "other"

    # Keeping the same folder is fine.
    result = await mock_entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: str(other)}
    )
    await hass.async_block_till_done()
    assert result["reason"] == "reconfigure_successful"

    # A folder that another entry uses is refused.
    MockConfigEntry(domain=DOMAIN, data={CONF_PATH: str(library_root)}).add_to_hass(hass)
    result = await mock_entry.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: str(library_root)}
    )
    assert result["reason"] == "already_configured"


async def test_options_settings(hass: HomeAssistant, mock_entry: MockConfigEntry) -> None:
    """The scan interval is stored and applied."""
    await setup_integration(hass, mock_entry)
    result = await hass.config_entries.options.async_init(mock_entry.entry_id)
    assert result["type"] is FlowResultType.MENU
    assert result["menu_options"] == ["trip", "settings"]
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "settings"}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_SCAN_INTERVAL: 15}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert mock_entry.options == {CONF_SCAN_INTERVAL: 15}
    assert mock_entry.runtime_data.update_interval.total_seconds() == 900


async def _open_places(hass: HomeAssistant, entry: MockConfigEntry) -> ConfigFlowResult:
    result = await hass.config_entries.options.async_init(entry.entry_id)
    return await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "trip"}
    )


async def test_options_coordinates(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path
) -> None:
    """The folder tree is shown two levels deep and coordinates are saved."""
    await setup_integration(hass, mock_entry)
    result = await _open_places(hass, mock_entry)
    assert result["step_id"] == "trip"
    trips = result["data_schema"].schema["trip"].config["options"]
    assert [option["value"] for option in trips] == ["2026-japan", "2025-loose"]
    assert trips[0]["label"] == "2026-japan · 3/4"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"trip": "2026-japan"}
    )
    assert result["step_id"] == "place"
    places = result["data_schema"].schema["place"].config["options"]
    assert [option["label"] for option in places] == [
        "✓ tokyo · 35.6762, 139.6503 (trip.yaml)",
        "✓ kyoto · 1.5000, 2.5000 (trip.yaml)",
        "✗ nara",
        "✓ osaka · 34.6937, 135.5023 (exif)",
    ]

    # A place without coordinates: the map opens at a neighbour.
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"place": "nara"})
    assert result["step_id"] == "coordinates"
    assert result["description_placeholders"] == {
        "trip": "2026-japan",
        "place": "nara",
        "current": "–",
    }
    schema = result["data_schema"].schema
    suggested = next(iter(schema)).description["suggested_value"]
    assert suggested == {"latitude": 35.6762, "longitude": 139.6503}

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"location": {"latitude": 34.68512345, "longitude": 135.8048}}
    )
    assert result["type"] is FlowResultType.MENU
    assert result["step_id"] == "saved"
    assert result["menu_options"] == ["place", "trip", "finish"]

    text = (library_root / "2026-japan" / "trip.yaml").read_text(encoding="utf-8")
    assert "  nara:\n    name: Nara\n    lat: 34.685123\n    lon: 135.8048\n" in text
    assert "title: Japan" in text
    assert "name: Kyōto" in text
    japan = mock_entry.runtime_data.data.trips[0]
    assert (japan.places[2].latitude, japan.places[2].source) == (34.685123, "trip.yaml")

    # On to a place that has coordinates from EXIF: they are taken over.
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "place"}
    )
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"place": "osaka"}
    )
    assert result["description_placeholders"]["current"] == "34.693700, 135.502300 (exif)"
    suggested = next(iter(result["data_schema"].schema)).description["suggested_value"]
    assert suggested == {"latitude": 34.6937, "longitude": 135.5023}
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"location": {"latitude": 34.7, "longitude": 135.5, "radius": 0}}
    )
    assert mock_entry.runtime_data.data.trips[0].places[3].source == "trip.yaml"

    # Another trip, one without a trip.yaml: the file is created.
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "trip"}
    )
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"trip": "2025-loose"}
    )
    # One place only: no list to choose from. Nothing known: the map opens at home.
    assert result["step_id"] == "coordinates"
    suggested = next(iter(result["data_schema"].schema)).description["suggested_value"]
    assert suggested == {"latitude": hass.config.latitude, "longitude": hass.config.longitude}
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"location": {"latitude": -6.16, "longitude": 39.19}}
    )
    created = library_root / "2025-loose" / "trip.yaml"
    assert created.read_text(encoding="utf-8") == "places:\n  a:\n    lat: -6.16\n    lon: 39.19\n"

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "finish"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert mock_entry.options == {}


async def test_options_coordinates_errors(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path
) -> None:
    """A broken or read-only trip.yaml is reported and left alone."""
    await setup_integration(hass, mock_entry)
    result = await _open_places(hass, mock_entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"trip": "2026-japan"}
    )
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"place": "nara"})
    location = {"location": {"latitude": 1.0, "longitude": 2.0}}

    trip_file = library_root / "2026-japan" / "trip.yaml"
    good = trip_file.read_text(encoding="utf-8")
    trip_file.write_text("title: [unclosed", encoding="utf-8")
    result = await hass.config_entries.options.async_configure(result["flow_id"], location)
    assert result["errors"] == {"base": "trip_file_invalid"}
    assert trip_file.read_text(encoding="utf-8") == "title: [unclosed"

    trip_file.write_text(good, encoding="utf-8")
    with patch("custom_components.travelmap.writer.os.replace", side_effect=PermissionError):
        result = await hass.config_entries.options.async_configure(result["flow_id"], location)
    assert result["errors"] == {"base": "write_failed"}
    assert trip_file.read_text(encoding="utf-8") == good
    assert not list(trip_file.parent.glob(".*.tmp"))

    result = await hass.config_entries.options.async_configure(result["flow_id"], location)
    assert result["step_id"] == "saved"


async def test_options_without_trips(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path
) -> None:
    """Nothing to show: no folder yet, an unloaded entry, or an empty trip."""
    (library_root / "2027-empty").mkdir()
    await setup_integration(hass, mock_entry)
    result = await _open_places(hass, mock_entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"trip": "2027-empty"}
    )
    assert (result["type"], result["reason"]) == (FlowResultType.ABORT, "no_places")

    # The place folder disappears while its form is open.
    result = await _open_places(hass, mock_entry)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"trip": "2025-loose"}
    )
    assert result["step_id"] == "coordinates"
    shutil.rmtree(library_root / "2025-loose" / "a")
    await mock_entry.runtime_data.async_refresh()
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"location": {"latitude": 1.0, "longitude": 2.0}}
    )
    assert (result["type"], result["reason"]) == (FlowResultType.ABORT, "no_places")

    # A trip folder that holds its photos itself: straight to its coordinates.
    bali = library_root / "Bali"
    bali.mkdir()
    (bali / "b.jpg").write_bytes(b"jpg")
    await mock_entry.runtime_data.async_refresh()
    result = await _open_places(hass, mock_entry)
    labels = [o["label"] for o in result["data_schema"].schema["trip"].config["options"]]
    assert "Bali · 0/1" in labels
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"trip": "Bali"})
    assert result["step_id"] == "coordinates"
    assert result["description_placeholders"]["place"] == "Bali (/)"
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {"location": {"latitude": -8.4095, "longitude": 115.1889}}
    )
    assert result["description_placeholders"] == {"trip": "Bali", "place": "Bali"}
    assert (bali / "trip.yaml").read_text() == "lat: -8.4095\nlon: 115.1889\n"
    place = next(t for t in mock_entry.runtime_data.data.trips if t.id == "Bali").places[0]
    assert (place.latitude, place.source) == (-8.4095, "trip.yaml")
    shutil.rmtree(bali)

    # One trip only: its places are shown straight away.
    shutil.rmtree(library_root / "2025-loose")
    shutil.rmtree(library_root / "2027-empty")
    await mock_entry.runtime_data.async_refresh()
    result = await _open_places(hass, mock_entry)
    assert result["step_id"] == "place"

    assert await hass.config_entries.async_unload(mock_entry.entry_id)
    result = await _open_places(hass, mock_entry)
    assert (result["type"], result["reason"]) == (FlowResultType.ABORT, "no_trips")


async def test_user_flow_folder_comes_later(
    hass: HomeAssistant, library_root: Path, tmp_path: Path
) -> None:
    """The integration can be added before its folder exists."""
    later = tmp_path / "later"
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_PATH: str(later)}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {CONF_PATH: str(later)}
    assert result["result"].state is ConfigEntryState.LOADED

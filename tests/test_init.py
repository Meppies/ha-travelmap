"""Tests for setup, entities and the repair issue."""

from __future__ import annotations

import json
from pathlib import Path
import shutil

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er, issue_registry as ir
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.travelmap.const import CONF_PATH, DOMAIN
from custom_components.travelmap.diagnostics import async_get_config_entry_diagnostics

from .conftest import setup_integration

ISSUE_ID = "missing_coordinates_entry1"
TRANSLATIONS = Path(__file__).parent.parent / "custom_components" / DOMAIN / "translations"


def _state(hass: HomeAssistant, key: str) -> str:
    entity_id = er.async_get(hass).async_get_entity_id(
        "sensor" if key != "rescan" else "button", DOMAIN, f"entry1_{key}"
    )
    assert entity_id is not None
    state = hass.states.get(entity_id)
    assert state is not None
    return state.state


async def test_setup_and_entities(
    hass: HomeAssistant, mock_entry: MockConfigEntry, card: dict
) -> None:
    """Setup scans the folder and reports it through the sensors."""
    await setup_integration(hass, mock_entry)
    assert mock_entry.state is ConfigEntryState.LOADED
    card["register"].assert_awaited_once()

    assert _state(hass, "trips") == "2"
    assert _state(hass, "places") == "5"
    assert _state(hass, "media_files") == "6"
    assert _state(hass, "places_without_coordinates") == "2"
    registry = er.async_get(hass)
    missing = registry.async_get_entity_id("sensor", DOMAIN, "entry1_places_without_coordinates")
    assert hass.states.get(missing).attributes["places"] == ["2026-japan/osaka", "2025-loose/a"]
    trips = registry.async_get_entity_id("sensor", DOMAIN, "entry1_trips")
    assert hass.states.get(trips).attributes["trips"] == ["2026-japan", "2025-loose"]
    assert hass.states.get(trips).name == "trips Trips"
    last_scan = registry.async_get_entity_id("sensor", DOMAIN, "entry1_last_scan")
    assert registry.async_get(last_scan).disabled

    assert await hass.config_entries.async_unload(mock_entry.entry_id)
    assert mock_entry.state is ConfigEntryState.NOT_LOADED


async def test_dutch_entity_names(
    hass: HomeAssistant, mock_entry: MockConfigEntry, card: dict
) -> None:
    """Entity names follow the server language."""
    hass.config.language = "nl"
    await setup_integration(hass, mock_entry)
    trips = er.async_get(hass).async_get_entity_id("sensor", DOMAIN, "entry1_trips")
    assert hass.states.get(trips).name == "trips Reizen"


def test_translations_have_the_same_keys() -> None:
    """Every text exists in English and in Dutch."""

    def keys(node: object, prefix: str = "") -> set[str]:
        if not isinstance(node, dict):
            return {prefix}
        return set().union(*(keys(value, f"{prefix}/{key}") for key, value in node.items()))

    english = json.loads((TRANSLATIONS / "en.json").read_text(encoding="utf-8"))
    dutch = json.loads((TRANSLATIONS / "nl.json").read_text(encoding="utf-8"))
    assert keys(english) == keys(dutch)


async def test_missing_folder_retries(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path, card: dict
) -> None:
    """A folder that is gone at startup means a retry, not a failure."""
    shutil.rmtree(library_root)
    await setup_integration(hass, mock_entry)
    assert mock_entry.state is ConfigEntryState.SETUP_RETRY


async def test_repair_issue_and_rescan(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path, card: dict
) -> None:
    """Places without coordinates raise an issue that a rescan clears."""
    await setup_integration(hass, mock_entry)
    issues = ir.async_get(hass)
    issue = issues.async_get_issue(DOMAIN, ISSUE_ID)
    assert issue is not None
    assert issue.translation_placeholders == {
        "count": "2",
        "places": "2026-japan/osaka, 2025-loose/a",
    }

    shutil.rmtree(library_root / "2025-loose")
    shutil.rmtree(library_root / "2026-japan" / "osaka")
    button = er.async_get(hass).async_get_entity_id("button", DOMAIN, "entry1_rescan")
    await hass.services.async_call("button", "press", {"entity_id": button}, blocking=True)
    assert issues.async_get_issue(DOMAIN, ISSUE_ID) is None
    assert _state(hass, "places_without_coordinates") == "0"

    # The share drops away: sensors go unavailable, the button says why.
    shutil.rmtree(library_root)
    with pytest.raises(HomeAssistantError) as err:
        await hass.services.async_call("button", "press", {"entity_id": button}, blocking=True)
    assert err.value.translation_key == "rescan_failed"
    assert _state(hass, "trips") == "unavailable"
    assert _state(hass, "rescan") != "unavailable"


async def test_remove_entry(
    hass: HomeAssistant, mock_entry: MockConfigEntry, library_root: Path, card: dict
) -> None:
    """Removing an entry clears its issue; the last one takes the card along."""
    other = MockConfigEntry(domain=DOMAIN, entry_id="entry2", data={CONF_PATH: str(library_root)})
    other.add_to_hass(hass)
    await setup_integration(hass, mock_entry)
    assert ir.async_get(hass).async_get_issue(DOMAIN, ISSUE_ID) is not None

    await hass.config_entries.async_remove(mock_entry.entry_id)
    await hass.async_block_till_done()
    assert ir.async_get(hass).async_get_issue(DOMAIN, ISSUE_ID) is None
    card["unregister"].assert_not_awaited()

    await hass.config_entries.async_remove(other.entry_id)
    await hass.async_block_till_done()
    card["unregister"].assert_awaited_once()


async def test_diagnostics(hass: HomeAssistant, mock_entry: MockConfigEntry, card: dict) -> None:
    """Diagnostics carry counts and no names."""
    await setup_integration(hass, mock_entry)
    result = await async_get_config_entry_diagnostics(hass, mock_entry)
    assert result["trips"] == 2
    assert result["places"] == 5
    assert result["media_files"] == 6
    assert result["places_without_coordinates"] == 2
    assert result["places_per_trip"] == [4, 1]
    assert result["coordinate_sources"] == {"exif": 1, "trip.yaml": 2}
    assert result["last_scan"] is not None
    assert "japan" not in json.dumps(result)

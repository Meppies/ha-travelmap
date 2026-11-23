"""Tests for the config flow."""

from __future__ import annotations

from pathlib import Path

from homeassistant.config_entries import SOURCE_USER, ConfigEntryState
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


async def test_options_flow(hass: HomeAssistant, mock_entry: MockConfigEntry) -> None:
    """The scan interval is stored and applied."""
    await setup_integration(hass, mock_entry)
    result = await hass.config_entries.options.async_init(mock_entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_SCAN_INTERVAL: 15}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert mock_entry.options == {CONF_SCAN_INTERVAL: 15}
    assert mock_entry.runtime_data.update_interval.total_seconds() == 900


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

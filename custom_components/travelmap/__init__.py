"""The Travel map integration."""

from __future__ import annotations

from homeassistant.components.websocket_api import async_register_command
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv, issue_registry as ir
from homeassistant.helpers.typing import ConfigType

from .api import TravelmapMediaView, websocket_library, websocket_save
from .card import async_register_card, async_unregister_card
from .const import DOMAIN
from .coordinator import (
    TravelmapConfigEntry,
    TravelmapCoordinator,
    folder_issue_id,
    missing_issue_id,
)

PLATFORMS: list[Platform] = [Platform.BUTTON, Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the websocket command and the media view."""
    async_register_command(hass, websocket_library)
    async_register_command(hass, websocket_save)
    hass.http.register_view(TravelmapMediaView())
    return True


async def async_setup_entry(hass: HomeAssistant, entry: TravelmapConfigEntry) -> bool:
    """Set up Travel map from a config entry."""
    coordinator = TravelmapCoordinator(hass, entry)
    # A folder that is not there yet must not stop setup: the entities are
    # unavailable until it appears, and the coordinator keeps looking.
    await coordinator.async_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await async_register_card(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: TravelmapConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: TravelmapConfigEntry) -> None:
    """Clean up the repair issues, and the card when no entry is left."""
    ir.async_delete_issue(hass, DOMAIN, missing_issue_id(entry.entry_id))
    ir.async_delete_issue(hass, DOMAIN, folder_issue_id(entry.entry_id))
    remaining = [
        other
        for other in hass.config_entries.async_entries(DOMAIN)
        if other.entry_id != entry.entry_id
    ]
    if not remaining:
        await async_unregister_card(hass)

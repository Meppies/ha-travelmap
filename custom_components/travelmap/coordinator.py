"""Data update coordinator for Travel map."""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import (
    CONF_PATH,
    CONF_SCAN_INTERVAL,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    LOGGER,
    MISSING_FOLDER_INTERVAL,
)
from .scanner import EMPTY_LIBRARY, Library, scan_library

type TravelmapConfigEntry = ConfigEntry[TravelmapCoordinator]


def folder_issue_id(entry_id: str) -> str:
    """Return the id of the repair issue for a folder that is not there."""
    return f"folder_missing_{entry_id}"


def missing_issue_id(entry_id: str) -> str:
    """Return the id of the repair issue for places without coordinates."""
    return f"missing_coordinates_{entry_id}"


class TravelmapCoordinator(DataUpdateCoordinator[Library]):
    """Scan the folder tree on an interval."""

    config_entry: TravelmapConfigEntry

    def __init__(self, hass: HomeAssistant, entry: TravelmapConfigEntry) -> None:
        """Initialise the coordinator."""
        self._interval = timedelta(
            minutes=entry.options.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)
        )
        super().__init__(
            hass, LOGGER, config_entry=entry, name=DOMAIN, update_interval=self._interval
        )
        self.root = Path(entry.data[CONF_PATH])
        self.last_scan: datetime | None = None
        # The integration loads before its folder exists, so there is always
        # a library, if only an empty one.
        self.data = EMPTY_LIBRARY

    async def _async_update_data(self) -> Library:
        try:
            library = await self.hass.async_add_executor_job(scan_library, self.root)
        except OSError as err:
            if isinstance(err, FileNotFoundError):
                # Network storage that still has to be added, or a NAS that is
                # off: say so once, and look again soon.
                self.update_interval = timedelta(minutes=MISSING_FOLDER_INTERVAL)
                self._async_folder_issue(missing=True)
            raise UpdateFailed(
                translation_domain=DOMAIN,
                translation_key="scan_failed",
                translation_placeholders={"path": str(self.root), "error": str(err)},
            ) from err
        self.update_interval = self._interval
        self._async_folder_issue(missing=False)
        self.last_scan = dt_util.utcnow()
        for warning in library.warnings:
            LOGGER.debug("%s", warning)
        self._async_update_issue(library)
        return library

    def _async_folder_issue(self, *, missing: bool) -> None:
        """Raise or clear the repair issue for a folder that is not there."""
        issue_id = folder_issue_id(self.config_entry.entry_id)
        if not missing:
            ir.async_delete_issue(self.hass, DOMAIN, issue_id)
            return
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            issue_id,
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key="folder_missing",
            translation_placeholders={"path": str(self.root)},
        )

    def _async_update_issue(self, library: Library) -> None:
        """Raise or clear the repair issue for places without coordinates."""
        issue_id = missing_issue_id(self.config_entry.entry_id)
        missing = library.missing
        if not missing:
            ir.async_delete_issue(self.hass, DOMAIN, issue_id)
            return
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            issue_id,
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key="missing_coordinates",
            translation_placeholders={
                "count": str(len(missing)),
                "places": ", ".join(missing),
            },
        )

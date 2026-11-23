"""Base entity for Travel map."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import TravelmapCoordinator


class TravelmapEntity(CoordinatorEntity[TravelmapCoordinator]):
    """Common base for Travel map entities."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: TravelmapCoordinator, key: str) -> None:
        """Initialise the entity."""
        super().__init__(coordinator)
        entry = coordinator.config_entry
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="Travel map",
            model=str(coordinator.root),
            entry_type=DeviceEntryType.SERVICE,
        )

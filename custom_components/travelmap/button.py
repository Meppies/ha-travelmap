"""Button for Travel map."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .const import DOMAIN
from .coordinator import TravelmapConfigEntry
from .entity import TravelmapEntity

# One scan of the folder tree at a time.
PARALLEL_UPDATES = 1


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TravelmapConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the button."""
    async_add_entities([TravelmapRescanButton(entry.runtime_data, "rescan")])


class TravelmapRescanButton(TravelmapEntity, ButtonEntity):
    """Scan the folder tree now, for example after adding photos."""

    _attr_entity_category = EntityCategory.CONFIG

    @property
    def available(self) -> bool:
        """Stay available, so a failed scan can be retried."""
        return True

    async def async_press(self) -> None:
        """Scan the folder tree."""
        await self.coordinator.async_refresh()
        if not self.coordinator.last_update_success:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="rescan_failed",
                translation_placeholders={"path": str(self.coordinator.root)},
            )

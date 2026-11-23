"""Sensors for Travel map."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from .coordinator import TravelmapConfigEntry, TravelmapCoordinator
from .entity import TravelmapEntity

# Entities only read coordinator data.
PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class TravelmapSensorDescription(SensorEntityDescription):
    """Describe a Travel map sensor."""

    value_fn: Callable[[TravelmapCoordinator], int | datetime | None]
    attributes_fn: Callable[[TravelmapCoordinator], dict[str, Any]] | None = None


SENSORS: tuple[TravelmapSensorDescription, ...] = (
    TravelmapSensorDescription(
        key="trips",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda coordinator: len(coordinator.data.trips),
        attributes_fn=lambda coordinator: {"trips": [trip.id for trip in coordinator.data.trips]},
    ),
    TravelmapSensorDescription(
        key="places",
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda coordinator: coordinator.data.place_count,
    ),
    TravelmapSensorDescription(
        key="media_files",
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda coordinator: coordinator.data.media_count,
    ),
    TravelmapSensorDescription(
        key="places_without_coordinates",
        state_class=SensorStateClass.MEASUREMENT,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=lambda coordinator: len(coordinator.data.missing),
        attributes_fn=lambda coordinator: {"places": coordinator.data.missing},
    ),
    TravelmapSensorDescription(
        key="last_scan",
        device_class=SensorDeviceClass.TIMESTAMP,
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=lambda coordinator: coordinator.last_scan,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TravelmapConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the sensors."""
    async_add_entities(TravelmapSensor(entry.runtime_data, description) for description in SENSORS)


class TravelmapSensor(TravelmapEntity, SensorEntity):
    """A count or timestamp taken from the last scan."""

    entity_description: TravelmapSensorDescription

    def __init__(
        self, coordinator: TravelmapCoordinator, description: TravelmapSensorDescription
    ) -> None:
        """Initialise the sensor."""
        super().__init__(coordinator, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> int | datetime | None:
        """Return the value."""
        return self.entity_description.value_fn(self.coordinator)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return the extra attributes, when the sensor has any."""
        if self.entity_description.attributes_fn is None:
            return None
        return self.entity_description.attributes_fn(self.coordinator)

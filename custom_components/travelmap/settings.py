"""What the user arranges in the management panel: order and groups.

Kept in Home Assistant's own storage, one file per config entry, so it works
when the folder is read-only and survives the folder being away.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .scanner import Library, Trip

STORAGE_VERSION = 1


@dataclass(slots=True)
class Settings:
    """The order of the trips and the groups, as stored."""

    order: list[str] = field(default_factory=list)
    groups: list[dict[str, Any]] = field(default_factory=list)


class TravelmapSettings:
    """Load, hold and save the settings of one config entry."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        """Initialise the settings."""
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}")
        self.data = Settings()

    async def async_load(self) -> None:
        """Read the stored settings, when there are any."""
        stored = await self._store.async_load()
        if isinstance(stored, dict):
            self.data = Settings(
                order=[str(item) for item in stored.get("order", [])],
                groups=clean_groups(stored.get("groups", [])),
            )

    async def async_save(
        self, order: list[str] | None = None, groups: list[dict[str, Any]] | None = None
    ) -> None:
        """Replace the order, the groups, or both, and store them."""
        if order is not None:
            self.data.order = list(dict.fromkeys(order))
        if groups is not None:
            self.data.groups = clean_groups(groups)
        await self._store.async_save({"order": self.data.order, "groups": self.data.groups})

    async def async_remove(self) -> None:
        """Delete the stored settings."""
        await self._store.async_remove()

    def ordered_trips(self, library: Library) -> list[Trip]:
        """Return the trips in the user's order; unknown ones keep scan order."""
        position = {trip_id: index for index, trip_id in enumerate(self.data.order)}
        return sorted(library.trips, key=lambda trip: position.get(trip.id, len(position)))

    def groups_for(self, library: Library) -> list[dict[str, Any]]:
        """Return the groups, without items whose folder is gone."""
        places = {trip.id: {place.id for place in trip.places} for trip in library.trips}
        return [
            {
                **group,
                "items": [
                    item
                    for item in group["items"]
                    if item["trip"] in places
                    and ("place" not in item or item["place"] in places[item["trip"]])
                ],
            }
            for group in self.data.groups
        ]


def clean_groups(groups: Any) -> list[dict[str, Any]]:
    """Return groups in the stored shape: an id, a name and ordered items."""
    cleaned: list[dict[str, Any]] = []
    if not isinstance(groups, list):
        return cleaned
    for group in groups:
        if not isinstance(group, dict):
            continue
        name = str(group.get("name") or "").strip()
        if not name:
            continue
        items: list[dict[str, str]] = []
        for item in group.get("items") or []:
            if not isinstance(item, dict) or not item.get("trip"):
                continue
            entry = {"trip": str(item["trip"])}
            if item.get("place"):
                entry["place"] = str(item["place"])
            if entry not in items:
                items.append(entry)
        cleaned.append(
            {"id": str(group.get("id") or uuid.uuid4().hex[:8]), "name": name, "items": items}
        )
    return cleaned

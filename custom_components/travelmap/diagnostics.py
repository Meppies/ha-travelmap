"""Diagnostics for Travel map."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

from .coordinator import TravelmapConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: TravelmapConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry.

    Counts only: folder and file names say where someone has been, so they
    stay out of a file that is meant to be shared.
    """
    coordinator = entry.runtime_data
    library = coordinator.data
    return {
        "options": dict(entry.options),
        "last_update_success": coordinator.last_update_success,
        "last_scan": coordinator.last_scan.isoformat() if coordinator.last_scan else None,
        "trips": len(library.trips),
        "groups": len(coordinator.settings.data.groups),
        "custom_order": bool(coordinator.settings.data.order),
        "places": library.place_count,
        "media_files": library.media_count,
        "places_without_coordinates": len(library.missing),
        "warnings": len(library.warnings),
        "places_per_trip": [len(trip.places) for trip in library.trips],
        "coordinate_sources": {
            source: sum(
                1 for trip in library.trips for place in trip.places if place.source == source
            )
            for source in ("exif", "trip.yaml")
        },
    }

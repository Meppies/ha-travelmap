"""Config flow for Travel map."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.config_entries import (
    ConfigEntryState,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlowWithReload,
)
from homeassistant.const import CONF_LATITUDE, CONF_LOCATION, CONF_LONGITUDE
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.selector import (
    LocationSelector,
    LocationSelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
)
import probatio as vol

from .const import (
    CONF_PATH,
    CONF_PLACE,
    CONF_SCAN_INTERVAL,
    CONF_TRIP,
    DEFAULT_PATH,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)
from .coordinator import TravelmapConfigEntry, TravelmapCoordinator
from .scanner import ROOT_PLACE, Library, Place, Trip
from .writer import TripFileError, write_place_coordinates

PATH_SCHEMA = vol.Schema({vol.Required(CONF_PATH): TextSelector()})
OPTIONS_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_SCAN_INTERVAL): NumberSelector(
            NumberSelectorConfig(
                min=MIN_SCAN_INTERVAL,
                max=MAX_SCAN_INTERVAL,
                step=1,
                mode=NumberSelectorMode.BOX,
                unit_of_measurement="min",
            )
        )
    }
)


def _normalise(path: str) -> str:
    """Return the path without surrounding space or a trailing slash."""
    path = path.strip()
    return path.rstrip("/") or path


def _check_path(hass: HomeAssistant, path: str) -> str | None:
    """Return an error key when the folder cannot be used. Blocking.

    The folder does not have to exist yet: network storage is often added
    after the integration.
    """
    if not Path(path).is_absolute():
        return "path_not_absolute"
    if Path(path).exists() and not Path(path).is_dir():
        return "path_not_a_folder"
    if not hass.config.is_allowed_path(path):
        return "path_not_allowed"
    return None


def _folder(place: Place) -> str:
    """Return the folder of a place as the user knows it."""
    return f"{place.name} (/)" if place.id == ROOT_PLACE else place.id


class TravelmapConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the config flow."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(entry: TravelmapConfigEntry) -> TravelmapOptionsFlow:
        """Return the options flow."""
        return TravelmapOptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Ask for the folder that holds the trips."""
        errors: dict[str, str] = {}
        if user_input is not None:
            path = _normalise(user_input[CONF_PATH])
            self._async_abort_entries_match({CONF_PATH: path})
            error = await self.hass.async_add_executor_job(_check_path, self.hass, path)
            if error is None:
                return self.async_create_entry(
                    title=Path(path).name or path, data={CONF_PATH: path}
                )
            errors[CONF_PATH] = error
        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(
                PATH_SCHEMA, user_input or {CONF_PATH: DEFAULT_PATH}
            ),
            errors=errors,
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Point an existing entry at another folder."""
        entry = self._get_reconfigure_entry()
        errors: dict[str, str] = {}
        if user_input is not None:
            path = _normalise(user_input[CONF_PATH])
            if path != entry.data[CONF_PATH]:
                self._async_abort_entries_match({CONF_PATH: path})
            error = await self.hass.async_add_executor_job(_check_path, self.hass, path)
            if error is None:
                return self.async_update_reload_and_abort(
                    entry, title=Path(path).name or path, data_updates={CONF_PATH: path}
                )
            errors[CONF_PATH] = error
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                PATH_SCHEMA, user_input or {CONF_PATH: entry.data[CONF_PATH]}
            ),
            errors=errors,
        )


class TravelmapOptionsFlow(OptionsFlowWithReload):
    """Handle the options: the scan interval, and coordinates per place."""

    _trip: str | None = None
    _place: str | None = None

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Choose between the places and the settings."""
        return self.async_show_menu(step_id="init", menu_options=["trip", "settings"])

    async def async_step_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Set how often the folder is scanned."""
        if user_input is not None:
            return self.async_create_entry(
                data={CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL])}
            )
        return self.async_show_form(
            step_id="settings",
            data_schema=self.add_suggested_values_to_schema(
                OPTIONS_SCHEMA,
                {
                    CONF_SCAN_INTERVAL: self.config_entry.options.get(
                        CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
                    )
                },
            ),
        )

    def _library(self) -> Library | None:
        """Return the scanned folder tree, when the entry is loaded."""
        if self.config_entry.state is not ConfigEntryState.LOADED:
            return None
        coordinator: TravelmapCoordinator = self.config_entry.runtime_data
        return coordinator.data

    def _find_trip(self) -> Trip | None:
        library = self._library()
        if library is None:
            return None
        return next((trip for trip in library.trips if trip.id == self._trip), None)

    async def async_step_trip(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Show the trip folders."""
        library = self._library()
        if library is None or not library.trips:
            return self.async_abort(reason="no_trips")
        if user_input is not None:
            self._trip = user_input[CONF_TRIP]
            return await self.async_step_place()
        if len(library.trips) == 1:
            self._trip = library.trips[0].id
            return await self.async_step_place()
        options = [
            SelectOptionDict(
                value=trip.id,
                label=(
                    f"{trip.id} · {sum(1 for p in trip.places if p.latitude is not None)}"
                    f"/{len(trip.places)}"
                ),
            )
            for trip in library.trips
        ]
        return self.async_show_form(
            step_id="trip",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_TRIP): SelectSelector(
                        SelectSelectorConfig(options=options, mode=SelectSelectorMode.LIST)
                    )
                }
            ),
        )

    async def async_step_place(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Show the place folders of the trip, with what is known of each."""
        trip = self._find_trip()
        if trip is None or not trip.places:
            return self.async_abort(reason="no_places")
        if user_input is not None:
            self._place = user_input[CONF_PLACE]
            return await self.async_step_coordinates()
        if len(trip.places) == 1:
            # Nothing to choose between, as with a trip folder that holds
            # its photos itself.
            self._place = trip.places[0].id
            return await self.async_step_coordinates()
        options = [
            SelectOptionDict(
                value=place.id,
                label=(
                    f"✓ {_folder(place)} · {place.latitude:.4f}, {place.longitude:.4f}"
                    f" ({place.source})"
                    if place.latitude is not None and place.longitude is not None
                    else f"✗ {_folder(place)}"
                ),
            )
            for place in trip.places
        ]
        return self.async_show_form(
            step_id="place",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_PLACE): SelectSelector(
                        SelectSelectorConfig(options=options, mode=SelectSelectorMode.LIST)
                    )
                }
            ),
            description_placeholders={"trip": trip.id},
        )

    def _suggested_location(self, trip: Trip, place: Place) -> dict[str, float]:
        """Return where the map opens: the place, a neighbour, or home."""
        known = [place] if place.latitude is not None else []
        known += [other for other in trip.places if other.latitude is not None]
        if known and known[0].latitude is not None and known[0].longitude is not None:
            return {CONF_LATITUDE: known[0].latitude, CONF_LONGITUDE: known[0].longitude}
        return {
            CONF_LATITUDE: self.hass.config.latitude,
            CONF_LONGITUDE: self.hass.config.longitude,
        }

    async def async_step_coordinates(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Type the coordinates of the place, or pick them on the map."""
        trip = self._find_trip()
        place = next((p for p in trip.places if p.id == self._place), None) if trip else None
        if trip is None or place is None:
            return self.async_abort(reason="no_places")
        coordinator: TravelmapCoordinator = self.config_entry.runtime_data
        errors: dict[str, str] = {}
        if user_input is not None:
            location = user_input[CONF_LOCATION]
            try:
                await self.hass.async_add_executor_job(
                    write_place_coordinates,
                    coordinator.root,
                    trip.id,
                    place.id,
                    location[CONF_LATITUDE],
                    location[CONF_LONGITUDE],
                )
            except TripFileError:
                errors["base"] = "trip_file_invalid"
            except OSError:
                errors["base"] = "write_failed"
            else:
                await coordinator.async_refresh()
                return await self.async_step_saved()
        return self.async_show_form(
            step_id="coordinates",
            data_schema=self.add_suggested_values_to_schema(
                vol.Schema(
                    {vol.Required(CONF_LOCATION): LocationSelector(LocationSelectorConfig())}
                ),
                user_input or {CONF_LOCATION: self._suggested_location(trip, place)},
            ),
            errors=errors,
            description_placeholders={
                "trip": trip.id,
                "place": _folder(place),
                "current": (
                    f"{place.latitude:.6f}, {place.longitude:.6f} ({place.source})"
                    if place.latitude is not None and place.longitude is not None
                    else "–"
                ),
            },
        )

    async def async_step_saved(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Offer the next place, another trip, or the way out."""
        return self.async_show_menu(
            step_id="saved",
            menu_options=["place", "trip", "finish"],
            description_placeholders={
                "trip": self._trip or "",
                "place": (self._trip if self._place == ROOT_PLACE else self._place) or "",
            },
        )

    async def async_step_finish(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Close the flow; the options themselves are unchanged."""
        return self.async_create_entry(data=dict(self.config_entry.options))

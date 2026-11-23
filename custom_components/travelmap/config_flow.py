"""Config flow for Travel map."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.config_entries import (
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlowWithReload,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
)
import probatio as vol

from .const import (
    CONF_PATH,
    CONF_SCAN_INTERVAL,
    DEFAULT_PATH,
    DEFAULT_SCAN_INTERVAL,
    DOMAIN,
    MAX_SCAN_INTERVAL,
    MIN_SCAN_INTERVAL,
)
from .coordinator import TravelmapConfigEntry

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
    """Handle the options."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Set how often the folder is scanned."""
        if user_input is not None:
            return self.async_create_entry(
                data={CONF_SCAN_INTERVAL: int(user_input[CONF_SCAN_INTERVAL])}
            )
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                OPTIONS_SCHEMA,
                {
                    CONF_SCAN_INTERVAL: self.config_entry.options.get(
                        CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
                    )
                },
            ),
        )

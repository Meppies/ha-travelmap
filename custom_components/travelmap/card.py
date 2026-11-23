"""Serve and register the Travel map dashboard card and management panel."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http.server import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN, LOGGER

CARD_FILENAME = "travelmap-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"
CARD_PATH = Path(__file__).parent / "www" / CARD_FILENAME
PANEL_FILENAME = "travelmap-panel.js"
PANEL_URL = f"/{DOMAIN}/{PANEL_FILENAME}"
PANEL_PATH = Path(__file__).parent / "www" / PANEL_FILENAME
PANEL_URL_PATH = DOMAIN
PANEL_TITLES = {"nl": "Reiskaart"}
DATA_STATIC_REGISTERED = f"{DOMAIN}_card_static"


async def _async_card_url(hass: HomeAssistant) -> str:
    integration = await async_get_integration(hass, DOMAIN)
    return f"{CARD_URL}?v={integration.version}"


def _storage_resources(hass: HomeAssistant) -> Any:
    """Return the Lovelace resource collection when it is storage based."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None or getattr(lovelace, "resource_mode", None) != "storage":
        return None
    return getattr(lovelace, "resources", None)


async def async_register_card(hass: HomeAssistant) -> None:
    """Serve the card and make it available in every dashboard.

    The card is added both as a frontend module and as a dashboard resource,
    so it shows up in the card picker. Failures are logged and never block
    setup of the integration.
    """
    url = await _async_card_url(hass)
    try:
        if not hass.data.get(DATA_STATIC_REGISTERED):
            await hass.http.async_register_static_paths(
                [
                    StaticPathConfig(CARD_URL, str(CARD_PATH), True),
                    StaticPathConfig(PANEL_URL, str(PANEL_PATH), True),
                ]
            )
            hass.data[DATA_STATIC_REGISTERED] = True
        add_extra_js_url(hass, url)
        await _async_sync_resource(hass, url)
    except Exception:  # noqa: BLE001
        LOGGER.warning("Could not register the Travel map card", exc_info=True)
    try:
        await _async_register_panel(hass, url.split("?")[1])
    except Exception:  # noqa: BLE001
        LOGGER.warning("Could not register the Travel map panel", exc_info=True)


async def _async_register_panel(hass: HomeAssistant, version: str) -> None:
    """Add the management panel to the sidebar, for administrators."""
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        return
    from homeassistant.components import panel_custom

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="travelmap-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{PANEL_URL}?{version}",
        sidebar_title=PANEL_TITLES.get(hass.config.language, "Travel map"),
        sidebar_icon="mdi:map-marker-path",
        require_admin=True,
        config={},
    )


async def _async_sync_resource(hass: HomeAssistant, url: str) -> None:
    resources = _storage_resources(hass)
    if resources is None:
        return
    await resources.async_get_info()
    ours = [
        item
        for item in resources.async_items()
        if str(item.get("url", "")).split("?")[0] == CARD_URL
    ]
    if not ours:
        await resources.async_create_item({"res_type": "module", "url": url})
        return
    first, *duplicates = ours
    if first["url"] != url:
        await resources.async_update_item(first["id"], {"url": url})
    for item in duplicates:
        await resources.async_delete_item(item["id"])


async def async_unregister_card(hass: HomeAssistant) -> None:
    """Remove the card resource when the last entry goes."""
    url = await _async_card_url(hass)
    try:
        from homeassistant.components import frontend

        frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    except Exception:  # noqa: BLE001
        LOGGER.warning("Could not remove the Travel map panel", exc_info=True)
    try:
        remove_extra_js_url(hass, url)
        resources = _storage_resources(hass)
        if resources is None:
            return
        await resources.async_get_info()
        for item in list(resources.async_items()):
            if str(item.get("url", "")).split("?")[0] == CARD_URL:
                await resources.async_delete_item(item["id"])
    except Exception:  # noqa: BLE001
        LOGGER.warning("Could not remove the Travel map card resource", exc_info=True)

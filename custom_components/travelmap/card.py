"""Serve and register the Travel map dashboard card."""

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
                [StaticPathConfig(CARD_URL, str(CARD_PATH), True)]
            )
            hass.data[DATA_STATIC_REGISTERED] = True
        add_extra_js_url(hass, url)
        await _async_sync_resource(hass, url)
    except Exception:  # noqa: BLE001
        LOGGER.warning("Could not register the Travel map card", exc_info=True)


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

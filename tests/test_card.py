"""Tests for serving and registering the dashboard card."""

from __future__ import annotations

from collections.abc import Generator
import re
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from homeassistant.core import HomeAssistant
import pytest

from custom_components.travelmap import card
from custom_components.travelmap.card import (
    CARD_PATH,
    CARD_URL,
    async_register_card,
    async_unregister_card,
)


class FakeResources:
    """Minimal storage-mode Lovelace resource collection."""

    def __init__(self, items: list[dict[str, Any]] | None = None) -> None:
        self.items = list(items or [])
        self.loaded = False

    async def async_get_info(self) -> dict[str, int]:
        self.loaded = True
        return {"resources": len(self.items)}

    def async_items(self) -> list[dict[str, Any]]:
        return list(self.items)

    async def async_create_item(self, data: dict[str, Any]) -> None:
        self.items.append(
            {
                "id": f"new{len(self.items)}",
                "type": data["res_type"],
                "url": data["url"],
            }
        )

    async def async_update_item(self, item_id: str, data: dict[str, Any]) -> None:
        for item in self.items:
            if item["id"] == item_id:
                item.update(data)

    async def async_delete_item(self, item_id: str) -> None:
        self.items = [item for item in self.items if item["id"] != item_id]


@pytest.fixture
def frontend() -> Generator[MagicMock]:
    """Patch the frontend helpers."""
    with (
        patch.object(card, "add_extra_js_url") as add,
        patch.object(card, "remove_extra_js_url") as remove,
    ):
        add.remove = remove
        yield add


def _setup(hass: HomeAssistant, resources: Any, mode: str = "storage") -> MagicMock:
    hass.data["lovelace"] = SimpleNamespace(resource_mode=mode, resources=resources)
    http = MagicMock()
    http.async_register_static_paths = AsyncMock()
    hass.http = http
    return http


async def _url(hass: HomeAssistant) -> str:
    return await card._async_card_url(hass)


def test_panel_file_exists() -> None:
    """The management panel ships with the integration."""
    assert card.PANEL_PATH.is_file()
    assert 'customElements.define("travelmap-panel"' in card.PANEL_PATH.read_text()


async def test_panel_registration(hass: HomeAssistant, frontend: MagicMock) -> None:
    """The panel is registered once, in the server language, and removed again."""
    _setup(hass, FakeResources())
    hass.config.language = "nl"
    with (
        patch("homeassistant.components.panel_custom.async_register_panel") as register,
        patch("homeassistant.components.frontend.async_remove_panel") as remove,
    ):
        await async_register_card(hass)
        kwargs = register.await_args.kwargs
        assert kwargs["frontend_url_path"] == "travelmap"
        assert kwargs["sidebar_title"] == "Reiskaart"
        assert kwargs["require_admin"] is True
        assert kwargs["module_url"].startswith("/travelmap/travelmap-panel.js?v=")

        hass.data["frontend_panels"] = {"travelmap": object()}
        await async_register_card(hass)
        register.assert_awaited_once()

        await async_unregister_card(hass)
        remove.assert_called_once_with(hass, "travelmap", warn_if_unknown=False)


async def test_panel_failures_are_logged(
    hass: HomeAssistant, frontend: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    """A panel that cannot be registered or removed never stops the rest."""
    _setup(hass, FakeResources())
    with (
        patch(
            "homeassistant.components.panel_custom.async_register_panel",
            side_effect=RuntimeError("boom"),
        ),
        patch(
            "homeassistant.components.frontend.async_remove_panel",
            side_effect=RuntimeError("boom"),
        ),
    ):
        await async_register_card(hass)
        await async_unregister_card(hass)
    assert "Could not register the Travel map panel" in caplog.text
    assert "Could not remove the Travel map panel" in caplog.text


def test_card_file_exists() -> None:
    """The card ships with the integration."""
    assert CARD_PATH.is_file()
    assert 'customElements.define("travelmap-card"' in CARD_PATH.read_text()


async def test_register_creates_resource(hass: HomeAssistant, frontend: MagicMock) -> None:
    """A new install gets the static path, the module and one resource."""
    resources = FakeResources()
    http = _setup(hass, resources)
    await async_register_card(hass)
    await async_register_card(hass)

    http.async_register_static_paths.assert_awaited_once()
    url = await _url(hass)
    assert url.startswith(f"{CARD_URL}?v=")
    frontend.assert_called_with(hass, url)
    assert [item["url"] for item in resources.items] == [url]
    assert resources.items[0]["type"] == "module"


async def test_register_updates_version_and_removes_duplicates(
    hass: HomeAssistant, frontend: MagicMock
) -> None:
    """An upgrade moves the resource to the new version and drops extra copies."""
    resources = FakeResources(
        [
            {"id": "a", "type": "module", "url": f"{CARD_URL}?v=0.1"},
            {"id": "b", "type": "module", "url": f"{CARD_URL}?v=0.2"},
            {"id": "c", "type": "module", "url": "/other/card.js"},
        ]
    )
    _setup(hass, resources)
    await async_register_card(hass)
    url = await _url(hass)
    assert {item["id"]: item["url"] for item in resources.items} == {
        "a": url,
        "c": "/other/card.js",
    }

    # Already current: nothing changes.
    await async_register_card(hass)
    assert len(resources.items) == 2


async def test_register_yaml_mode_leaves_resources(
    hass: HomeAssistant, frontend: MagicMock
) -> None:
    """YAML-mode dashboards are not touched; the module is still added."""
    resources = FakeResources()
    _setup(hass, resources, mode="yaml")
    await async_register_card(hass)
    assert resources.items == []
    frontend.assert_called_once()


async def test_register_never_raises(
    hass: HomeAssistant, frontend: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    """A failure is logged and does not stop setup."""
    http = _setup(hass, FakeResources())
    http.async_register_static_paths.side_effect = RuntimeError("boom")
    await async_register_card(hass)
    assert "Could not register the Travel map card" in caplog.text


async def test_unregister(hass: HomeAssistant, frontend: MagicMock) -> None:
    """Unregistering removes our resource and the module, nothing else."""
    resources = FakeResources(
        [
            {"id": "a", "type": "module", "url": f"{CARD_URL}?v=1"},
            {"id": "c", "type": "module", "url": "/other/card.js"},
        ]
    )
    _setup(hass, resources)
    await async_unregister_card(hass)
    assert [item["id"] for item in resources.items] == ["c"]
    frontend.remove.assert_called_once()


async def test_unregister_without_lovelace(
    hass: HomeAssistant, frontend: MagicMock, caplog: pytest.LogCaptureFixture
) -> None:
    """No storage dashboards: only the module is removed; errors are logged."""
    await async_unregister_card(hass)
    frontend.remove.assert_called_once()

    frontend.remove.side_effect = RuntimeError("boom")
    await async_unregister_card(hass)
    assert "Could not remove the Travel map card resource" in caplog.text


def test_card_has_no_duplicate_methods() -> None:
    """A method defined twice silently replaces the first one."""
    names = re.findall(
        r"^  (?:static )?(?:async )?(?:get |set )?(\w+)\(", CARD_PATH.read_text(), re.M
    )
    duplicates = {name for name in names if names.count(name) > 1} - {"hass"}
    assert not duplicates

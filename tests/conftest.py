"""Fixtures for Travel map tests."""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from typing import Literal
from unittest.mock import AsyncMock, patch

from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.travelmap.const import CONF_PATH, DOMAIN

TRIP_YAML = """\
title: Japan
country: Japan
start: 2026-04-01
finish: 2026-04-14
places:
  tokyo:
    lat: 35.6762
    lon: 139.6503
  kyoto:
    lat: 1.0
    lon: 1.0
    name: Kyōto
  nara:
    lat: 34.6851
    lon: 135.8048
"""


def exif_jpeg(
    lat: float,
    lon: float,
    order: Literal["little", "big"] = "little",
    *,
    with_refs: bool = True,
) -> bytes:
    """Return a minimal JPEG whose EXIF block carries the given position."""

    def num(value: int, length: int) -> bytes:
        return value.to_bytes(length, order)

    def entry(tag: int, typ: int, count: int, value: bytes) -> bytes:
        return num(tag, 2) + num(typ, 2) + num(count, 4) + value.ljust(4, b"\x00")

    def dms(value: float) -> bytes:
        millis = round(abs(value) * 3600 * 1000)
        seconds, rest = divmod(millis, 1000)
        parts = [
            (seconds // 3600, 1),
            ((seconds // 60) % 60, 1),
            ((seconds % 60) * 1000 + rest, 1000),
        ]
        return b"".join(num(n, 4) + num(d, 4) for n, d in parts)

    count = 4 if with_refs else 2
    gps_offset = 8 + 2 + 12 + 4
    data_offset = gps_offset + 2 + 12 * count + 4
    gps = num(count, 2)
    if with_refs:
        gps += entry(1, 2, 2, b"N\x00" if lat >= 0 else b"S\x00")
    gps += entry(2, 5, 3, num(data_offset, 4))
    if with_refs:
        gps += entry(3, 2, 2, b"E\x00" if lon >= 0 else b"W\x00")
    gps += entry(4, 5, 3, num(data_offset + 24, 4))
    gps += num(0, 4)
    ifd0 = num(1, 2) + entry(0x8825, 4, 1, num(gps_offset, 4)) + num(0, 4)
    header = (b"II" if order == "little" else b"MM") + num(42, 2) + num(8, 4)
    payload = b"Exif\x00\x00" + header + ifd0 + gps + dms(lat) + dms(lon)
    app0 = b"\xff\xe0" + (4).to_bytes(2, "big") + b"JF"
    app1 = b"\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload
    return b"\xff\xd8" + app0 + app1 + b"\xff\xd9"


PLAIN_JPEG = b"\xff\xd8\xff\xe0\x00\x04JF\xff\xda\x00\x02\xff\xd9"


def build_library(root: Path) -> Path:
    """Create a folder tree with two trips."""
    japan = root / "2026-japan"
    for place in ("tokyo", "kyoto", "nara", "osaka"):
        (japan / place).mkdir(parents=True)
    (japan / "trip.yaml").write_text(TRIP_YAML, encoding="utf-8")
    (japan / "tokyo" / "10.jpg").write_bytes(PLAIN_JPEG)
    (japan / "tokyo" / "2.jpg").write_bytes(PLAIN_JPEG)
    (japan / "tokyo" / "notes.txt").write_text("not media")
    (japan / "tokyo" / ".hidden.jpg").write_bytes(PLAIN_JPEG)
    (japan / "tokyo" / "sub.jpg").mkdir()
    (japan / "kyoto" / "001 temple.jpg").write_bytes(exif_jpeg(35.0115, 135.7681))
    (japan / "kyoto" / "clip.MP4").write_bytes(b"video")
    (japan / "osaka" / "a.png").write_bytes(b"png")
    (japan / "@eaDir").mkdir()
    (root / "_project").mkdir()
    (root / ".hidden").mkdir()
    (root / "index.json").write_text("{}")
    other = root / "2025-loose"
    (other / "a").mkdir(parents=True)
    (other / "a" / "x.webp").write_bytes(b"webp")
    return root


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom integrations in every test."""


@pytest.fixture
def library_root(hass: HomeAssistant, tmp_path: Path) -> Path:
    """Return a folder of trips that Home Assistant may read."""
    root = build_library(tmp_path / "trips")
    hass.config.allowlist_external_dirs = {str(tmp_path)}
    return root


@pytest.fixture
def mock_entry(library_root: Path) -> MockConfigEntry:
    """Return a config entry for the folder."""
    return MockConfigEntry(
        domain=DOMAIN,
        title="trips",
        entry_id="entry1",
        data={CONF_PATH: str(library_root)},
    )


@pytest.fixture
def card() -> Generator[dict[str, AsyncMock]]:
    """Keep card registration out of tests that are not about the card."""
    with (
        patch("custom_components.travelmap.async_register_card") as register,
        patch("custom_components.travelmap.async_unregister_card") as unregister,
    ):
        yield {"register": register, "unregister": unregister}


async def setup_integration(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    """Add and set up the entry."""
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

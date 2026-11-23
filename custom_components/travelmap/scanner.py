"""Scan a folder of trips into the library that the card shows.

Layout on disk: one folder per trip, one subfolder per place. A trip folder
may also hold photos itself; it is then a place of its own.

    trips/
      2026-japan/
        trip.yaml
        tokyo/
          001.jpg
        kyoto/
          011.jpg
      bali/
        001.jpg

Coordinates of a place, in order of preference:

1. ``places.<folder name>`` in ``trip.yaml``, or ``lat`` and ``lon`` at the
   top of that file for photos in the trip folder itself. This is what the
   user typed or picked on the map, so it wins.
2. EXIF GPS data of the first JPEG in the place folder that carries it.
3. None: the place gets no marker and is reported.

Places listed in ``trip.yaml`` keep the order of that file, which is the order
of travel. Places that are not listed follow in natural sort order.

Everything in this module is blocking and runs in the executor.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any, Literal

import yaml

MEDIA_EXTENSIONS: dict[str, str] = {
    "jpg": "image",
    "jpeg": "image",
    "png": "image",
    "webp": "image",
    "avif": "image",
    "gif": "image",
    "mp4": "video",
    "m4v": "video",
    "mov": "video",
    "webm": "video",
}
JPEG_EXTENSIONS = {"jpg", "jpeg"}
# The place that stands for photos in the trip folder itself. Folders with
# this name are skipped (see SKIP_PREFIXES), so it cannot clash with one.
ROOT_PLACE = "_"
TRIP_FILES = ("trip.yaml", "trip.yml")
# Folders that are never a trip or a place: hidden, internal to this project,
# or Synology housekeeping (@eaDir, #recycle).
SKIP_PREFIXES = (".", "_", "@", "#")

# EXIF sits in an APP1 segment at the start of the file.
EXIF_READ_LIMIT = 256 * 1024
TAG_GPS_IFD_POINTER = 0x8825
TAG_GPS_LAT_REF = 1
TAG_GPS_LAT = 2
TAG_GPS_LON_REF = 3
TAG_GPS_LON = 4
TYPE_ASCII = 2
TYPE_RATIONAL = 5

type Coordinates = tuple[float, float]


@dataclass(frozen=True, slots=True)
class MediaItem:
    """One photo or video in a place folder."""

    file: str
    kind: str
    size: int


@dataclass(frozen=True, slots=True)
class Place:
    """One place of a trip. The folder name is its identity."""

    id: str
    name: str
    latitude: float | None
    longitude: float | None
    source: str | None
    media: tuple[MediaItem, ...]


@dataclass(frozen=True, slots=True)
class Trip:
    """One trip. The folder name is its identity."""

    id: str
    title: str
    country: str | None
    start: str | None
    finish: str | None
    places: tuple[Place, ...]


@dataclass(frozen=True, slots=True)
class Library:
    """Everything found below the root folder."""

    trips: tuple[Trip, ...]
    warnings: tuple[str, ...]
    files: frozenset[tuple[str, str, str]]

    @property
    def place_count(self) -> int:
        """Return the number of places over all trips."""
        return sum(len(trip.places) for trip in self.trips)

    @property
    def media_count(self) -> int:
        """Return the number of photos and videos over all trips."""
        return len(self.files)

    @property
    def missing(self) -> list[str]:
        """Return ``trip/place`` for every place without coordinates."""
        return [
            trip.id if place.id == ROOT_PLACE else f"{trip.id}/{place.id}"
            for trip in self.trips
            for place in trip.places
            if place.latitude is None
        ]

    def has_media(self, trip: str, place: str, file: str) -> bool:
        """Return whether the file is part of the scanned library."""
        return (trip, place, file) in self.files


EMPTY_LIBRARY = Library(trips=(), warnings=(), files=frozenset())


def natural_key(name: str) -> list[int | str]:
    """Sort key that puts 2.jpg before 10.jpg."""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def read_exif_gps(data: bytes) -> Coordinates | None:
    """Return (latitude, longitude) from the EXIF block of a JPEG, or None."""
    if data[:2] != b"\xff\xd8":
        return None
    offset = 2
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            return None
        marker = data[offset + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            offset += 2
            continue
        if marker in (0xD9, 0xDA):
            # End of image or start of scan: no metadata follows.
            return None
        size = int.from_bytes(data[offset + 2 : offset + 4], "big")
        if marker == 0xE1 and data[offset + 4 : offset + 10] == b"Exif\x00\x00":
            return _tiff_gps(data[offset + 10 : offset + 2 + size])
        offset += 2 + size
    return None


def _tiff_gps(tiff: bytes) -> Coordinates | None:
    """Return the coordinates from the GPS IFD of a TIFF block."""
    if tiff[:2] not in (b"II", b"MM"):
        return None
    order: Literal["little", "big"] = "big" if tiff[:2] == b"MM" else "little"

    def uint(offset: int, length: int) -> int:
        return int.from_bytes(tiff[offset : offset + length], order)

    def entries(ifd: int) -> list[int]:
        count = uint(ifd, 2)
        return [
            ifd + 2 + 12 * index for index in range(count) if ifd + 14 + 12 * index <= len(tiff)
        ]

    def rationals(entry: int) -> list[float] | None:
        if uint(entry + 2, 2) != TYPE_RATIONAL or uint(entry + 4, 4) != 3:
            return None
        start = uint(entry + 8, 4)
        if start + 24 > len(tiff):
            return None
        values = []
        for index in range(3):
            numerator = uint(start + 8 * index, 4)
            denominator = uint(start + 8 * index + 4, 4)
            values.append(numerator / denominator if denominator else 0.0)
        return values

    def reference(entry: int) -> str:
        if uint(entry + 2, 2) != TYPE_ASCII:
            return ""
        return tiff[entry + 8 : entry + 9].decode("ascii", "replace").upper()

    gps_ifd = next(
        (
            uint(entry + 8, 4)
            for entry in entries(uint(4, 4))
            if uint(entry, 2) == TAG_GPS_IFD_POINTER
        ),
        None,
    )
    if gps_ifd is None:
        return None

    found: dict[int, int] = {uint(entry, 2): entry for entry in entries(gps_ifd)}
    if TAG_GPS_LAT not in found or TAG_GPS_LON not in found:
        return None
    latitude = rationals(found[TAG_GPS_LAT])
    longitude = rationals(found[TAG_GPS_LON])
    if latitude is None or longitude is None:
        return None

    def degrees(values: list[float], negative: bool) -> float:
        value = values[0] + values[1] / 60 + values[2] / 3600
        return -value if negative else value

    south = TAG_GPS_LAT_REF in found and reference(found[TAG_GPS_LAT_REF]) == "S"
    west = TAG_GPS_LON_REF in found and reference(found[TAG_GPS_LON_REF]) == "W"
    return _valid(degrees(latitude, south), degrees(longitude, west))


def _valid(latitude: float, longitude: float) -> Coordinates | None:
    """Return the pair when it is a real position on earth."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    if latitude == 0 and longitude == 0:
        # Cameras without a fix write 0, 0.
        return None
    return round(latitude, 6), round(longitude, 6)


def _exif_coordinates(place_dir: Path, media: tuple[MediaItem, ...]) -> Coordinates | None:
    """Return the coordinates of the first JPEG that carries them."""
    for item in media:
        if item.file.rsplit(".", 1)[-1].lower() not in JPEG_EXTENSIONS:
            continue
        try:
            with (place_dir / item.file).open("rb") as handle:
                found = read_exif_gps(handle.read(EXIF_READ_LIMIT))
        except OSError:
            continue
        if found is not None:
            return found
    return None


def _manual_coordinates(entry: Any) -> Coordinates | None:
    """Return the coordinates of one ``places`` entry in trip.yaml."""
    if not isinstance(entry, dict):
        return None
    try:
        return _valid(float(entry["lat"]), float(entry["lon"]))
    except (KeyError, TypeError, ValueError):
        return None


def _subfolders(folder: Path) -> list[Path]:
    return sorted(
        (
            item
            for item in folder.iterdir()
            if item.is_dir() and not item.name.startswith(SKIP_PREFIXES)
        ),
        key=lambda item: natural_key(item.name),
    )


def _collect_media(place_dir: Path) -> tuple[MediaItem, ...]:
    media = []
    for item in sorted(place_dir.iterdir(), key=lambda entry: natural_key(entry.name)):
        kind = MEDIA_EXTENSIONS.get(item.suffix.lower().lstrip("."))
        if kind is None or item.name.startswith(".") or not item.is_file():
            continue
        media.append(MediaItem(file=item.name, kind=kind, size=item.stat().st_size))
    return tuple(media)


def _load_meta(trip_dir: Path, warnings: list[str]) -> dict[str, Any]:
    """Return the content of trip.yaml, or an empty mapping."""
    for name in TRIP_FILES:
        path = trip_dir / name
        if not path.is_file():
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, yaml.YAMLError) as err:
            warnings.append(f"{trip_dir.name}: {name} cannot be read: {err}")
            return {}
        if isinstance(data, dict):
            return data
        warnings.append(f"{trip_dir.name}: {name} is not a mapping")
        return {}
    warnings.append(f"{trip_dir.name}: no trip.yaml, folder name used as title")
    return {}


def _text(value: Any) -> str | None:
    return str(value) if value not in (None, "") else None


def _scan_trip(trip_dir: Path, warnings: list[str]) -> Trip:
    meta = _load_meta(trip_dir, warnings)
    manual = meta.get("places")
    if not isinstance(manual, dict):
        if manual is not None:
            warnings.append(f"{trip_dir.name}: places in trip.yaml is not a mapping")
        manual = {}

    # trip.yaml carries the order of travel; unlisted folders follow.
    listed = {str(name): index for index, name in enumerate(manual)}
    place_dirs = sorted(
        _subfolders(trip_dir),
        key=lambda item: (listed.get(item.name, len(listed)), natural_key(item.name)),
    )
    title = _text(meta.get("title")) or trip_dir.name
    places = []
    # Photos in the trip folder itself: the trip is its own first place.
    direct = _collect_media(trip_dir)
    if direct:
        coordinates = _manual_coordinates(meta)
        direct_source: str | None = "trip.yaml"
        if coordinates is None:
            coordinates = _exif_coordinates(trip_dir, direct)
            direct_source = "exif"
        if coordinates is None:
            direct_source = None
            warnings.append(
                f"{trip_dir.name}: no coordinates in trip.yaml and no EXIF GPS data, so no marker"
            )
        places.append(
            Place(
                id=ROOT_PLACE,
                name=title,
                latitude=coordinates[0] if coordinates else None,
                longitude=coordinates[1] if coordinates else None,
                source=direct_source,
                media=direct,
            )
        )
    elif not place_dirs:
        warnings.append(f"{trip_dir.name}: no photos and no place folders")

    for place_dir in place_dirs:
        entry = manual.get(place_dir.name)
        media = _collect_media(place_dir)
        coordinates = _manual_coordinates(entry)
        source: str | None = "trip.yaml"
        if coordinates is None:
            coordinates = _exif_coordinates(place_dir, media)
            source = "exif"
        if coordinates is None:
            source = None
            warnings.append(
                f"{trip_dir.name}/{place_dir.name}: no EXIF GPS data and no "
                "coordinates in trip.yaml, so no marker"
            )
        name = entry.get("name") if isinstance(entry, dict) else None
        places.append(
            Place(
                id=place_dir.name,
                name=_text(name) or place_dir.name,
                latitude=coordinates[0] if coordinates else None,
                longitude=coordinates[1] if coordinates else None,
                source=source,
                media=media,
            )
        )

    return Trip(
        id=trip_dir.name,
        title=title,
        country=_text(meta.get("country")),
        start=_text(meta.get("start")),
        finish=_text(meta.get("finish")),
        places=tuple(places),
    )


def scan_library(root: Path) -> Library:
    """Scan the root folder. Raises OSError when it cannot be read."""
    if not root.is_dir():
        raise FileNotFoundError(f"{root} is not a folder")
    warnings: list[str] = []
    trips = [_scan_trip(trip_dir, warnings) for trip_dir in _subfolders(root)]
    # Newest trip first; trips without a start date go last.
    trips.sort(key=lambda trip: natural_key(trip.id))
    trips.sort(key=lambda trip: trip.start or "", reverse=True)
    files = frozenset(
        (trip.id, place.id, item.file)
        for trip in trips
        for place in trip.places
        for item in place.media
    )
    return Library(trips=tuple(trips), warnings=tuple(warnings), files=files)

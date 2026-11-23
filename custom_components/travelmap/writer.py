"""Write what the user sets in Home Assistant into the trip.yaml of a trip.

Blocking; runs in the executor.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from .scanner import ROOT_PLACE, TRIP_FILES


class TripFileError(Exception):
    """The existing trip.yaml cannot be updated safely."""


def _split_header(text: str) -> tuple[str, str]:
    """Split off the comment block at the top, which a rewrite would lose."""
    lines = text.splitlines(keepends=True)
    count = 0
    for line in lines:
        if line.strip() and not line.lstrip().startswith("#"):
            break
        count += 1
    return "".join(lines[:count]), "".join(lines[count:])


def _apply(target: dict[str, Any], fields: dict[str, Any]) -> None:
    """Set the given fields; None or an empty text removes a field."""
    for key, value in fields.items():
        if value is None or value == "":
            target.pop(key, None)
        else:
            target[key] = value


def _read(root: Path, trip: str) -> tuple[Path, str, dict[str, Any]]:
    """Return the trip file, its leading comment block and its content."""
    trip_dir = root / trip
    path = next(
        (trip_dir / name for name in TRIP_FILES if (trip_dir / name).is_file()),
        trip_dir / TRIP_FILES[0],
    )
    header = ""
    data: dict[str, Any] = {}
    if path.is_file():
        header, body = _split_header(path.read_text(encoding="utf-8"))
        try:
            loaded = yaml.safe_load(body)
        except yaml.YAMLError as err:
            raise TripFileError(str(err)) from err
        if loaded is not None and not isinstance(loaded, dict):
            raise TripFileError("not a mapping")
        data = loaded or {}
    return path, header, data


def _write(path: Path, header: str, data: dict[str, Any]) -> Path:
    """Write beside the file and swap, so a failure never leaves half a file."""
    body = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(header + (body if data else ""), encoding="utf-8")
        os.replace(temporary, path)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise
    return path


def reorder_places(root: Path, trip: str, order: list[str]) -> Path:
    """Put the places of a trip in the given order, which is the route.

    The order of ``places`` in trip.yaml is the order of travel. Places that
    had no entry yet get an empty one, so their position is recorded too.
    """
    path, header, data = _read(root, trip)
    places = data.get("places")
    if places is None:
        places = {}
    elif not isinstance(places, dict):
        raise TripFileError("places is not a mapping")
    ordered: dict[str, Any] = {}
    for place in order:
        entry = places.get(place)
        ordered[place] = entry if isinstance(entry, dict) else {}
    for place, entry in places.items():
        ordered.setdefault(place, entry)
    data["places"] = ordered
    return _write(path, header, data)


def update_trip_file(
    root: Path,
    trip: str,
    trip_fields: dict[str, Any] | None = None,
    place: str | None = None,
    place_fields: dict[str, Any] | None = None,
) -> Path:
    """Update the trip.yaml of one trip and return the file written.

    ``trip_fields`` go at the top of the file (title, country, year, zoom).
    ``place_fields`` go under ``places.<place>``; for photos in the trip
    folder itself (place ``_``) they go at the top as well.

    The file is created when missing. An existing file keeps everything else
    it holds, including the comment block at its top; comments further down
    are not kept. A file that is not valid YAML is left alone. Raises OSError
    when the folder is read-only.
    """
    path, header, data = _read(root, trip)

    _apply(data, trip_fields or {})
    if place == ROOT_PLACE:
        # Photos in the trip folder itself: the place is the trip.
        fields = dict(place_fields or {})
        fields.pop("name", None)
        _apply(data, fields)
    elif place is not None:
        places = data.get("places")
        if places is None:
            places = {}
        elif not isinstance(places, dict):
            raise TripFileError("places is not a mapping")
        entry = places.get(place)
        if not isinstance(entry, dict):
            entry = {}
        _apply(entry, place_fields or {})
        places[place] = entry
        data["places"] = places

    return _write(path, header, data)


def write_place_coordinates(
    root: Path, trip: str, place: str, latitude: float, longitude: float
) -> Path:
    """Store the coordinates of one place and return the file written."""
    return update_trip_file(
        root,
        trip,
        place=place,
        place_fields={"lat": round(float(latitude), 6), "lon": round(float(longitude), 6)},
    )

"""Write the coordinates of a place into the trip.yaml of its trip.

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


def write_place_coordinates(
    root: Path, trip: str, place: str, latitude: float, longitude: float
) -> Path:
    """Store the coordinates of one place and return the file written.

    For photos in the trip folder itself (place ``_``) the coordinates go at
    the top of the file. An existing file keeps everything else it holds, including the comment
    block at its top; comments further down are not kept. A file that is not
    valid YAML is left alone. Raises OSError when the folder is read-only.
    """
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

    if place == ROOT_PLACE:
        # Photos in the trip folder itself: the coordinates belong to the trip.
        data["lat"] = round(float(latitude), 6)
        data["lon"] = round(float(longitude), 6)
        return _write(path, header, data)

    places = data.get("places")
    if places is None:
        places = {}
    elif not isinstance(places, dict):
        raise TripFileError("places is not a mapping")
    entry = places.get(place)
    if not isinstance(entry, dict):
        entry = {}
    entry["lat"] = round(float(latitude), 6)
    entry["lon"] = round(float(longitude), 6)
    places[place] = entry
    data["places"] = places

    return _write(path, header, data)


def _write(path: Path, header: str, data: dict[str, Any]) -> Path:
    """Write beside the file and swap, so a failure never leaves half a file."""
    body = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False)
    temporary = path.with_name(f".{path.name}.tmp")
    try:
        temporary.write_text(header + body, encoding="utf-8")
        os.replace(temporary, path)
    except OSError:
        temporary.unlink(missing_ok=True)
        raise
    return path

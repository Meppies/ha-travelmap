"""Tests for writing coordinates into trip.yaml."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from custom_components.travelmap.writer import (
    TripFileError,
    update_trip_file,
    write_place_coordinates,
)

EXISTING = """\
# Metadata for one trip.
#   places   Coordinates per place folder.

title: Japan
start: 2026-04-01
places:
  tokyo:
    lat: 35.6762
    lon: 139.6503
    name: Tōkyō
  kyoto: just a note
"""


def test_update_keeps_the_rest(tmp_path: Path) -> None:
    """Only the coordinates of the one place change."""
    trip = tmp_path / "trip"
    trip.mkdir()
    (trip / "trip.yml").write_text(EXISTING, encoding="utf-8")

    path = write_place_coordinates(tmp_path, "trip", "tokyo", 35.5, 139.75)
    write_place_coordinates(tmp_path, "trip", "kyoto", 35.01160004, 135.7681)
    write_place_coordinates(tmp_path, "trip", "nara", 34.6851, 135.8048)

    assert path == trip / "trip.yml"
    assert not (trip / "trip.yaml").exists()
    text = path.read_text(encoding="utf-8")
    assert text.startswith(
        "# Metadata for one trip.\n#   places   Coordinates per place folder.\n\n"
    )
    data = yaml.safe_load(text)
    assert data["title"] == "Japan"
    assert str(data["start"]) == "2026-04-01"
    assert data["places"] == {
        "tokyo": {"lat": 35.5, "lon": 139.75, "name": "Tōkyō"},
        "kyoto": {"lat": 35.0116, "lon": 135.7681},
        "nara": {"lat": 34.6851, "lon": 135.8048},
    }
    # The order of the places is the order of the route: it is kept.
    assert list(data["places"]) == ["tokyo", "kyoto", "nara"]
    assert "Tōkyō" in text


def test_trip_folder_itself(tmp_path: Path) -> None:
    """Photos in the trip folder: the coordinates go at the top of the file."""
    trip = tmp_path / "Bali"
    trip.mkdir()
    path = write_place_coordinates(tmp_path, "Bali", "_", -8.409518, 115.188919)
    assert path.read_text(encoding="utf-8") == "lat: -8.409518\nlon: 115.188919\n"
    (trip / "trip.yaml").write_text("title: Bali 2018\nlat: 1\nlon: 2\n", encoding="utf-8")
    write_place_coordinates(tmp_path, "Bali", "_", -8.5, 115.25)
    assert yaml.safe_load(path.read_text(encoding="utf-8")) == {
        "title": "Bali 2018",
        "lat": -8.5,
        "lon": 115.25,
    }


@pytest.mark.parametrize("content", ["", "# only a comment\n", "title: T\n"])
def test_file_without_places(tmp_path: Path, content: str) -> None:
    """A file without places gets them added."""
    trip = tmp_path / "trip"
    trip.mkdir()
    (trip / "trip.yaml").write_text(content, encoding="utf-8")
    write_place_coordinates(tmp_path, "trip", "a", 1, 2)
    data = yaml.safe_load((trip / "trip.yaml").read_text(encoding="utf-8"))
    assert data["places"] == {"a": {"lat": 1.0, "lon": 2.0}}


@pytest.mark.parametrize("content", ["- a\n- b\n", "places: [a, b]\n", "a: [unclosed"])
def test_unsafe_files_are_left_alone(tmp_path: Path, content: str) -> None:
    """A file the writer does not understand is not overwritten."""
    trip = tmp_path / "trip"
    trip.mkdir()
    (trip / "trip.yaml").write_text(content, encoding="utf-8")
    with pytest.raises(TripFileError):
        write_place_coordinates(tmp_path, "trip", "a", 1, 2)
    assert (trip / "trip.yaml").read_text(encoding="utf-8") == content


def test_update_trip_fields(tmp_path: Path) -> None:
    """Trip fields go at the top; empty values remove a field."""
    trip = tmp_path / "Japan"
    trip.mkdir()
    path = update_trip_file(
        tmp_path, "Japan", {"title": "Japan", "year": 2026, "zoom": 9.0, "country": None}
    )
    assert yaml.safe_load(path.read_text()) == {"title": "Japan", "year": 2026, "zoom": 9.0}
    update_trip_file(
        tmp_path,
        "Japan",
        {"title": "", "zoom": None},
        "tokyo",
        {"name": "Tōkyō", "lat": 1.0, "lon": 2.0},
    )
    update_trip_file(tmp_path, "Japan", place="tokyo", place_fields={"name": None})
    assert yaml.safe_load(path.read_text(encoding="utf-8")) == {
        "year": 2026,
        "places": {"tokyo": {"lat": 1.0, "lon": 2.0}},
    }
    # The trip folder as its own place: a name is not a field of the trip.
    update_trip_file(tmp_path, "Japan", {"year": None}, "_", {"name": "x", "lat": 3.0, "lon": 4.0})
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert (data["lat"], data["lon"], "name" in data, "year" in data) == (3.0, 4.0, False, False)
    # Everything removed: an empty file, not the text "{}".
    empty = tmp_path / "Bali"
    empty.mkdir()
    assert update_trip_file(tmp_path, "Bali", {"title": None}).read_text() == ""

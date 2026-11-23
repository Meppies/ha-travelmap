"""Tests for the folder scanner."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from custom_components.travelmap.scanner import natural_key, read_exif_gps, scan_library

from .conftest import PLAIN_JPEG, build_library, exif_jpeg


def test_scan_library(tmp_path: Path) -> None:
    """Trips, places and media come out in the documented order."""
    library = scan_library(build_library(tmp_path))

    assert [trip.id for trip in library.trips] == ["2026-japan", "2025-loose"]
    japan, loose = library.trips
    assert (japan.title, japan.country, japan.start, japan.finish) == (
        "Japan",
        "Japan",
        "2026-04-01",
        "2026-04-14",
    )
    # trip.yaml order first, the unlisted folder last.
    assert [place.id for place in japan.places] == ["tokyo", "kyoto", "nara", "osaka"]

    tokyo, kyoto, nara, osaka = japan.places
    assert (tokyo.latitude, tokyo.longitude, tokyo.source) == (35.6762, 139.6503, "trip.yaml")
    assert [item.file for item in tokyo.media] == ["2.jpg", "10.jpg"]
    # trip.yaml beats EXIF GPS: it is what the user chose.
    assert kyoto.name == "Kyōto"
    assert kyoto.source == "trip.yaml"
    assert (kyoto.latitude, kyoto.longitude) == (1.5, 2.5)
    assert [(item.file, item.kind) for item in kyoto.media] == [
        ("001 temple.jpg", "image"),
        ("clip.MP4", "video"),
    ]
    assert nara.media == ()
    # No entry in trip.yaml: the EXIF GPS data of the photo is used.
    assert osaka.source == "exif"
    assert osaka.latitude == pytest.approx(34.6937, abs=1e-5)
    assert osaka.longitude == pytest.approx(135.5023, abs=1e-5)
    assert (nara.latitude, nara.source) == (None, None)

    assert (loose.title, loose.country, loose.start) == ("2025-loose", None, None)
    assert library.missing == ["2026-japan/nara", "2025-loose/a"]
    assert library.place_count == 5
    assert library.media_count == 7
    assert library.has_media("2026-japan", "kyoto", "clip.MP4")
    assert not library.has_media("2026-japan", "kyoto", "../trip.yaml")
    assert any("nara: no EXIF GPS" in warning for warning in library.warnings)
    assert any("2025-loose: no trip.yaml" in warning for warning in library.warnings)


def test_scan_missing_root(tmp_path: Path) -> None:
    """A folder that is not there is an OSError."""
    with pytest.raises(FileNotFoundError):
        scan_library(tmp_path / "nope")


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("title: [unclosed", "cannot be read"),
        ("- a\n- b\n", "is not a mapping"),
        ("places: [a, b]\n", "places in trip.yaml is not a mapping"),
        (
            "title: ''\nplaces:\n  a: nonsense\n  b: {lat: x, lon: 1}\n  c: {lat: 95, lon: 1}\n",
            "no EXIF",
        ),
    ],
)
def test_scan_bad_trip_files(tmp_path: Path, content: str, expected: str) -> None:
    """A broken trip.yml costs the metadata, not the trip."""
    trip = tmp_path / "trip"
    for place in ("a", "b", "c"):
        (trip / place).mkdir(parents=True)
    (trip / "trip.yml").write_text(content, encoding="utf-8")
    library = scan_library(tmp_path)
    assert library.trips[0].title == "trip"
    assert all(place.latitude is None for place in library.trips[0].places)
    assert any(expected in warning for warning in library.warnings)


def test_scan_empty_trip_and_unreadable_photo(tmp_path: Path) -> None:
    """A trip without places is reported; an unreadable photo is skipped."""
    (tmp_path / "empty").mkdir()
    place = tmp_path / "trip" / "a"
    place.mkdir(parents=True)
    (place / "1.jpg").write_bytes(exif_jpeg(10, 20))
    (place / "2.jpeg").write_bytes(exif_jpeg(-33.5, -70.25))
    real_open = Path.open

    def fake_open(self: Path, *args: object, **kwargs: object) -> object:
        if self.name == "1.jpg":
            raise PermissionError("denied")
        return real_open(self, *args, **kwargs)  # type: ignore[arg-type]

    with patch.object(Path, "open", fake_open):
        library = scan_library(tmp_path)
    assert any("empty: no photos and no place folders" in warning for warning in library.warnings)
    found = next(trip for trip in library.trips if trip.id == "trip").places[0]
    assert (found.latitude, found.longitude) == (pytest.approx(-33.5), pytest.approx(-70.25))


def test_read_exif_gps() -> None:
    """The parser reads both byte orders and rejects everything else."""
    assert read_exif_gps(exif_jpeg(52.37, 4.89, "big")) == pytest.approx((52.37, 4.89))
    assert read_exif_gps(exif_jpeg(-3.05, -60.02)) == pytest.approx((-3.05, -60.02))
    # Without reference tags the position counts as north and east.
    assert read_exif_gps(exif_jpeg(-3.05, -60.02, with_refs=False)) == pytest.approx((3.05, 60.02))
    # No fix: cameras write 0, 0.
    assert read_exif_gps(exif_jpeg(0, 0)) is None
    assert read_exif_gps(b"not a jpeg") is None
    assert read_exif_gps(PLAIN_JPEG) is None
    assert read_exif_gps(b"\xff\xd8\x00\x00\x00\x00") is None
    assert read_exif_gps(b"\xff\xd8\xff\xd0\xff\xd9\x00\x00") is None
    assert read_exif_gps(b"\xff\xd8\xff\xe0\x00\x04JF") is None

    def app1(tiff: bytes) -> bytes:
        payload = b"Exif\x00\x00" + tiff
        return b"\xff\xd8\xff\xe1" + (len(payload) + 2).to_bytes(2, "big") + payload + b"\xff\xd9"

    good = exif_jpeg(52.37, 4.89)
    tiff = good[good.index(b"Exif\x00\x00") + 6 : -2]
    assert read_exif_gps(app1(b"XX" + tiff[2:])) is None
    # IFD0 without a GPS pointer.
    assert read_exif_gps(app1(tiff[:10] + b"\x00\x01" + tiff[12:])) is None
    # GPS IFD without a latitude.
    no_lat = bytearray(tiff)
    no_lat[26 + 2 + 12 : 26 + 2 + 14] = (99).to_bytes(2, "little")
    assert read_exif_gps(app1(bytes(no_lat))) is None
    # Latitude of the wrong type.
    wrong_type = bytearray(tiff)
    wrong_type[26 + 2 + 12 + 2 : 26 + 2 + 12 + 4] = (3).to_bytes(2, "little")
    assert read_exif_gps(app1(bytes(wrong_type))) is None
    # Values cut off, and a zero denominator.
    assert read_exif_gps(app1(tiff[:-8])) is None
    zero = bytearray(tiff)
    zero[-4:] = (0).to_bytes(4, "little")
    assert read_exif_gps(app1(bytes(zero))) == pytest.approx((52.37, 4.883333), abs=1e-5)
    # A reference tag of the wrong type is ignored.
    odd_ref = bytearray(exif_jpeg(-3.05, 60.0)[good.index(b"Exif\x00\x00") + 6 : -2])
    odd_ref[26 + 2 + 2 : 26 + 2 + 4] = (7).to_bytes(2, "little")
    assert read_exif_gps(app1(bytes(odd_ref))) == pytest.approx((3.05, 60.0))


def test_natural_key() -> None:
    """Numbers sort by value, text without regard to case."""
    assert sorted(["10.jpg", "2.jpg", "B.jpg", "a.jpg"], key=natural_key) == [
        "2.jpg",
        "10.jpg",
        "a.jpg",
        "B.jpg",
    ]


def test_trip_folder_with_photos(tmp_path: Path) -> None:
    """A trip folder that holds photos itself is a place of its own."""
    bali = tmp_path / "Bali"
    bali.mkdir()
    (bali / "b.jpg").write_bytes(PLAIN_JPEG)
    (bali / "Thumbs.db").write_bytes(b"x")
    ibiza = tmp_path / "Ibiza"
    (ibiza / "beach").mkdir(parents=True)
    (ibiza / "a.JPG").write_bytes(exif_jpeg(38.9, 1.43))
    (ibiza / "beach" / "c.jpg").write_bytes(PLAIN_JPEG)
    orlando = tmp_path / "Orlando"
    orlando.mkdir()
    (orlando / "o.jpg").write_bytes(exif_jpeg(1, 1))
    (orlando / "trip.yaml").write_text("title: Florida\nstart: 2019-05-01\nlat: 28.5\nlon: -81.4\n")

    library = scan_library(tmp_path)
    by_id = {trip.id: trip for trip in library.trips}

    (place,) = by_id["Bali"].places
    assert (place.id, place.name, place.latitude, place.source) == ("_", "Bali", None, None)
    assert [item.file for item in place.media] == ["b.jpg"]

    own, beach = by_id["Ibiza"].places
    assert (own.id, own.source) == ("_", "exif")
    assert (own.latitude, own.longitude) == (pytest.approx(38.9), pytest.approx(1.43))
    assert beach.id == "beach"

    (place,) = by_id["Orlando"].places
    assert (place.name, place.latitude, place.longitude, place.source) == (
        "Florida",
        28.5,
        -81.4,
        "trip.yaml",
    )
    assert library.missing == ["Bali", "Ibiza/beach"]
    assert library.has_media("Bali", "_", "b.jpg")
    assert any("Bali: no coordinates" in warning for warning in library.warnings)

"""Constants for the Travel map integration."""

from __future__ import annotations

import logging

DOMAIN = "travelmap"
LOGGER = logging.getLogger(__package__)

CONF_PATH = "path"
CONF_SCAN_INTERVAL = "scan_interval"
CONF_TRIP = "trip"
CONF_PLACE = "place"

DEFAULT_PATH = "/media/trips"
# Minutes between two scans of the folder tree.
DEFAULT_SCAN_INTERVAL = 60
MIN_SCAN_INTERVAL = 5
MAX_SCAN_INTERVAL = 1440
# Minutes between two looks for a folder that is not there yet.
MISSING_FOLDER_INTERVAL = 1

MEDIA_URL_PREFIX = f"/api/{DOMAIN}/media"

/**
 * Travel map card for Home Assistant.
 *
 * Shows the trips of the Travel map integration on Home Assistant's own map
 * (<ha-map>): one numbered marker per place and a route line between the
 * places. The map fills the card; during playback each photo and video grows
 * out of the marker of its place and goes back into it.
 *
 *   type: custom:travelmap-card
 *   trip: 2026-japan        # optional, folder name of one trip; all trips when left out
 *   group: Asia             # optional, name of a group made in the Travel map panel
 *   height: 70vh            # optional, any CSS length
 *   view: world             # world | trip | place: what the map shows while playing
 *   projection: flat        # flat | globe
 *   max_zoom: 6             # closest zoom for the trip view
 *   photo_size: 70          # width of a photo, as a percentage of the card
 *   video_size: 70          # width of a video; the photo size when left out
 *   autoplay: false
 *   photo_seconds: 6
 *   video_seconds: 15
 *   place_zoom: 12          # zoom level for view: place
 *   fly_seconds: 6          # duration of the flight between two places, view: place
 *   overview_seconds: 4     # pause at the overview after each trip; 0 skips the overview
 *   map_style: meppie       # meppie | default: the colours of the map
 *   relief: true            # satellite relief on land when zoomed out (NASA Blue Marble)
 *   route_color: "#e87722"
 *   name_position: top-center   # where on the photo the place name goes, or none
 *   year_position: top-right    # where on the photo the year of the trip goes, or none
 *   media_per_visit: 10         # photos and videos per visit to a place; 0 shows all
 *   marker_icon: mdi:kangaroo   # optional: any icon Home Assistant knows
 *   marker_image: /local/k.svg  # optional: your own picture as the marker
 *   labels: few             # few | all | none: the names on the map
 *   marker_size: 14         # diameter of a marker in pixels
 *   show_numbers: false     # number the markers in order of travel
 *   route_line: false       # line between the places
 *   photo_line: false       # line between a photo and its marker
 */

const VERSION = "0.12.0";

const DEFAULTS = {
  entry: undefined,
  trip: undefined,
  group: undefined,
  height: "70vh",
  view: "world",
  projection: "flat",
  max_zoom: 6,
  photo_size: 70,
  video_size: undefined,
  autoplay: false,
  photo_seconds: 6,
  video_seconds: 15,
  place_zoom: 12,
  fly_seconds: 6,
  overview_seconds: 4,
  map_style: "meppie",
  relief: true,
  route_color: undefined,
  name_position: "top-center",
  year_position: "top-right",
  media_per_visit: 10,
  marker_icon: undefined,
  marker_image: undefined,
  labels: "few",
  marker_size: 14,
  show_numbers: false,
  route_line: false,
  photo_line: false,
};

// The Desired State palette on the map. Night is the dark theme: land in
// bush green on a eucalyptus sea. Day is the light theme, on paper.
const MEPPIE_NIGHT = {
  background: "#1A3229", land: "#1A3229", water: "#14364F", labelWater: "#A9C7DD",
  natureWood: "#2A5E42", natureGrass: "#24493A", naturePark: "#2A5E42", natureLeisure: "#24493A",
  natureAgriculture: "#223F33", natureWetland: "#2B4F47", natureSand: "#9C7A32",
  natureRock: "#6B4A36", glacier: "#E9E6DC",
  areaResidential: "#1F3A30", areaCommercial: "#233D33", areaIndustrial: "#22382F",
  areaWaste: "#1F3A30", areaBurial: "#1F3A30", siteParking: "#1F3A30", siteSports: "#2A5E4226",
  building: "#2A463B", buildingBg: "#203A30",
  roadStreet: "#35554A", roadStreetBg: "#152B23", roadTrunk: "#5A4632", roadTrunkBg: "#152B23",
  roadMotorway: "#A4461F", roadMotorwayBg: "#4E2A16",
  transitRail: "#3A5A4E", transitSubway: "#3A5A4E", transitCycle: "#35554A", transitFoot: "#35554A",
  boundary: "#9DB3A8", boundaryDisputed: "#9DB3A899",
  label: "#F3F1EA", labelHalo: "#0F221Bcc", labelSymbol: "#C9D6CE", labelPoi: "#C9D6CE66",
  labelShield: "#1A3229", labelHousenumber: "#C9D6CE4d",
};
const MEPPIE_DAY = {
  background: "#FBF8F2", land: "#FBF8F2", water: "#A7CBE3", labelWater: "#1F5578",
  natureWood: "#A9CDB0", natureGrass: "#D3E5CF", naturePark: "#A9CDB0", natureLeisure: "#D3E5CF",
  natureAgriculture: "#E6EBD8", natureWetland: "#CFE0D6", natureSand: "#F2DC9A",
  natureRock: "#D9B79E", glacier: "#FDFDFB",
  areaResidential: "#F3EEE3", areaCommercial: "#F3EEE3", areaIndustrial: "#EFE8DA",
  areaWaste: "#F3EEE3", areaBurial: "#F3EEE3", siteParking: "#F3EEE3", siteSports: "#A9CDB026",
  building: "#E8DFCF", buildingBg: "#DACDB6",
  roadStreet: "#FEFDFA", roadStreetBg: "#E4DED2", roadTrunk: "#F4D98A", roadTrunkBg: "#D9B24A",
  roadMotorway: "#F0A26B", roadMotorwayBg: "#C2410C",
  transitRail: "#C9C2B4", transitSubway: "#C9C2B4", transitCycle: "#E4DED2", transitFoot: "#E4DED2",
  boundary: "#7A3418", boundaryDisputed: "#7A341899",
  label: "#16181C", labelHalo: "#FBF8F2cc", labelSymbol: "#45474B", labelPoi: "#45474B66",
  labelShield: "#FBF8F2", labelHousenumber: "#45474B4d",
};
const MEPPIE_ACCENT = "#F26B21";
const MAP_STYLES = ["meppie", "default"];
// Satellite relief for the land when zoomed out: snow, desert, forest and
// mountains as they are. NASA Blue Marble, public domain, served by NASA GIBS.
const RELIEF_SOURCE = "travelmap-relief";
const RELIEF_TILES =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const RELIEF_MAX_ZOOM = 8;
const ALL_TRIPS = "__all__";
// Slow start, slow arrival.
const FLIGHT_EASING = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const VIEWS = ["world", "trip", "place"];
const PROJECTIONS = ["flat", "globe"];
const POSITIONS = [
  "none",
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
// The inhabited world, corner to corner: what the world view fits.
// The whole world, pole to pole, as far as a flat map reaches.
const WORLD_BOUNDS = [
  [-84, -180],
  [84, 180],
];
const GROUP_PREFIX = "group:";
const LABEL_MODES = ["few", "all", "none"];
// With labels: few, the only names left on the map: countries, capitals and
// cities of a million people or more.
const LABELS_KEPT = [
  "label-boundary-country-large",
  "label-boundary-country-medium",
  "label-boundary-country-small",
  "label-place-capital",
  "label-place-city",
];
const BIG_CITY_FILTER = [
  "all",
  ["==", ["get", "kind"], "city"],
  [">=", ["to-number", ["get", "population"], 0], 1000000],
];
const FLY_MS = 2600;
// Home Assistant's zoom levels are one higher than those of the map engine.
const ENGINE_ZOOM_OFFSET = 1;
const SETTLE_MS = 1400;
const GROW_MS = 900;
const FADE_MS = 600;
const SIGN_EXPIRES_SECONDS = 900;
const RETRY_MS = 30000;

const TEXT = {
  en: {
    name: "Travel map",
    description: "Trips on the map, with the photos and videos of every place.",
    play: "Play",
    pause: "Pause",
    fullscreen: "Full screen",
    trip: "Trip",
    all_trips: "All trips",
    place_one: "place",
    places: "places",
    photos: "photos",
    press_play: "press play to start",
    loading: "Loading trips…",
    no_integration: "The Travel map integration is not set up.",
    no_trips: "No trips found in the folder.",
    no_folder: "The folder {path} is not available yet. Add the network storage in Settings → System → Storage; the map appears by itself.",
    no_map: "The Home Assistant map could not be loaded.",
    no_places: "This trip has no places with coordinates.",
    error: "Travel map",
    form_trip: "Only this trip (folder name); empty shows all trips",
    form_height: "Height (CSS length, for example 70vh)",
    form_view: "What the map shows while playing",
    form_projection: "Shape of the map when zoomed out",
    projection_flat: "Flat map",
    projection_globe: "Globe",
    form_max_zoom: "Closest zoom for the whole trip",
    form_photo_size: "Photo size (width as a percentage of the card)",
    form_video_size: "Video size (width as a percentage of the card)",
    form_autoplay: "Start playing right away",
    form_photo_seconds: "Seconds per photo",
    form_video_seconds: "Longest time per video, in seconds",
    form_media_per_visit: "Photos and videos per visit to a place; the rest follows on the next rounds (0 shows all)",
    form_place_zoom: "Zoom level when flying to each place",
    form_fly_seconds: "Duration of the flight between two places, in seconds",
    form_overview_seconds: "Pause at the overview after each trip, in seconds (0 skips it)",
    form_map_style: "Colours of the map",
    map_style_meppie: "Meppie (Desired State)",
    map_style_default: "Home Assistant",
    form_relief: "Show snow, desert, forest and mountains (satellite relief from NASA)",
    form_route_color: "Colour of the markers and lines",
    form_name_position: "Place name on the photo",
    form_year_position: "Year on the photo",
    position_none: "Do not show",
    "position_top-left": "Top left",
    "position_top-center": "Top centre",
    "position_top-right": "Top right",
    "position_bottom-left": "Bottom left",
    "position_bottom-center": "Bottom centre",
    "position_bottom-right": "Bottom right",
    form_group: "Only this group (name from the Travel map panel)",
    form_marker_icon: "Marker icon",
    form_marker_image: "Or your own picture as the marker (for example /local/picture.svg)",
    editor_labels: "Place name and year on the photo",
    editor_labels_help: "Drag each label to a spot on the photo, or to the box below to hide it. With the keyboard: the arrow keys.",
    editor_name: "Place name",
    editor_year: "Year",
    editor_hidden: "Not shown",
    form_labels: "Names on the map",
    labels_few: "Countries, capitals and big cities",
    labels_all: "Everything",
    labels_none: "None",
    group_label: "Group",
    form_marker_size: "Marker size",
    form_show_numbers: "Number the markers",
    form_route_line: "Line between the places",
    form_photo_line: "Line between a photo and its marker",
    view_trip: "The whole trip",
    view_world: "The whole world",
    view_place: "Fly to each place",
  },
  nl: {
    name: "Reiskaart",
    description: "Reizen op de kaart, met de foto's en video's van elke plek.",
    play: "Afspelen",
    pause: "Pauzeren",
    fullscreen: "Volledig scherm",
    trip: "Reis",
    all_trips: "Alle reizen",
    place_one: "plek",
    places: "plekken",
    photos: "foto's",
    press_play: "druk op afspelen om te starten",
    loading: "Reizen laden…",
    no_integration: "De integratie Reiskaart is niet ingesteld.",
    no_trips: "Geen reizen gevonden in de map.",
    no_folder: "De map {path} is nog niet beschikbaar. Voeg de netwerkopslag toe via Instellingen → Systeem → Opslag; de kaart verschijnt daarna vanzelf.",
    no_map: "De kaart van Home Assistant kon niet worden geladen.",
    no_places: "Deze reis heeft geen plekken met coördinaten.",
    error: "Reiskaart",
    form_trip: "Alleen deze reis (mapnaam); leeg toont alle reizen",
    form_height: "Hoogte (CSS-lengte, bijvoorbeeld 70vh)",
    form_view: "Wat de kaart toont tijdens het afspelen",
    form_projection: "Vorm van de kaart bij uitzoomen",
    projection_flat: "Platte kaart",
    projection_globe: "Wereldbol",
    form_max_zoom: "Dichtste zoom voor de hele reis",
    form_photo_size: "Fotogrootte (breedte als percentage van de kaart)",
    form_video_size: "Videogrootte (breedte als percentage van de kaart)",
    form_autoplay: "Meteen afspelen",
    form_photo_seconds: "Seconden per foto",
    form_video_seconds: "Langste tijd per video, in seconden",
    form_media_per_visit: "Foto's en video's per bezoek aan een plek; de rest volgt in de volgende rondes (0 toont alles)",
    form_place_zoom: "Zoomniveau bij naar elke plek vliegen",
    form_fly_seconds: "Duur van de vlucht tussen twee plekken, in seconden",
    form_overview_seconds: "Pauze bij het overzicht na elke reis, in seconden (0 slaat het over)",
    form_map_style: "Kleuren van de kaart",
    map_style_meppie: "Meppie (Desired State)",
    map_style_default: "Home Assistant",
    form_relief: "Sneeuw, woestijn, bos en bergen tonen (satellietreliëf van NASA)",
    form_route_color: "Kleur van de markers en lijnen",
    form_name_position: "Plaatsnaam op de foto",
    form_year_position: "Jaartal op de foto",
    position_none: "Niet tonen",
    "position_top-left": "Linksboven",
    "position_top-center": "Midden boven",
    "position_top-right": "Rechtsboven",
    "position_bottom-left": "Linksonder",
    "position_bottom-center": "Midden onder",
    "position_bottom-right": "Rechtsonder",
    form_group: "Alleen deze groep (naam uit het paneel Reiskaart)",
    form_marker_icon: "Icoon van de marker",
    form_marker_image: "Of je eigen plaatje als marker (bijvoorbeeld /local/plaatje.svg)",
    editor_labels: "Plaatsnaam en jaartal op de foto",
    editor_labels_help: "Sleep elk label naar een plek op de foto, of naar het vak eronder om het te verbergen. Met het toetsenbord: de pijltjestoetsen.",
    editor_name: "Plaatsnaam",
    editor_year: "Jaartal",
    editor_hidden: "Niet getoond",
    form_labels: "Namen op de kaart",
    labels_few: "Landen, hoofdsteden en grote steden",
    labels_all: "Alles",
    labels_none: "Geen",
    group_label: "Groep",
    form_marker_size: "Grootte van de marker",
    form_show_numbers: "Markers nummeren",
    form_route_line: "Lijn tussen de plekken",
    form_photo_line: "Lijn tussen een foto en zijn marker",
    view_trip: "De hele reis",
    view_world: "De hele wereld",
    view_place: "Naar elke plek vliegen",
  },
};

const languageOf = (hass) => {
  const language = (hass && hass.locale && hass.locale.language) || navigator.language || "en";
  return language.toLowerCase().startsWith("nl") ? "nl" : "en";
};

const globalHass = () => {
  const root = document.querySelector("home-assistant");
  return root && root.hass;
};

const STYLE = `
  :host { display: block; }
  ha-card { overflow: hidden; height: 100%; }
  .frame {
    position: relative;
    overflow: hidden;
    background: #111;
    color: #fff;
  }
  .frame:fullscreen { height: 100vh !important; }
  .topbar, .caption, .message { zoom: var(--tm-scale, 1); }
  .map { position: absolute; inset: 0; }
  ha-map { position: absolute; inset: 0; width: 100%; height: 100%; }
  .stage {
    position: absolute; inset: 0; z-index: 5;
    overflow: hidden; pointer-events: none;
  }
  .stage svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .stage line {
    stroke-width: 3; stroke-linecap: round; opacity: 0;
    transition: opacity ${FADE_MS}ms ease;
  }
  .stage line.show { opacity: 0.9; }
  /* A photo grows out of the marker of its place: the transform origin is
     set to the marker's position when the photo is placed. */
  .photo {
    position: absolute; box-sizing: border-box;
    border: 4px solid #fff; border-radius: 12px; overflow: hidden;
    background: #000;
    box-shadow: 0 12px 44px rgba(0,0,0,.6);
    transform: scale(0.02); opacity: 0;
    transition: transform ${GROW_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${FADE_MS}ms ease;
  }
  .photo.show { transform: scale(1); opacity: 1; }
  .photo.leave { transform: scale(1); opacity: 0; }
  /* Texts on the photo: a soft dark band behind them keeps them readable on
     any picture. */
  .photo .band {
    position: absolute; left: 0; right: 0; height: 30%; pointer-events: none;
  }
  .photo .band.top { top: 0; background: linear-gradient(rgba(0,0,0,.62), rgba(0,0,0,0)); }
  .photo .band.bottom { bottom: 0; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.62)); }
  .photo .label {
    position: absolute; max-width: 92%;
    color: #fff; font-weight: 600; line-height: 1.25; letter-spacing: .01em;
    text-shadow: 0 1px 3px rgba(0,0,0,.85);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, sans-serif));
  }
  .photo .label.top { top: 4%; }
  .photo .label.bottom { bottom: 4%; }
  .photo .label.left { left: 4%; text-align: left; }
  .photo .label.right { right: 4%; text-align: right; }
  .photo .label.center { left: 50%; transform: translateX(-50%); text-align: center; }
  .photo img, .photo video {
    display: block; width: 100%; height: 100%; object-fit: cover;
  }
  @keyframes travelmap-drift-a {
    from { transform: scale(1); } to { transform: scale(1.07) translate(-1%, 1%); }
  }
  @keyframes travelmap-drift-b {
    from { transform: scale(1.07) translate(1%, -1%); } to { transform: scale(1); }
  }
  .drift-a { animation: travelmap-drift-a var(--drift-ms, 7000ms) linear forwards; }
  .drift-b { animation: travelmap-drift-b var(--drift-ms, 7000ms) linear forwards; }
  @media (prefers-reduced-motion: reduce) {
    .drift-a, .drift-b { animation: none; }
    .photo { transform: none; transition: opacity ${FADE_MS}ms ease; }
  }
  .topbar {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; gap: 8px; align-items: center;
    padding: 10px 12px 24px;
    background: linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,0));
    transition: opacity 0.4s ease;
    /* The map's own zoom buttons sit under this bar and must stay usable. */
    pointer-events: none;
  }
  .topbar > * { pointer-events: auto; }
  .frame.idle-pointer.playing .topbar { opacity: 0; }
  .topbar select, .topbar button {
    font: inherit; font-size: 16px;
    min-height: 40px;
    border: none; border-radius: 8px;
    background: rgba(255,255,255,.94); color: #111;
  }
  .topbar select { max-width: 55%; padding: 0 10px; }
  .topbar button { min-width: 44px; padding: 0 12px; cursor: pointer; }
  .topbar button:focus-visible, .topbar select:focus-visible {
    outline: 3px solid var(--accent-color, #e87722); outline-offset: 2px;
  }
  .caption {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 10;
    padding: 28px 18px 16px;
    background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.72));
    pointer-events: none;
  }
  .caption .place { font-size: 24px; font-weight: 600; line-height: 1.25; }
  .caption .sub { font-size: 16px; line-height: 1.4; opacity: .92; }
  .message {
    position: absolute; inset: 0; z-index: 8;
    display: none; align-items: center; justify-content: center;
    padding: 24px; text-align: center; font-size: 16px;
    background: var(--card-background-color, #1c1c1c);
    color: var(--primary-text-color, #fff);
  }
  .message.show { display: flex; }
`;

class TravelmapCard extends HTMLElement {
  static getStubConfig() {
    return {};
  }

  static getConfigElement() {
    return document.createElement("travelmap-card-editor");
  }

  static formSchema() {
    // The form of the card editor. The spots of the place name and the year
    // are not in it: the editor shows those as a frame to drag them in.
    const text = TEXT[languageOf(globalHass())];
    return {
      schema: [
        { name: "trip", selector: { text: {} } },
        { name: "group", selector: { text: {} } },
        { name: "height", selector: { text: {} } },
        {
          name: "view",
          selector: {
            select: {
              mode: "dropdown",
              options: VIEWS.map((value) => ({ value, label: text[`view_${value}`] })),
            },
          },
        },
        {
          name: "projection",
          selector: {
            select: {
              mode: "dropdown",
              options: PROJECTIONS.map((value) => ({
                value,
                label: text[`projection_${value}`],
              })),
            },
          },
        },
        { name: "max_zoom", selector: { number: { min: 1, max: 18, mode: "slider" } } },
        {
          name: "photo_size",
          selector: { number: { min: 10, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } },
        },
        {
          name: "video_size",
          selector: { number: { min: 10, max: 100, step: 5, mode: "slider", unit_of_measurement: "%" } },
        },
        { name: "autoplay", selector: { boolean: {} } },
        {
          name: "photo_seconds",
          selector: { number: { min: 1, max: 60, mode: "slider", unit_of_measurement: "s" } },
        },
        {
          name: "video_seconds",
          selector: { number: { min: 1, max: 180, step: 1, mode: "slider", unit_of_measurement: "s" } },
        },
        { name: "media_per_visit", selector: { number: { min: 0, max: 50, mode: "slider" } } },
        { name: "place_zoom", selector: { number: { min: 3, max: 18, mode: "slider" } } },
        {
          name: "fly_seconds",
          selector: { number: { min: 1, max: 30, mode: "slider", unit_of_measurement: "s" } },
        },
        {
          name: "overview_seconds",
          selector: { number: { min: 0, max: 60, mode: "slider", unit_of_measurement: "s" } },
        },
        {
          name: "map_style",
          selector: {
            select: {
              mode: "dropdown",
              options: MAP_STYLES.map((value) => ({ value, label: text[`map_style_${value}`] })),
            },
          },
        },
        { name: "relief", selector: { boolean: {} } },
        { name: "marker_icon", selector: { icon: {} } },
        { name: "marker_image", selector: { text: {} } },
        {
          name: "labels",
          selector: {
            select: {
              mode: "dropdown",
              options: LABEL_MODES.map((value) => ({ value, label: text[`labels_${value}`] })),
            },
          },
        },
        {
          name: "marker_size",
          selector: { number: { min: 6, max: 60, mode: "slider", unit_of_measurement: "px" } },
        },
        { name: "show_numbers", selector: { boolean: {} } },
        { name: "route_line", selector: { boolean: {} } },
        { name: "photo_line", selector: { boolean: {} } },
        { name: "route_color", selector: { text: {} } },
      ],
      computeLabel: (schema) => TEXT[languageOf(globalHass())][`form_${schema.name}`],
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = { ...DEFAULTS };
    this._hass = undefined;
    this._language = "en";
    this._entries = [];
    this._trips = [];
    this._groups = [];
    this._tripId = undefined;
    this._places = [];
    this._markers = new Map();
    this._activePlaceId = undefined;
    this._playing = false;
    this._prepared = new Map();
    this._atOverview = true;
    this._generation = 0;
    this._wake = undefined;
    this._loadState = "new";
    this._built = false;
    this._pointerTimer = undefined;
  }

  setConfig(config) {
    const merged = { ...DEFAULTS };
    for (const [key, value] of Object.entries(config || {})) {
      if (value !== undefined && value !== null && value !== "") merged[key] = value;
    }
    if (!VIEWS.includes(merged.view)) {
      throw new Error("view must be world, trip or place");
    }
    for (const key of ["name_position", "year_position"]) {
      if (!POSITIONS.includes(merged[key])) {
        throw new Error(`${key} must be one of: ${POSITIONS.join(", ")}`);
      }
    }
    if (!LABEL_MODES.includes(merged.labels)) {
      throw new Error("labels must be few, all or none");
    }
    if (!MAP_STYLES.includes(merged.map_style)) {
      throw new Error("map_style must be meppie or default");
    }
    if (!PROJECTIONS.includes(merged.projection)) {
      throw new Error("projection must be flat or globe");
    }
    const previous = this._config;
    this._config = merged;
    this._rawConfig = config || {};
    if (!this._built) return;
    this._frame.style.height = merged.height;
    if (previous.labels !== merged.labels) this._applyLabels();
    if (
      previous.trip !== merged.trip ||
      previous.group !== merged.group ||
      previous.entry !== merged.entry
    ) {
      this._selectInitialTrip();
    } else if (
      previous.route_color !== merged.route_color ||
      previous.marker_size !== merged.marker_size ||
      previous.marker_icon !== merged.marker_icon ||
      previous.marker_image !== merged.marker_image ||
      previous.show_numbers !== merged.show_numbers ||
      previous.route_line !== merged.route_line ||
      previous.view !== merged.view ||
      previous.projection !== merged.projection ||
      previous.map_style !== merged.map_style ||
      previous.relief !== merged.relief ||
      previous.max_zoom !== merged.max_zoom
    ) {
      this._stop();
      this._applyMapStyle();
      this._applyProjection();
      this._drawTrip(true);
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const language = languageOf(hass);
    if (language !== this._language) {
      this._language = language;
      if (this._built) this._applyTexts();
    }
    if (first && this.isConnected) this._start();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: "full", rows: 8, min_rows: 4, min_columns: 6 };
  }

  connectedCallback() {
    this._build();
    if (this._hass) this._start();
    if (this._loadState === "ready" && this._trips.length === 0) this._retryLater();
    // Back on screen: the map builds a new engine, which starts as a globe.
    if (this._map) this._watchProjection();
  }

  disconnectedCallback() {
    this._stop();
    clearTimeout(this._retryTimer);
    clearInterval(this._projectionTimer);
  }

  _t(key) {
    return TEXT[this._language][key] || TEXT.en[key] || key;
  }

  _build() {
    if (this._built) return;
    this._built = true;
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="frame">
          <div class="map"></div>
          <div class="stage"><svg aria-hidden="true"></svg></div>
          <div class="topbar">
            <select class="trip"></select>
            <button class="play" type="button"></button>
            <button class="fullscreen" type="button">⛶</button>
          </div>
          <div class="caption"><div class="place"></div><div class="sub"></div></div>
          <div class="message show"></div>
        </div>
      </ha-card>
    `;
    this._frame = root.querySelector(".frame");
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this._resized(), 150);
      });
      this._resizeObserver.observe(this._frame);
    }
    this._mapHost = root.querySelector(".map");
    this._stage = root.querySelector(".stage");
    this._svg = root.querySelector(".stage svg");
    this._select = root.querySelector("select.trip");
    this._playButton = root.querySelector("button.play");
    this._fullscreenButton = root.querySelector("button.fullscreen");
    this._placeEl = root.querySelector(".caption .place");
    this._subEl = root.querySelector(".caption .sub");
    this._messageEl = root.querySelector(".message");
    this._frame.style.height = this._config.height;

    this._select.addEventListener("change", () => {
      this._tripId = this._select.value;
      this._stop();
      this._drawTrip(true);
    });
    this._playButton.addEventListener("click", () => this._toggle());
    this._fullscreenButton.addEventListener("click", () => this._toggleFullscreen());
    this._frame.addEventListener("pointermove", () => this._pointerActive());
    this._applyTexts();
  }

  _applyTexts() {
    this._select.setAttribute("aria-label", this._t("trip"));
    this._fullscreenButton.title = this._t("fullscreen");
    this._fullscreenButton.setAttribute("aria-label", this._t("fullscreen"));
    this._updatePlayButton();
    if (this._loadState === "loading" || this._loadState === "new") {
      this._message(this._t("loading"));
    }
    if (this._loadState === "ready") this._showCaption();
  }

  _updatePlayButton() {
    const label = this._t(this._playing ? "pause" : "play");
    this._playButton.textContent = this._playing ? "⏸" : "▶";
    this._playButton.title = label;
    this._playButton.setAttribute("aria-label", label);
  }

  _message(text) {
    this._messageEl.textContent = text || "";
    this._messageEl.classList.toggle("show", !!text);
  }

  _pointerActive() {
    this._frame.classList.remove("idle-pointer");
    clearTimeout(this._pointerTimer);
    this._pointerTimer = setTimeout(() => this._frame.classList.add("idle-pointer"), 4000);
  }

  // ----- Loading ----------------------------------------------------------

  async _start() {
    if (this._loadState !== "new") return;
    this._loadState = "loading";
    this._message(this._t("loading"));
    try {
      await this._fetchLibrary();
    } catch (err) {
      this._loadState = "failed";
      const unknown = err && (err.code === "unknown_command" || err.code === "not_found");
      this._message(unknown ? this._t("no_integration") : `${this._t("error")}: ${err.message || err}`);
      return;
    }
    if (!(await this._ensureMap())) {
      this._loadState = "failed";
      this._message(this._t("no_map"));
      return;
    }
    this._loadState = "ready";
    this._selectInitialTrip();
    if (this._config.autoplay && this._places.length) this._toggle();
  }

  async _fetchLibrary() {
    const result = await this._hass.callWS({ type: "travelmap/library" });
    this._entries = (result && result.entries) || [];
    this._fetchLibraryView();
    if (this._entries.length === 0) {
      const error = new Error("no entries");
      error.code = "not_found";
      throw error;
    }
  }

  async _ensureMap() {
    if (!customElements.get("ha-map")) {
      // ha-map is loaded on demand; the built-in map card pulls it in.
      try {
        const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : undefined;
        if (helpers) helpers.createCardElement({ type: "map", entities: [] });
      } catch (err) {
        // Fall through to the wait below.
      }
      await Promise.race([
        customElements.whenDefined("ha-map"),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
    }
    if (!customElements.get("ha-map")) return false;
    if (!this._map) {
      const map = document.createElement("ha-map");
      map.entities = [];
      map.autoFit = false;
      map.clusterMarkers = false;
      map.renderPassive = true;
      map.zoom = 12;
      map.zoomPosition = "topright";
      map.addEventListener("editable-location-clicked", (ev) => {
        const id = ev.detail && ev.detail.id;
        if (id !== undefined) this._startAt(id);
      });
      this._mapHost.appendChild(map);
      this._map = map;
      this._applyMapStyle();
      this._watchProjection();
    }
    return true;
  }

  _selectInitialTrip() {
    if (this._loadState !== "ready") return;
    this._stop();
    this._fetchLibraryView();
    this._select.innerHTML = "";
    if (this._trips.length > 1) {
      const option = document.createElement("option");
      option.value = ALL_TRIPS;
      option.textContent = this._t("all_trips");
      this._select.appendChild(option);
    }
    for (const group of this._groups) {
      const option = document.createElement("option");
      option.value = GROUP_PREFIX + group.id;
      option.textContent = `${this._t("group_label")}: ${group.name}`;
      this._select.appendChild(option);
    }
    for (const trip of this._trips) {
      const option = document.createElement("option");
      option.value = trip.id;
      option.textContent = trip.title || trip.id;
      this._select.appendChild(option);
    }
    this._select.hidden = this._trips.length < 2 && this._groups.length === 0;
    if (this._trips.length === 0) {
      const waiting = this._shownEntries().find((entry) => entry.available === false);
      this._message(
        waiting ? this._t("no_folder").replace("{path}", waiting.path || "") : this._t("no_trips")
      );
      this._retryLater();
      return;
    }
    clearTimeout(this._retryTimer);
    const wanted = this._config.trip;
    const found = this._trips.find((trip) => trip.id === wanted || trip.title === wanted);
    const wantedGroup = this._config.group;
    const group = this._groups.find((g) => g.id === wantedGroup || g.name === wantedGroup);
    // Without a wish, every trip is on the map at once.
    this._tripId = group
      ? GROUP_PREFIX + group.id
      : found
        ? found.id
        : this._trips.length > 1
          ? ALL_TRIPS
          : this._trips[0].id;
    this._select.value = this._tripId;
    this._drawTrip(true);
  }

  _shownEntries() {
    const wanted = this._config.entry;
    return wanted
      ? this._entries.filter((entry) => entry.entry_id === wanted || entry.title === wanted)
      : this._entries;
  }

  _fetchLibraryView() {
    this._trips = this._shownEntries().flatMap((entry) => entry.trips || []);
    this._groups = this._shownEntries().flatMap((entry) => entry.groups || []);
  }

  _retryLater() {
    // Nothing to show yet: the folder may still have to be added or filled.
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(async () => {
      if (!this.isConnected || this._loadState !== "ready") return;
      try {
        await this._fetchLibrary();
      } catch (err) {
        this._retryLater();
        return;
      }
      this._selectInitialTrip();
    }, RETRY_MS);
  }

  _trip() {
    // The one trip that is selected; undefined when all trips are shown.
    return this._trips.find((trip) => trip.id === this._tripId);
  }

  _group() {
    // The selected group from the Travel map panel, when one is selected.
    if (!String(this._tripId || "").startsWith(GROUP_PREFIX)) return undefined;
    return this._groups.find((group) => GROUP_PREFIX + group.id === this._tripId);
  }

  _shownTrips() {
    if (this._tripId === ALL_TRIPS) return this._trips;
    const group = this._group();
    if (group) {
      const ids = new Set(group.items.map((item) => item.trip));
      return this._trips.filter((trip) => ids.has(trip.id));
    }
    return this._trips.filter((t) => t.id === this._tripId);
  }

  _playablePlaces() {
    // A place is playable when it has a position. Its key, trip folder plus
    // place folder, is its identity; the same place name may occur in two trips.
    const playable = (trip, only) =>
      trip.places
        .filter((place) => place.latitude !== null && place.longitude !== null)
        .filter((place) => only === undefined || place.id === only)
        .map((place) => ({ ...place, key: `${trip.id}/${place.id}`, trip }));
    const group = this._group();
    if (!group) return this._shownTrips().flatMap((trip) => playable(trip));
    // A group plays in its own order; an item is a whole trip or one place.
    const seen = new Set();
    return group.items
      .flatMap((item) => {
        const trip = this._trips.find((candidate) => candidate.id === item.trip);
        return trip ? playable(trip, item.place) : [];
      })
      .filter((place) => !seen.has(place.key) && seen.add(place.key));
  }

  // ----- Map --------------------------------------------------------------

  _routeColor() {
    if (this._config.route_color) return this._config.route_color;
    if (this._config.map_style === "meppie") return MEPPIE_ACCENT;
    const accent = getComputedStyle(this).getPropertyValue("--accent-color").trim();
    return accent || "#e87722";
  }

  _markerSize() {
    // An icon needs more room than a dot; a size that was set always wins.
    const set = this._rawConfig && this._rawConfig.marker_size;
    const size = set ? this._number("marker_size") : this._markerIcon() ? 30 : DEFAULTS.marker_size;
    return Math.round(Math.min(Math.max(size, 6), 60) * this._scale());
  }

  _markerIcon() {
    const image = String(this._config.marker_image || "").trim();
    if (image) return { image };
    const icon = String(this._config.marker_icon || "").trim();
    if (!icon) return undefined;
    // "mdi:kangaroo" and the like are icons; anything else is a picture.
    return /^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(icon) ? { icon } : { image: icon };
  }

  _markerElement(number) {
    // The map positions the outer element with its own transform, so all
    // styling, and the scale of the active marker, goes on the inner one.
    const size = this._markerSize();
    const custom = this._markerIcon();
    const numbered = !custom && this._config.show_numbers === true && size >= 18;
    const element = document.createElement("div");
    element.style.cssText = `width:${size}px;height:${size}px;cursor:pointer`;
    const dot = document.createElement("div");
    if (numbered) dot.textContent = String(number);
    dot.style.cssText = [
      "width:100%", "height:100%", "box-sizing:border-box",
      "display:flex", "align-items:center", "justify-content:center",
      `font:600 ${Math.round(size * 0.47)}px/1 sans-serif`,
      "transition:transform .3s ease",
    ].join(";");
    if (custom && custom.icon) {
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", custom.icon);
      icon.style.cssText = `--mdc-icon-size:${size}px;display:flex;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))`;
      dot.appendChild(icon);
    } else if (custom) {
      const image = document.createElement("img");
      image.src = custom.image;
      image.alt = "";
      image.style.cssText = "width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))";
      dot.appendChild(image);
    } else {
      dot.style.borderRadius = "50%";
      dot.style.boxShadow = "0 1px 4px rgba(0,0,0,.5)";
    }
    element.appendChild(dot);
    return element;
  }

  _styleMarker(element, active) {
    const color = this._routeColor();
    const dot = element.firstElementChild;
    dot.style.transform = active ? "scale(1.5)" : "scale(1)";
    // Places close together overlap in the overview; the active one goes on top.
    element.style.zIndex = active ? "5" : "";
    if (this._markerIcon()) {
      // An icon takes the marker colour; a picture keeps its own colours.
      dot.style.color = color;
      return;
    }
    dot.style.background = active ? color : "#fff";
    dot.style.color = active ? "#fff" : "#111";
    const border = Math.max(2, Math.round(this._markerSize() / 8));
    dot.style.border = `${border}px solid ${active ? "#fff" : color}`;
  }

  _drawTrip(fit) {
    const trips = this._shownTrips();
    if (trips.length === 0 || !this._map) return;
    this._places = this._playablePlaces();
    this._activePlaceId = undefined;
    this._markers = new Map();
    this._drawnScale = this._scale();
    this._map.zoom = this._number("max_zoom");

    this._map.editableLocations = this._places.map((place, index) => {
      const element = this._markerElement(index + 1);
      this._styleMarker(element, false);
      this._markers.set(place.key, element);
      return {
        id: place.key,
        location: [place.latitude, place.longitude],
        element,
        elementSize: [this._markerSize(), this._markerSize()],
        title: place.name,
        activatable: true,
      };
    });

    // One route per trip: places of different trips are not joined.
    this._map.paths =
      this._config.route_line === true
        ? trips
            .map((trip) => ({
              trip,
              places: this._places.filter((place) => place.trip.id === trip.id),
            }))
            .filter((route) => route.places.length > 1)
            .map((route) => ({
              points: route.places.map((place) => ({
                point: [place.latitude, place.longitude],
                timestamp: route.trip.start ? new Date(route.trip.start) : new Date(),
              })),
              color: this._routeColor(),
              name: route.trip.title,
              fullDatetime: true,
            }))
        : [];

    this._message(this._places.length ? "" : this._t("no_places"));
    if (fit) this._fitTrip(false);
    this._showCaption();
  }

  _number(key) {
    const value = Number(this._config[key]);
    return Number.isFinite(value) && value > 0 ? value : DEFAULTS[key];
  }

  _fitTrip(fly) {
    // The overview: the whole world, or the whole trip.
    if (!this._map) return;
    // Only view: trip stays on the trip; otherwise the overview is the world.
    const world = this._config.view !== "trip";
    if (!world && this._places.length === 0) return;
    const points = world
      ? WORLD_BOUNDS
      : this._places.map((place) => [place.latitude, place.longitude]);
    const zoom = world ? 6 : this._number("max_zoom");
    const pad = world ? 0 : 0.3;
    this._atOverview = true;
    if (world && this._fitWorld(fly)) return;
    const gl = fly ? this._engineMap() : undefined;
    if (gl) {
      // A slow glide back, driven on the map engine itself.
      try {
        const lats = points.map((point) => point[0]);
        const lons = points.map((point) => point[1]);
        const frame = this._frame.getBoundingClientRect();
        gl.stop();
        gl.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          {
            duration: 3000,
            essential: true,
            maxZoom: zoom - ENGINE_ZOOM_OFFSET,
            padding: Math.round(Math.min(frame.width, frame.height) * pad * 0.5),
          }
        );
        return;
      } catch (err) {
        // Fall through to the map's own fit.
      }
    }
    this._map.fitBounds(points, { zoom, pad, fly });
  }

  _worldView() {
    // The flat world exactly once: as wide as the card, with the longitude
    // of home in the middle. What does not fit in the height is cut off at
    // the poles, a little more in the south than in the north.
    const frame = this._frame.getBoundingClientRect();
    if (!frame.width || !frame.height) return undefined;
    const size = Math.max(frame.width, frame.height);
    const half = Math.min(frame.height / size / 2, 0.5);
    const toY = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
    const y = Math.min(Math.max(toY(20), half), 1 - half);
    const latitude = (360 / Math.PI) * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90;
    const home = Number(this._hass && this._hass.config && this._hass.config.longitude);
    return {
      center: [Number.isFinite(home) ? home : 0, latitude],
      zoom: Math.log2(size / 512),
    };
  }

  _fitWorld(fly) {
    // Returns false when the map engine cannot be reached, or shows a globe.
    const gl = this._engineMap();
    if (!gl || this._config.projection === "globe") return false;
    const view = this._worldView();
    if (!view) return false;
    try {
      gl.stop();
      // Zooming out further would show the world more than once.
      gl.setMinZoom(Math.max(view.zoom - 0.001, 0));
      if (fly) {
        // The same kind of flight as towards a place, backwards: rise and
        // move at the same time, slow start, slow arrival. A plain ease
        // would dart to the middle first and only then zoom out.
        gl.flyTo({
          ...view,
          duration: this._flySeconds() * 1000,
          curve: 1.2,
          essential: true,
          easing: FLIGHT_EASING,
        });
      } else gl.jumpTo(view);
      return true;
    } catch (err) {
      return false;
    }
  }

  _scale() {
    // On a 4K or 8K screen without scaling, markers and buttons grow along.
    const width = this._frame ? this._frame.getBoundingClientRect().width : 0;
    return Math.min(Math.max(width / 1920, 1), 4);
  }

  _resized() {
    if (!this._frame) return;
    const scale = this._scale();
    this._frame.style.setProperty("--tm-scale", String(Math.round(scale * 100) / 100));
    if (Math.abs(scale - (this._drawnScale || 1)) > 0.05 && !this._playing && this._map) {
      this._drawTrip(false);
    }
    if (this._config.view !== "trip" && (this._atOverview || !this._playing)) this._fitWorld(false);
    else if (this._config.view !== "trip") {
      // Keep the limit right while a place is on screen.
      const gl = this._engineMap();
      const view = this._worldView();
      if (gl && view && this._config.projection !== "globe") {
        try {
          gl.setMinZoom(Math.max(view.zoom - 0.001, 0));
        } catch (err) {
          // Leave the map as it is.
        }
      }
    }
  }

  _zoomFor(place) {
    // A trip can ask for its own zoom level; the card's setting is the default.
    const own = Number(place.trip && place.trip.zoom);
    return Number.isFinite(own) && own >= 1 ? own : this._number("place_zoom");
  }

  _flySeconds() {
    return Math.min(Math.max(this._number("fly_seconds"), 1), 30);
  }

  async _flyTo(place) {
    // One long, eased flight from where the map is to the place. The map's
    // own fit flies at a fixed speed and jumps when the device asks for
    // reduced motion, so the flight is driven on the map engine, with a set
    // duration.
    const seconds = this._flySeconds();
    const zoom = this._zoomFor(place);
    const gl = this._engineMap();
    if (gl) {
      try {
        gl.stop();
        const options = {
          center: [place.longitude, place.latitude],
          zoom: zoom - ENGINE_ZOOM_OFFSET,
          duration: seconds * 1000,
          curve: 1.2,
          essential: true,
          easing: FLIGHT_EASING,
        };
        const from = this._lastPlace;
        if (from && from.trip.id === place.trip.id && from.key !== place.key) {
          // A hop within a trip is short. Left alone, the map barely rises
          // and races over the ground at full detail, which stutters. Rise
          // until both places are in view, cross over, and come down.
          const peak = this._zoomShowing(gl, from, place);
          if (peak !== undefined) options.minZoom = Math.min(peak, options.zoom - 0.5);
        }
        const arrived = new Promise((resolve) => gl.once("moveend", resolve));
        gl.flyTo(options);
        await Promise.race([arrived, this._sleep(seconds * 1000 + 1500)]);
        this._lastPlace = place;
        return;
      } catch (err) {
        // Fall through to the map's own flight.
      }
    }
    this._map.fitBounds([[place.latitude, place.longitude]], { zoom, fly: true });
    await this._sleep(FLY_MS);
    this._lastPlace = place;
  }

  _zoomShowing(gl, a, b) {
    // The engine zoom at which both places fit in the card with room to spare.
    try {
      const frame = this._frame.getBoundingClientRect();
      const camera = gl.cameraForBounds(
        [
          [Math.min(a.longitude, b.longitude), Math.min(a.latitude, b.latitude)],
          [Math.max(a.longitude, b.longitude), Math.max(a.latitude, b.latitude)],
        ],
        { padding: Math.round(Math.min(frame.width, frame.height) * 0.25) }
      );
      return camera && Number.isFinite(camera.zoom) ? camera.zoom : undefined;
    } catch (err) {
      return undefined;
    }
  }

  async _showOverview(generation) {
    // After a trip: back out to everything, and stay there for a while.
    const seconds = Number(this._config.overview_seconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this._setActive(undefined);
    this._showCaption();
    if (this._config.view === "place") {
      const gl = this._engineMap();
      const arrived = gl ? new Promise((resolve) => gl.once("moveend", resolve)) : undefined;
      this._fitTrip(true);
      this._lastPlace = undefined;
      await Promise.race([
        arrived || this._sleep(FLY_MS),
        this._sleep(this._flySeconds() * 1000 + 1500),
      ]);
      if (!this._alive(generation)) return;
    }
    await this._sleep(Math.min(seconds, 600) * 1000);
  }

  // ----- Colours and relief ---------------------------------------------------

  _applyMapStyle() {
    if (!this._map) return;
    this._map.mapStyle =
      this._config.map_style === "meppie"
        ? { base: "colorful", colors: MEPPIE_DAY, colors_dark: MEPPIE_NIGHT }
        : undefined;
    this._applyRelief();
  }

  _applyLabels() {
    // Fewer names on the map: less to load and redraw after every move.
    const gl = this._engineMap();
    if (!gl || !gl.getStyle) return;
    try {
      const mode = this._config.labels;
      const style = gl.getStyle();
      for (const layer of (style && style.layers) || []) {
        if (layer.type !== "symbol") continue;
        const show = mode === "all" || (mode === "few" && LABELS_KEPT.includes(layer.id));
        const wanted = show ? "visible" : "none";
        // Only write on a change: writing triggers the event this runs on.
        if ((gl.getLayoutProperty(layer.id, "visibility") || "visible") !== wanted) {
          gl.setLayoutProperty(layer.id, "visibility", wanted);
        }
        if (layer.id === "label-place-city") {
          if (this._cityFilter === undefined) this._cityFilter = layer.filter || null;
          const filter = mode === "few" ? BIG_CITY_FILTER : this._cityFilter;
          if (JSON.stringify(gl.getFilter(layer.id) || null) !== JSON.stringify(filter)) {
            gl.setFilter(layer.id, filter);
          }
        }
      }
    } catch (err) {
      // The map keeps the names it had.
    }
  }

  _applyRelief() {
    // The vector map knows forest, sand and ice only from close by. Zoomed
    // out, a satellite picture of the land goes under the sea and the labels,
    // and the sea is laid over it half see-through.
    const gl = this._engineMap();
    if (!gl || !gl.isStyleLoaded || !gl.getLayer) return;
    try {
      const wanted = this._config.relief !== false;
      const present = !!gl.getLayer(RELIEF_SOURCE);
      this._applySeaDepth(gl, wanted);
      if (!wanted) {
        if (present) gl.removeLayer(RELIEF_SOURCE);
        if (gl.getSource(RELIEF_SOURCE)) gl.removeSource(RELIEF_SOURCE);
        return;
      }
      if (present) return;
      if (!gl.getSource(RELIEF_SOURCE)) {
        gl.addSource(RELIEF_SOURCE, {
          type: "raster",
          tiles: [RELIEF_TILES],
          tileSize: 256,
          maxzoom: RELIEF_MAX_ZOOM,
          attribution: "Relief: NASA Blue Marble",
        });
      }
      const dark = !!(this._hass && this._hass.themes && this._hass.themes.darkMode);
      gl.addLayer(
        {
          id: RELIEF_SOURCE,
          type: "raster",
          source: RELIEF_SOURCE,
          paint: {
            // Full strength for the world, fading out where the vector map
            // takes over with its own detail.
            "raster-opacity": ["interpolate", ["linear"], ["zoom"], 5, 1, 9, 0.35, 11, 0],
            "raster-saturation": -0.15,
            "raster-brightness-max": dark ? 0.82 : 1,
            "raster-fade-duration": 300,
          },
        },
        gl.getLayer("water-ocean") ? "water-ocean" : undefined
      );
    } catch (err) {
      // Without relief the map is still complete.
    }
  }

  _applySeaDepth(gl, relief) {
    // The satellite picture also holds the depth of the sea. Zoomed out, the
    // blue of the sea is laid over it half see-through, so shallow and deep
    // water differ; from close by the sea is the plain blue of the style.
    try {
      const layer = gl.getLayer("water-ocean");
      if (!layer || layer.type !== "fill") return;
      const wanted = relief ? ["interpolate", ["linear"], ["zoom"], 5, 0.45, 9, 0.8, 11, 1] : 1;
      const current = gl.getPaintProperty("water-ocean", "fill-opacity");
      // Only write on a change: writing triggers the event this runs on.
      if (JSON.stringify(current === undefined ? 1 : current) !== JSON.stringify(wanted)) {
        gl.setPaintProperty("water-ocean", "fill-opacity", wanted);
      }
    } catch (err) {
      // The sea then keeps its plain colour.
    }
  }

  // ----- Projection -------------------------------------------------------
  //
  // Home Assistant's map style draws a globe when zoomed out, and <ha-map>
  // has no setting for that. A flat world map therefore reaches into the map
  // engine behind it (MapLibre) and asks for the Mercator projection. That
  // is not a public interface: when it is not there, the card says nothing
  // and the map stays as Home Assistant draws it.

  _engineMap() {
    const engine = this._map && this._map._engine;
    const gl = engine && engine._map;
    return gl && typeof gl.setProjection === "function" ? gl : undefined;
  }

  _applyProjection() {
    const gl = this._engineMap();
    if (!gl) return false;
    const wanted = this._config.projection === "globe" ? "globe" : "mercator";
    const apply = () => {
      try {
        const current = gl.getProjection ? gl.getProjection() : undefined;
        if (!current || current.type !== wanted) gl.setProjection({ type: wanted });
      } catch (err) {
        // Leave the map as it is.
      }
    };
    if (this._projectionMap !== gl) {
      // A theme change reloads the style, and the style brings the globe back.
      this._projectionMap = gl;
      gl.on("styledata", () => {
        this._applyProjection();
        this._applyRelief();
        this._applyLabels();
      });
    }
    apply();
    this._applyRelief();
    this._applyLabels();
    return true;
  }

  _watchProjection() {
    // The engine arrives some time after the element; fit again once the
    // projection is in place, because the first fit was made for the globe.
    let tries = 0;
    clearInterval(this._projectionTimer);
    this._projectionTimer = setInterval(() => {
      tries += 1;
      const done = this._applyProjection();
      if (done || tries > 60) clearInterval(this._projectionTimer);
      if (done && !this._playing) this._fitTrip(false);
    }, 500);
  }

  _setActive(placeId) {
    if (this._activePlaceId !== undefined) {
      const previous = this._markers.get(this._activePlaceId);
      if (previous) this._styleMarker(previous, false);
    }
    this._activePlaceId = placeId;
    const current = placeId !== undefined ? this._markers.get(placeId) : undefined;
    if (current) this._styleMarker(current, true);
  }

  _showCaption(place, item, index, total) {
    if (!place) {
      const trip = this._trip();
      const group = this._group();
      if (!trip && this._tripId !== ALL_TRIPS && !group) {
        this._placeEl.textContent = "";
        this._subEl.textContent = "";
        return;
      }
      const country = trip && trip.country ? ` · ${trip.country}` : "";
      this._placeEl.textContent = trip
        ? trip.title || trip.id
        : group
          ? group.name
          : this._t("all_trips");
      const hint = this._places.length ? ` · ${this._t("press_play")}` : "";
      const noun = this._t(this._places.length === 1 ? "place_one" : "places");
      this._subEl.textContent = `${this._places.length} ${noun}${country}${hint}`;
      return;
    }
    const trip = place.trip;
    const number = this._places.findIndex((candidate) => candidate.key === place.key) + 1;
    this._placeEl.textContent =
      this._config.show_numbers === true ? `${number}. ${place.name}` : place.name;
    const count = item ? `${index + 1}/${total}` : "";
    // A trip folder that is its own place would only repeat the name.
    const title = trip.title || trip.id;
    const parts = [title === place.name ? "" : title, trip.country || "", count];
    this._subEl.textContent = parts.filter(Boolean).join(" · ");
  }

  // ----- Playback ---------------------------------------------------------

  _toggle() {
    if (this._playing) {
      this._stop();
      this._fitTrip(this._config.view === "place");
      this._showCaption();
      return;
    }
    const start = this._places.findIndex((place) => place.key === this._activePlaceId);
    this._play(Math.max(start, 0));
  }

  _startAt(placeId) {
    const index = this._places.findIndex((place) => place.key === placeId);
    if (index >= 0) this._play(index);
  }

  _stop() {
    this._generation += 1;
    this._playing = false;
    if (this._wake) this._wake();
    if (!this._built) return;
    const gl = this._engineMap();
    if (gl) gl.stop();
    this._lastPlace = undefined;
    this._frame.classList.remove("playing");
    this._clearStage();
    this._setActive(undefined);
    this._updatePlayButton();
  }

  async _play(startIndex) {
    if (this._places.length === 0) return;
    this._generation += 1;
    if (this._wake) this._wake();
    const generation = this._generation;
    const resuming = this._playing;
    this._playing = true;
    this._frame.classList.add("playing");
    this._clearStage();
    this._updatePlayButton();
    this._pointerActive();
    if (!resuming && this._config.view !== "place") {
      // Start from the overview, so every marker is on screen. No flight:
      // the map is usually there already, and a flight to where the map
      // already is breaks the Leaflet fallback engine.
      this._fitTrip(false);
      await this._sleep(SETTLE_MS);
    }

    let index = startIndex;
    while (this._alive(generation)) {
      const place = this._places[index];
      const upcoming = this._places[(index + 1) % this._places.length];
      await this._playPlace(generation, place, upcoming === place ? undefined : upcoming);
      if (!this._alive(generation)) return;
      index = (index + 1) % this._places.length;
      if (index === 0) await this._refresh(generation);
      if (!this._alive(generation)) return;
      const next = this._places[index % Math.max(this._places.length, 1)];
      if (!next || next.trip.id !== place.trip.id || index === 0) {
        await this._showOverview(generation);
      }
    }
  }

  _alive(generation) {
    return this._playing && generation === this._generation && this.isConnected;
  }

  async _refresh(generation) {
    // Pick up photos added since the last round, without interrupting.
    try {
      await this._fetchLibrary();
    } catch (err) {
      return;
    }
    if (!this._alive(generation)) return;
    const places = this._playablePlaces();
    const same =
      places.length === this._places.length &&
      places.every(
        (place, i) =>
          place.key === this._places[i].key &&
          place.latitude === this._places[i].latitude &&
          place.longitude === this._places[i].longitude
      );
    if (same) {
      this._places = places;
    } else {
      this._drawTrip(false);
    }
  }

  _batch(place, advance) {
    // The photos and videos of this visit. With a limit per visit, a place
    // with more shows the next lot on the next round, and starts again at
    // the first once all have been shown.
    const all = place.media || [];
    const limit = Math.floor(Number(this._config.media_per_visit));
    if (!Number.isFinite(limit) || limit <= 0 || all.length <= limit) return all;
    if (!this._cursors) this._cursors = new Map();
    let start = this._cursors.get(place.key) || 0;
    if (start >= all.length) start = 0;
    if (advance) this._cursors.set(place.key, start + limit);
    return all.slice(start, start + limit);
  }

  async _playPlace(generation, place, upcoming) {
    this._setActive(place.key);
    this._showCaption(place);
    const media = this._batch(place, true);
    // The first photo is fetched during the flight.
    this._prepareMedia(media[0]);
    if (this._config.view === "place") {
      this._atOverview = false;
      await this._flyTo(place);
      if (!this._alive(generation)) return;
      // A moment to take in where the map has arrived.
      await this._sleep(300);
    } else {
      await this._sleep(500);
    }
    if (media.length === 0) {
      await this._sleep(2000);
      return;
    }
    for (let i = 0; i < media.length; i += 1) {
      if (!this._alive(generation)) return;
      this._showCaption(place, media[i], i, media.length);
      // The next one is fetched while this one is on screen.
      this._prepareMedia(media[i + 1] || (upcoming && this._batch(upcoming, false)[0]));
      await this._showMedia(generation, place, media[i]);
    }
    if (!this._alive(generation)) return;
    // The last photo goes back into the marker it came from.
    for (const card of this._stage.querySelectorAll(".photo")) card.classList.remove("show");
    for (const line of this._svg.querySelectorAll("line")) line.classList.remove("show");
    await this._sleep(GROW_MS);
    if (this._alive(generation)) this._clearStage();
  }

  async _signedUrl(path) {
    const signed = await this._hass.callWS({
      type: "auth/sign_path",
      path,
      expires: SIGN_EXPIRES_SECONDS,
    });
    return this._hass.hassUrl ? this._hass.hassUrl(signed.path) : signed.path;
  }

  _markerPoint(placeId) {
    // Where the marker of the place is on screen, relative to the card.
    const frame = this._frame.getBoundingClientRect();
    const marker = this._markers.get(placeId);
    const rect = marker && marker.isConnected ? marker.getBoundingClientRect() : undefined;
    let x = frame.width / 2;
    let y = frame.height / 2;
    if (rect && rect.width > 0) {
      x = rect.left + rect.width / 2 - frame.left;
      y = rect.top + rect.height / 2 - frame.top;
    }
    return {
      x: Math.min(Math.max(x, 0), frame.width),
      y: Math.min(Math.max(y, 0), frame.height),
      width: frame.width,
      height: frame.height,
    };
  }

  _mediaSize(kind) {
    // The set size is what the viewer gets: a share of the card's width.
    const own = Number(this._config[kind === "video" ? "video_size" : "photo_size"]);
    const size = Number.isFinite(own) && own > 0 ? own : this._number("photo_size");
    return Math.min(Math.max(size, 10), 100) / 100;
  }

  _tripYear(trip) {
    // Set in the management panel, or taken from the dates or folder name.
    return (trip && trip.year) || "";
  }

  _addLabels(card, place, width) {
    // Place name and year go on the photo, each where the settings put it.
    // Two texts in the same spot become one line.
    const spots = new Map();
    const put = (position, text) => {
      if (!text || position === "none") return;
      spots.set(position, spots.has(position) ? `${spots.get(position)} · ${text}` : text);
    };
    put(this._config.name_position, place.name);
    put(this._config.year_position, this._tripYear(place.trip));
    const size = Math.max(16, Math.round(width * 0.042));
    const bands = new Set();
    for (const [position, text] of spots) {
      const [edge, side] = position.split("-");
      if (!bands.has(edge)) {
        bands.add(edge);
        const band = document.createElement("div");
        band.className = `band ${edge}`;
        card.appendChild(band);
      }
      const label = document.createElement("div");
      label.className = `label ${edge} ${side}`;
      label.textContent = text;
      // The name is the headline; a year on its own is a size smaller.
      const year = text === this._tripYear(place.trip);
      label.style.fontSize = `${year ? Math.max(16, Math.round(size * 0.8)) : size}px`;
      card.appendChild(label);
    }
  }

  _placePhoto(card, point, ratio, kind) {
    // As wide as the setting says, and never taller than the card has room
    // for. Beside the marker where that fits; otherwise it overlaps it.
    const margin = 16;
    const top = 64;
    const bottom = 84;
    const gap = 48;
    const maxWidth = Math.max((point.width - 2 * margin) * this._mediaSize(kind), 80);
    const maxHeight = Math.max(point.height - top - bottom, 60);
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));
    const left =
      point.x < point.width / 2
        ? clamp(point.x + gap, margin, point.width - width - margin)
        : clamp(point.x - gap - width, margin, point.width - width - margin);
    const y = clamp(point.y - height / 2, top, point.height - height - bottom);
    card.style.left = `${left}px`;
    card.style.top = `${y}px`;
    card.style.width = `${width}px`;
    card.style.height = `${height}px`;
    card.style.transformOrigin = `${point.x - left}px ${point.y - y}px`;
    card.dataset.width = String(Math.round(width));
    // The connecting line ends at the edge of the photo nearest the marker.
    return {
      x: clamp(point.x, left, left + width),
      y: clamp(point.y, y, y + height),
    };
  }

  _prepareMedia(item) {
    // Fetch and decode a photo or video before it is due, so it can appear
    // the moment the map arrives or the previous photo is done.
    if (!item) return undefined;
    if (!this._prepared) this._prepared = new Map();
    if (this._prepared.has(item.url)) return this._prepared.get(item.url);
    const ready = (async () => {
      const url = await this._signedUrl(item.url);
      if (item.type === "video") {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.preload = "auto";
        video.src = url;
        await new Promise((resolve, reject) => {
          video.addEventListener("loadeddata", resolve, { once: true });
          video.addEventListener("error", () => reject(new Error("video")), { once: true });
        });
        return video;
      }
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return image;
    })();
    // A failure is dealt with when the item is shown.
    ready.catch(() => undefined);
    // Never keep more than a few ahead.
    if (this._prepared.size > 4) this._prepared.clear();
    this._prepared.set(item.url, ready);
    return ready;
  }

  async _showMedia(generation, place, item) {
    let element;
    let seconds;
    let ratio;
    try {
      element = await this._prepareMedia(item);
      this._prepared.delete(item.url);
      if (!this._alive(generation)) return;
      if (item.type === "video") {
        const limit = this._number("video_seconds");
        seconds = Number.isFinite(element.duration) ? Math.min(element.duration, limit) : limit;
        ratio = element.videoWidth / element.videoHeight;
      } else {
        seconds = this._number("photo_seconds");
        ratio = element.naturalWidth / element.naturalHeight;
        element.className = Math.random() < 0.5 ? "drift-a" : "drift-b";
        element.style.setProperty("--drift-ms", `${seconds * 1000 + GROW_MS}ms`);
      }
    } catch (err) {
      // A file that cannot be shown is skipped; the rest of the place plays on.
      return;
    }
    if (!this._alive(generation)) return;
    if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1.5;

    const point = this._markerPoint(place.key);
    const card = document.createElement("div");
    card.className = "photo";
    card.appendChild(element);
    const edge = this._placePhoto(card, point, ratio, item.type);
    this._addLabels(card, place, Number(card.dataset.width));

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", point.x);
    line.setAttribute("y1", point.y);
    line.setAttribute("x2", edge.x);
    line.setAttribute("y2", edge.y);
    line.setAttribute("stroke", this._routeColor());

    const oldCards = Array.from(this._stage.querySelectorAll(".photo"));
    const oldLines = Array.from(this._svg.querySelectorAll("line"));
    if (this._config.photo_line === true) this._svg.appendChild(line);
    this._stage.appendChild(card);
    // Force a style pass so the photo starts small, at the marker.
    void card.offsetWidth;
    card.classList.add("show");
    line.classList.add("show");
    if (item.type === "video") element.play().catch(() => undefined);
    // The photo before it fades away underneath.
    for (const old of oldCards) old.classList.replace("show", "leave");
    for (const old of oldLines) old.classList.remove("show");
    setTimeout(() => [...oldCards, ...oldLines].forEach((old) => old.remove()), GROW_MS);

    await this._sleep(seconds * 1000);
  }

  _clearStage() {
    if (!this._stage) return;
    for (const card of this._stage.querySelectorAll(".photo")) card.remove();
    this._svg.replaceChildren();
  }

  _sleep(ms) {
    // Resolves early when playback stops or jumps to another place.
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        if (this._wake === done) this._wake = undefined;
        resolve();
      };
      const timer = setTimeout(done, ms);
      this._wake = done;
    });
  }

  _toggleFullscreen() {
    if (document.fullscreenElement || this.shadowRoot.fullscreenElement) {
      document.exitFullscreen();
    } else if (this._frame.requestFullscreen) {
      this._frame.requestFullscreen().catch(() => undefined);
    }
  }
}

// ----- Card editor -----------------------------------------------------------

const EDITOR_STYLE = `
  :host { display: block; }
  .labels { margin: 16px 0 8px; }
  .labels h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 500; }
  .labels p { margin: 0 0 12px; color: var(--secondary-text-color); line-height: 1.5; }
  .photo {
    position: relative; aspect-ratio: 16 / 9; max-width: 520px;
    border-radius: 12px; overflow: hidden;
    background: linear-gradient(160deg, #7DB38A 0%, #1A3229 55%, #0F221B 100%);
    display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr;
    align-content: space-between; gap: 0; padding: 8px; box-sizing: border-box;
  }
  .zone {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; min-height: 44px;
    border: 2px dashed rgba(251, 248, 242, .45); border-radius: 8px; margin: 3px;
    box-sizing: border-box;
  }
  .zone[data-zone^="top"] { align-content: flex-start; align-self: start; }
  .zone[data-zone^="bottom"] { align-content: flex-end; align-self: end; }
  .zone[data-zone$="left"] { justify-content: flex-start; }
  .zone[data-zone$="center"] { justify-content: center; }
  .zone[data-zone$="right"] { justify-content: flex-end; }
  .zone.over { border-style: solid; border-color: #F2C230; background: rgba(242, 194, 48, .2); }
  .tray {
    max-width: 520px; margin-top: 8px; box-sizing: border-box;
    border-color: var(--divider-color, #888); align-items: center;
  }
  .tray::before {
    content: attr(data-title); color: var(--secondary-text-color); margin-right: 6px;
  }
  .chip {
    font: 600 14px/1.2 var(--ha-font-family-body, sans-serif); padding: 8px 12px;
    border-radius: 999px; border: 0; background: #FBF8F2; color: #0F221B;
    cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .5);
  }
  .chip:focus-visible { outline: 3px solid #F2C230; outline-offset: 2px; }
  .chip.dragging { position: fixed; z-index: 9999; cursor: grabbing; pointer-events: none; opacity: .9; }
`;

class TravelmapCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  setConfig(config) {
    this._config = { ...(config || {}) };
    this._render();
  }

  connectedCallback() {
    this._render();
    this._loadForm();
  }

  async _loadForm() {
    // ha-form is part of Home Assistant but only loaded once an editor that
    // uses it has been opened. Opening the editor of a built-in card does so.
    if (customElements.get("ha-form")) return;
    try {
      const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : undefined;
      if (helpers) {
        await helpers.createCardElement({ type: "tile", entity: "sun.sun" });
        const card = customElements.get("hui-tile-card");
        if (card && card.getConfigElement) await card.getConfigElement();
      }
    } catch (err) {
      // The form then appears as soon as Home Assistant has loaded it itself.
    }
  }

  _text() {
    return TEXT[languageOf(this._hass || globalHass())];
  }

  _position(key) {
    const value = this._config[key];
    return POSITIONS.includes(value) ? value : DEFAULTS[key];
  }

  _change(config) {
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
    );
    this._render();
  }

  _formChanged(value) {
    // The form shows the defaults too; only what differs from them, or was
    // already in the configuration, is written.
    const config = { type: this._config.type };
    const fields = new Set(TravelmapCard.formSchema().schema.map((field) => field.name));
    for (const [key, entry] of Object.entries(this._config)) {
      // A field that was emptied in the form is gone; other keys stay.
      if (!fields.has(key)) config[key] = entry;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key === "type") continue;
      if (entry === undefined || entry === null || entry === "") continue;
      if (entry === DEFAULTS[key] && !(key in this._config)) continue;
      config[key] = entry;
    }
    this._change(config);
  }

  _setPosition(key, position) {
    if (this._position(key) === position) return;
    this._change({ ...this._config, [key]: position });
  }

  _build() {
    const style = document.createElement("style");
    style.textContent = EDITOR_STYLE;
    this._form = document.createElement("ha-form");
    this._form.addEventListener("value-changed", (event) => {
      event.stopPropagation();
      this._formChanged(event.detail.value);
    });
    this._labels = document.createElement("div");
    this._labels.className = "labels";
    this._heading = document.createElement("h3");
    this._help = document.createElement("p");
    this._photo = document.createElement("div");
    this._photo.className = "photo";
    this._zones = new Map();
    for (const position of POSITIONS.filter((p) => p !== "none")) {
      const zone = document.createElement("div");
      zone.className = "zone";
      zone.dataset.zone = position;
      this._zones.set(position, zone);
      this._photo.appendChild(zone);
    }
    const tray = document.createElement("div");
    tray.className = "zone tray";
    tray.dataset.zone = "none";
    this._zones.set("none", tray);
    this._chips = {};
    for (const key of ["name_position", "year_position"]) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.key = key;
      chip.addEventListener("pointerdown", (event) => this._dragStart(event, chip));
      chip.addEventListener("keydown", (event) => this._chipKey(event, key));
      this._chips[key] = chip;
    }
    this._labels.append(this._heading, this._help, this._photo, tray);
    this.shadowRoot.append(style, this._form, this._labels);
    this._built = true;
  }

  _render() {
    if (!this.isConnected) return;
    if (!this._built) this._build();
    const text = this._text();
    const form = TravelmapCard.formSchema();
    this._form.hass = this._hass;
    this._form.schema = form.schema;
    this._form.computeLabel = (schema) => text[`form_${schema.name}`];
    this._form.data = { ...DEFAULTS, ...this._config };
    this._heading.textContent = text.editor_labels;
    this._help.textContent = text.editor_labels_help;
    this._zones.get("none").dataset.title = text.editor_hidden;
    for (const [position, zone] of this._zones) {
      zone.setAttribute("aria-label", text[`position_${position}`]);
    }
    for (const [key, chip] of Object.entries(this._chips)) {
      if (chip.classList.contains("dragging")) continue;
      const position = this._position(key);
      const label = key === "name_position" ? text.editor_name : text.editor_year;
      chip.textContent = label;
      chip.setAttribute("aria-label", `${label}: ${text[`position_${position}`]}`);
      const zone = this._zones.get(position);
      if (chip.parentElement !== zone) {
        const focused = this.shadowRoot.activeElement === chip;
        zone.appendChild(chip);
        if (focused) chip.focus();
      }
    }
  }

  _zoneAt(x, y) {
    for (const [position, zone] of this._zones) {
      const box = zone.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return position;
    }
    // Inside the photo but between two spots: the nearest spot.
    const photo = this._photo.getBoundingClientRect();
    if (x < photo.left || x > photo.right || y < photo.top || y > photo.bottom) return undefined;
    const edge = y < photo.top + photo.height / 2 ? "top" : "bottom";
    const third = (x - photo.left) / photo.width;
    const side = third < 1 / 3 ? "left" : third < 2 / 3 ? "center" : "right";
    return `${edge}-${side}`;
  }

  _dragStart(event, chip) {
    if (event.button !== undefined && event.button > 0) return;
    event.preventDefault();
    chip.focus();
    const box = chip.getBoundingClientRect();
    const offset = { x: event.clientX - box.left, y: event.clientY - box.top };
    let moved = false;
    const move = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - event.clientX, ev.clientY - event.clientY) < 4) return;
        moved = true;
        chip.classList.add("dragging");
        chip.style.width = `${box.width}px`;
      }
      chip.style.left = `${ev.clientX - offset.x}px`;
      chip.style.top = `${ev.clientY - offset.y}px`;
      const over = this._zoneAt(ev.clientX, ev.clientY);
      for (const [position, zone] of this._zones) zone.classList.toggle("over", position === over);
    };
    const end = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      for (const zone of this._zones.values()) zone.classList.remove("over");
      chip.classList.remove("dragging");
      chip.style.left = chip.style.top = chip.style.width = "";
      const target = moved && ev.type === "pointerup" ? this._zoneAt(ev.clientX, ev.clientY) : undefined;
      if (target) this._setPosition(chip.dataset.key, target);
      else this._render();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  _chipKey(event, key) {
    const current = this._position(key);
    const sides = ["left", "center", "right"];
    const [edge, side] = current === "none" ? ["none", "center"] : current.split("-");
    let next;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (edge === "none") return;
      const step = event.key === "ArrowLeft" ? -1 : 1;
      const index = Math.min(Math.max(sides.indexOf(side) + step, 0), 2);
      next = `${edge}-${sides[index]}`;
    } else if (event.key === "ArrowUp") {
      next = edge === "none" ? "bottom-center" : `top-${side}`;
    } else if (event.key === "ArrowDown") {
      next = edge === "top" ? `bottom-${side}` : "none";
    } else {
      return;
    }
    event.preventDefault();
    this._setPosition(key, next);
  }
}

if (!customElements.get("travelmap-card-editor")) {
  customElements.define("travelmap-card-editor", TravelmapCardEditor);
}

if (!customElements.get("travelmap-card")) {
  customElements.define("travelmap-card", TravelmapCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "travelmap-card")) {
  const text = TEXT[languageOf(globalHass())];
  window.customCards.push({
    type: "travelmap-card",
    name: text.name,
    description: text.description,
    preview: false,
    documentationURL: "https://github.com/Meppies/ha-travelmap",
  });
}
console.info(`%c travelmap-card %c ${VERSION} `, "background:#0f221b;color:#fbf8f2", "");

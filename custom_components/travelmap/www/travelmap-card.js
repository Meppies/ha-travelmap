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
 *   route_color: "#e87722"
 *   name_position: top-center   # where on the photo the place name goes, or none
 *   year_position: top-right    # where on the photo the year of the trip goes, or none
 *   marker_size: 14         # diameter of a marker in pixels
 *   show_numbers: false     # number the markers in order of travel
 *   route_line: false       # line between the places
 *   photo_line: false       # line between a photo and its marker
 */

const VERSION = "0.7.0";

const DEFAULTS = {
  entry: undefined,
  trip: undefined,
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
  route_color: undefined,
  name_position: "top-center",
  year_position: "top-right",
  marker_size: 14,
  show_numbers: false,
  route_line: false,
  photo_line: false,
};

const ALL_TRIPS = "__all__";
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
const WORLD_BOUNDS = [
  [-56, -168],
  [74, 178],
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
    form_place_zoom: "Zoom level when flying to each place",
    form_fly_seconds: "Duration of the flight between two places, in seconds",
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
    form_place_zoom: "Zoomniveau bij naar elke plek vliegen",
    form_fly_seconds: "Duur van de vlucht tussen twee plekken, in seconden",
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

  static getConfigForm() {
    const text = TEXT[languageOf(globalHass())];
    return {
      schema: [
        { name: "trip", selector: { text: {} } },
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
        { name: "photo_seconds", selector: { number: { min: 1, max: 120, mode: "box" } } },
        { name: "video_seconds", selector: { number: { min: 1, max: 600, mode: "box" } } },
        { name: "place_zoom", selector: { number: { min: 3, max: 18, mode: "slider" } } },
        {
          name: "fly_seconds",
          selector: { number: { min: 1, max: 30, mode: "slider", unit_of_measurement: "s" } },
        },
        ...["name_position", "year_position"].map((name) => ({
          name,
          selector: {
            select: {
              mode: "dropdown",
              options: POSITIONS.map((value) => ({ value, label: text[`position_${value}`] })),
            },
          },
        })),
        {
          name: "marker_size",
          selector: { number: { min: 6, max: 40, mode: "slider", unit_of_measurement: "px" } },
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
    this._tripId = undefined;
    this._places = [];
    this._markers = new Map();
    this._activePlaceId = undefined;
    this._playing = false;
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
    if (!PROJECTIONS.includes(merged.projection)) {
      throw new Error("projection must be flat or globe");
    }
    const previous = this._config;
    this._config = merged;
    if (!this._built) return;
    this._frame.style.height = merged.height;
    if (previous.trip !== merged.trip || previous.entry !== merged.entry) {
      this._selectInitialTrip();
    } else if (
      previous.route_color !== merged.route_color ||
      previous.marker_size !== merged.marker_size ||
      previous.show_numbers !== merged.show_numbers ||
      previous.route_line !== merged.route_line ||
      previous.view !== merged.view ||
      previous.projection !== merged.projection ||
      previous.max_zoom !== merged.max_zoom
    ) {
      this._stop();
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
    for (const trip of this._trips) {
      const option = document.createElement("option");
      option.value = trip.id;
      option.textContent = trip.title || trip.id;
      this._select.appendChild(option);
    }
    this._select.hidden = this._trips.length < 2;
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
    // Without a wish, every trip is on the map at once.
    this._tripId = found ? found.id : this._trips.length > 1 ? ALL_TRIPS : this._trips[0].id;
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

  _shownTrips() {
    return this._tripId === ALL_TRIPS ? this._trips : this._trips.filter((t) => t.id === this._tripId);
  }

  _playablePlaces() {
    // A place is playable when it has a position. Its key, trip folder plus
    // place folder, is its identity; the same place name may occur in two trips.
    return this._shownTrips().flatMap((trip) =>
      trip.places
        .filter((place) => place.latitude !== null && place.longitude !== null)
        .map((place) => ({ ...place, key: `${trip.id}/${place.id}`, trip }))
    );
  }

  // ----- Map --------------------------------------------------------------

  _routeColor() {
    if (this._config.route_color) return this._config.route_color;
    const accent = getComputedStyle(this).getPropertyValue("--accent-color").trim();
    return accent || "#e87722";
  }

  _markerSize() {
    return Math.min(Math.max(this._number("marker_size"), 6), 40);
  }

  _markerElement(number) {
    // The map positions the outer element with its own transform, so all
    // styling, and the scale of the active marker, goes on the inner one.
    const size = this._markerSize();
    const numbered = this._config.show_numbers === true && size >= 18;
    const element = document.createElement("div");
    element.style.cssText = `width:${size}px;height:${size}px;cursor:pointer`;
    const dot = document.createElement("div");
    if (numbered) dot.textContent = String(number);
    dot.style.cssText = [
      "width:100%", "height:100%", "box-sizing:border-box", "border-radius:50%",
      "display:flex", "align-items:center", "justify-content:center",
      `font:600 ${Math.round(size * 0.47)}px/1 sans-serif`,
      "box-shadow:0 1px 4px rgba(0,0,0,.5)", "transition:transform .3s ease",
    ].join(";");
    element.appendChild(dot);
    return element;
  }

  _styleMarker(element, active) {
    const color = this._routeColor();
    const dot = element.firstElementChild;
    dot.style.background = active ? color : "#fff";
    dot.style.color = active ? "#fff" : "#111";
    const border = Math.max(2, Math.round(this._markerSize() / 8));
    dot.style.border = `${border}px solid ${active ? "#fff" : color}`;
    dot.style.transform = active ? "scale(1.5)" : "scale(1)";
    // Places close together overlap in the overview; the active one goes on top.
    element.style.zIndex = active ? "5" : "";
  }

  _drawTrip(fit) {
    const trips = this._shownTrips();
    if (trips.length === 0 || !this._map) return;
    this._places = this._playablePlaces();
    this._activePlaceId = undefined;
    this._markers = new Map();
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
    const world = this._config.view === "world";
    if (!world && this._places.length === 0) return;
    const points = world
      ? WORLD_BOUNDS
      : this._places.map((place) => [place.latitude, place.longitude]);
    const zoom = world ? 6 : this._number("max_zoom");
    const pad = world ? 0 : 0.3;
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

  async _flyTo(place) {
    // One long, eased flight from where the map is to the place. The map's
    // own fit flies at a fixed speed and jumps when the device asks for
    // reduced motion, so the flight is driven on the map engine, with a set
    // duration.
    const seconds = Math.min(Math.max(this._number("fly_seconds"), 1), 30);
    const gl = this._engineMap();
    if (gl) {
      try {
        gl.stop();
        const arrived = new Promise((resolve) => gl.once("moveend", resolve));
        gl.flyTo({
          center: [place.longitude, place.latitude],
          zoom: this._number("place_zoom") - ENGINE_ZOOM_OFFSET,
          duration: seconds * 1000,
          curve: 1.2,
          essential: true,
          // Slow start, slow arrival.
          easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
        });
        await Promise.race([arrived, this._sleep(seconds * 1000 + 1500)]);
        return;
      } catch (err) {
        // Fall through to the map's own flight.
      }
    }
    this._map.fitBounds([[place.latitude, place.longitude]], {
      zoom: this._number("place_zoom"),
      fly: true,
    });
    await this._sleep(FLY_MS);
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
      gl.on("styledata", () => this._applyProjection());
    }
    apply();
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
      if (!trip && this._tripId !== ALL_TRIPS) {
        this._placeEl.textContent = "";
        this._subEl.textContent = "";
        return;
      }
      const country = trip && trip.country ? ` · ${trip.country}` : "";
      this._placeEl.textContent = trip ? trip.title || trip.id : this._t("all_trips");
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
      await this._playPlace(generation, place);
      if (!this._alive(generation)) return;
      index = (index + 1) % this._places.length;
      if (index === 0) await this._refresh(generation);
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

  async _playPlace(generation, place) {
    this._setActive(place.key);
    this._showCaption(place);
    if (this._config.view === "place") {
      await this._flyTo(place);
      if (!this._alive(generation)) return;
      // A moment to take in where the map has arrived.
      await this._sleep(700);
    } else {
      await this._sleep(500);
    }
    const media = place.media || [];
    if (media.length === 0) {
      await this._sleep(2000);
      return;
    }
    for (let i = 0; i < media.length; i += 1) {
      if (!this._alive(generation)) return;
      this._showCaption(place, media[i], i, media.length);
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
    const match = /(\d{4})/.exec(String((trip && (trip.start || trip.finish || trip.id)) || ""));
    return match ? match[1] : "";
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

  async _showMedia(generation, place, item) {
    let element;
    let seconds;
    let ratio;
    try {
      const url = await this._signedUrl(item.url);
      if (!this._alive(generation)) return;
      if (item.type === "video") {
        element = document.createElement("video");
        element.muted = true;
        element.playsInline = true;
        element.preload = "auto";
        element.src = url;
        await new Promise((resolve, reject) => {
          element.addEventListener("loadeddata", resolve, { once: true });
          element.addEventListener("error", () => reject(new Error("video")), { once: true });
        });
        const limit = this._number("video_seconds");
        seconds = Number.isFinite(element.duration) ? Math.min(element.duration, limit) : limit;
        ratio = element.videoWidth / element.videoHeight;
      } else {
        element = document.createElement("img");
        element.alt = "";
        element.decoding = "async";
        element.src = url;
        await element.decode();
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

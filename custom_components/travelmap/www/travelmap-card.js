/**
 * Travel map card for Home Assistant.
 *
 * Shows the trips of the Travel map integration on Home Assistant's own map
 * (<ha-map>): one numbered marker per place and a route line between the
 * places. The map fills the card; during playback each photo and video grows
 * out of the marker of its place and goes back into it.
 *
 *   type: custom:travelmap-card
 *   trip: 2026-japan        # optional, folder name of the trip to start with
 *   height: 70vh            # optional, any CSS length
 *   view: world             # world | trip | place: what the map shows while playing
 *   projection: flat        # flat | globe
 *   max_zoom: 6             # closest zoom for the trip view
 *   photo_size: 70          # size of a photo, as a percentage of the card
 *   autoplay: false
 *   photo_seconds: 6
 *   video_seconds: 15
 *   place_zoom: 12          # zoom level for view: place
 *   route_color: "#e87722"
 */

const VERSION = "0.3.0";

const DEFAULTS = {
  entry: undefined,
  trip: undefined,
  height: "70vh",
  view: "world",
  projection: "flat",
  max_zoom: 6,
  photo_size: 70,
  autoplay: false,
  photo_seconds: 6,
  video_seconds: 15,
  place_zoom: 12,
  route_color: undefined,
};

const VIEWS = ["world", "trip", "place"];
const PROJECTIONS = ["flat", "globe"];
// The inhabited world, corner to corner: what the world view fits.
const WORLD_BOUNDS = [
  [-56, -168],
  [74, 178],
];
const FLY_MS = 2600;
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
    form_trip: "Trip to start with (folder name)",
    form_height: "Height (CSS length, for example 70vh)",
    form_view: "What the map shows while playing",
    form_projection: "Shape of the map when zoomed out",
    projection_flat: "Flat map",
    projection_globe: "Globe",
    form_max_zoom: "Closest zoom for the whole trip",
    form_photo_size: "Photo size, as a percentage of the card",
    form_autoplay: "Start playing right away",
    form_photo_seconds: "Seconds per photo",
    form_video_seconds: "Longest time per video, in seconds",
    form_place_zoom: "Zoom level when flying to each place",
    form_route_color: "Route colour",
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
    form_trip: "Reis om mee te beginnen (mapnaam)",
    form_height: "Hoogte (CSS-lengte, bijvoorbeeld 70vh)",
    form_view: "Wat de kaart toont tijdens het afspelen",
    form_projection: "Vorm van de kaart bij uitzoomen",
    projection_flat: "Platte kaart",
    projection_globe: "Wereldbol",
    form_max_zoom: "Dichtste zoom voor de hele reis",
    form_photo_size: "Fotogrootte, als percentage van de kaart",
    form_autoplay: "Meteen afspelen",
    form_photo_seconds: "Seconden per foto",
    form_video_seconds: "Langste tijd per video, in seconden",
    form_place_zoom: "Zoomniveau bij naar elke plek vliegen",
    form_route_color: "Kleur van de route",
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
        { name: "photo_size", selector: { number: { min: 30, max: 95, mode: "slider" } } },
        { name: "autoplay", selector: { boolean: {} } },
        { name: "photo_seconds", selector: { number: { min: 1, max: 120, mode: "box" } } },
        { name: "video_seconds", selector: { number: { min: 1, max: 600, mode: "box" } } },
        { name: "place_zoom", selector: { number: { min: 3, max: 18, mode: "slider" } } },
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
    this._tripId = (found || this._trips[0]).id;
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
    return this._trips.find((trip) => trip.id === this._tripId);
  }

  // ----- Map --------------------------------------------------------------

  _routeColor() {
    if (this._config.route_color) return this._config.route_color;
    const accent = getComputedStyle(this).getPropertyValue("--accent-color").trim();
    return accent || "#e87722";
  }

  _markerElement(number) {
    // The map positions the outer element with its own transform, so all
    // styling, and the scale of the active marker, goes on the inner one.
    const element = document.createElement("div");
    element.style.cssText = "width:30px;height:30px;cursor:pointer";
    const dot = document.createElement("div");
    dot.textContent = String(number);
    dot.style.cssText = [
      "width:100%", "height:100%", "box-sizing:border-box", "border-radius:50%",
      "display:flex", "align-items:center", "justify-content:center",
      "font:600 14px/1 sans-serif",
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
    dot.style.border = `3px solid ${active ? "#fff" : color}`;
    dot.style.transform = active ? "scale(1.3)" : "scale(1)";
    // Places close together overlap in the overview; the active one goes on top.
    element.style.zIndex = active ? "5" : "";
  }

  _drawTrip(fit) {
    const trip = this._trip();
    if (!trip || !this._map) return;
    // A place is playable when it has a position; its number is its position
    // among the playable places, and the place id stays its identity.
    this._places = trip.places.filter(
      (place) => place.latitude !== null && place.longitude !== null
    );
    this._activePlaceId = undefined;
    this._markers = new Map();
    this._map.zoom = this._number("max_zoom");

    this._map.editableLocations = this._places.map((place, index) => {
      const element = this._markerElement(index + 1);
      this._styleMarker(element, false);
      this._markers.set(place.id, element);
      return {
        id: place.id,
        location: [place.latitude, place.longitude],
        element,
        elementSize: [30, 30],
        title: `${index + 1}. ${place.name}`,
        activatable: true,
      };
    });

    const stamp = trip.start ? new Date(trip.start) : new Date();
    this._map.paths =
      this._places.length > 1
        ? [
            {
              points: this._places.map((place) => ({
                point: [place.latitude, place.longitude],
                timestamp: stamp,
              })),
              color: this._routeColor(),
              name: trip.title,
              fullDatetime: true,
            },
          ]
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
    if (this._config.view === "world") {
      this._map.fitBounds(WORLD_BOUNDS, { zoom: 6, pad: 0, fly });
      return;
    }
    if (this._places.length === 0) return;
    const points = this._places.map((place) => [place.latitude, place.longitude]);
    this._map.fitBounds(points, { zoom: this._number("max_zoom"), pad: 0.3, fly });
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

  _flyTo(place) {
    this._map.fitBounds([[place.latitude, place.longitude]], {
      zoom: this._number("place_zoom"),
      fly: true,
    });
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
    const trip = this._trip();
    if (!trip) {
      this._placeEl.textContent = "";
      this._subEl.textContent = "";
      return;
    }
    const country = trip.country ? ` · ${trip.country}` : "";
    if (!place) {
      this._placeEl.textContent = trip.title || trip.id;
      const hint = this._places.length ? ` · ${this._t("press_play")}` : "";
      this._subEl.textContent = `${this._places.length} ${this._t("places")}${country}${hint}`;
      return;
    }
    const number = this._places.findIndex((candidate) => candidate.id === place.id) + 1;
    this._placeEl.textContent = `${number}. ${place.name}`;
    const count = item ? ` · ${index + 1}/${total}` : "";
    this._subEl.textContent = `${trip.title || trip.id}${country}${count}`;
  }

  // ----- Playback ---------------------------------------------------------

  _toggle() {
    if (this._playing) {
      this._stop();
      this._fitTrip(this._config.view === "place");
      this._showCaption();
      return;
    }
    const start = this._places.findIndex((place) => place.id === this._activePlaceId);
    this._play(Math.max(start, 0));
  }

  _startAt(placeId) {
    const index = this._places.findIndex((place) => place.id === placeId);
    if (index >= 0) this._play(index);
  }

  _stop() {
    this._generation += 1;
    this._playing = false;
    if (this._wake) this._wake();
    if (!this._built) return;
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
    const trip = this._trip();
    if (!trip) return;
    const places = trip.places.filter(
      (place) => place.latitude !== null && place.longitude !== null
    );
    const same =
      places.length === this._places.length &&
      places.every(
        (place, i) =>
          place.id === this._places[i].id &&
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
    this._setActive(place.id);
    this._showCaption(place);
    if (this._config.view === "place") {
      this._flyTo(place);
      await this._sleep(FLY_MS);
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

  _placePhoto(card, point, ratio) {
    // As large as the setting allows, beside the marker where there is room,
    // so the place stays visible next to its photo.
    const size = Math.min(Math.max(this._number("photo_size"), 30), 95) / 100;
    const margin = 16;
    const top = 64;
    const bottom = 84;
    const gap = 48;
    let maxWidth = Math.max(point.width * size, 120);
    // Keep the marker in view when the larger side has room for a decent photo.
    const beside = Math.max(point.x, point.width - point.x) - gap - margin;
    if (beside >= point.width * 0.4) maxWidth = Math.min(maxWidth, beside);
    const maxHeight = Math.max((point.height - top - bottom) * Math.min(size + 0.15, 1), 90);
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

    const point = this._markerPoint(place.id);
    const card = document.createElement("div");
    card.className = "photo";
    card.appendChild(element);
    const edge = this._placePhoto(card, point, ratio);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", point.x);
    line.setAttribute("y1", point.y);
    line.setAttribute("x2", edge.x);
    line.setAttribute("y2", edge.y);
    line.setAttribute("stroke", this._routeColor());

    const oldCards = Array.from(this._stage.querySelectorAll(".photo"));
    const oldLines = Array.from(this._svg.querySelectorAll("line"));
    this._svg.appendChild(line);
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

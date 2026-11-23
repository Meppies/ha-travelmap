/**
 * Travel map card for Home Assistant.
 *
 * Shows the trips of the Travel map integration on Home Assistant's own map
 * (<ha-map>): one numbered marker per place, a route line between the places
 * and a playback mode that flies from place to place and shows the photos and
 * videos of each place.
 *
 *   type: custom:travelmap-card
 *   trip: 2026-japan        # optional, folder name of the trip to start with
 *   height: 70vh            # optional, any CSS length
 *   layout: auto            # auto | split | overlay
 *   autoplay: false
 *   photo_seconds: 6
 *   video_seconds: 15
 *   place_zoom: 12
 *   route_color: "#e87722"
 */

const VERSION = "0.1.1";

const DEFAULTS = {
  entry: undefined,
  trip: undefined,
  height: "70vh",
  layout: "auto",
  autoplay: false,
  photo_seconds: 6,
  video_seconds: 15,
  place_zoom: 12,
  route_color: undefined,
};

const SPLIT_MIN_WIDTH = 800;
const FLY_MS = 2600;
const FADE_MS = 700;
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
    form_layout: "Layout",
    form_autoplay: "Start playing right away",
    form_photo_seconds: "Seconds per photo",
    form_video_seconds: "Longest time per video, in seconds",
    form_place_zoom: "Zoom level at a place",
    form_route_color: "Route colour",
    layout_auto: "Automatic",
    layout_split: "Map and photo side by side",
    layout_overlay: "Photo over the map",
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
    form_layout: "Indeling",
    form_autoplay: "Meteen afspelen",
    form_photo_seconds: "Seconden per foto",
    form_video_seconds: "Langste tijd per video, in seconden",
    form_place_zoom: "Zoomniveau bij een plek",
    form_route_color: "Kleur van de route",
    layout_auto: "Automatisch",
    layout_split: "Kaart en foto naast elkaar",
    layout_overlay: "Foto over de kaart",
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
    display: flex;
    overflow: hidden;
    background: #111;
    color: #fff;
  }
  .frame:fullscreen { height: 100vh !important; }
  .map { position: relative; flex: 1 1 auto; min-width: 0; }
  ha-map { position: absolute; inset: 0; width: 100%; height: 100%; }
  .media {
    position: relative;
    flex: 0 0 0;
    overflow: hidden;
    background: #000;
    transition: flex-basis 0.5s ease;
  }
  .frame.split.playing .media { flex-basis: 60%; }
  .frame.overlay .media {
    position: absolute; inset: 0; z-index: 5;
    opacity: 0; pointer-events: none;
    transition: opacity ${FADE_MS}ms ease;
  }
  .frame.overlay.showing .media { opacity: 1; }
  .media img, .media video {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain; opacity: 0;
    transition: opacity ${FADE_MS}ms ease;
  }
  .media .show { opacity: 1; }
  @keyframes travelmap-drift-a {
    from { transform: scale(1); } to { transform: scale(1.08) translate(-1%, 1%); }
  }
  @keyframes travelmap-drift-b {
    from { transform: scale(1.08) translate(1%, -1%); } to { transform: scale(1); }
  }
  .drift-a { animation: travelmap-drift-a var(--drift-ms, 7000ms) linear forwards; }
  .drift-b { animation: travelmap-drift-b var(--drift-ms, 7000ms) linear forwards; }
  @media (prefers-reduced-motion: reduce) {
    .drift-a, .drift-b { animation: none; }
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
          name: "layout",
          selector: {
            select: {
              mode: "dropdown",
              options: ["auto", "split", "overlay"].map((value) => ({
                value,
                label: text[`layout_${value}`],
              })),
            },
          },
        },
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
    if (!["auto", "split", "overlay"].includes(merged.layout)) {
      throw new Error("layout must be auto, split or overlay");
    }
    const previous = this._config;
    this._config = merged;
    if (!this._built) return;
    this._frame.style.height = merged.height;
    this._applyLayout();
    if (previous.trip !== merged.trip || previous.entry !== merged.entry) {
      this._selectInitialTrip();
    } else if (
      previous.route_color !== merged.route_color ||
      previous.place_zoom !== merged.place_zoom
    ) {
      this._drawTrip(false);
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
  }

  disconnectedCallback() {
    this._stop();
    clearTimeout(this._retryTimer);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._resizeObserver = undefined;
  }

  _t(key) {
    return TEXT[this._language][key] || TEXT.en[key] || key;
  }

  _build() {
    if (this._built) {
      this._observeSize();
      return;
    }
    this._built = true;
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="frame overlay">
          <div class="map"></div>
          <div class="media" aria-live="off"></div>
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
    this._media = root.querySelector(".media");
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
    this._observeSize();
  }

  _observeSize() {
    if (this._resizeObserver || typeof ResizeObserver === "undefined") return;
    this._resizeObserver = new ResizeObserver(() => this._applyLayout());
    this._resizeObserver.observe(this._frame);
  }

  _applyLayout() {
    const wanted = this._config.layout;
    const split =
      wanted === "split" || (wanted === "auto" && this._frame.clientWidth >= SPLIT_MIN_WIDTH);
    this._frame.classList.toggle("split", split);
    this._frame.classList.toggle("overlay", !split);
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
    const element = document.createElement("div");
    element.textContent = String(number);
    element.style.cssText = [
      "width:30px", "height:30px", "box-sizing:border-box", "border-radius:50%",
      "display:flex", "align-items:center", "justify-content:center",
      "font:600 14px/1 sans-serif", "cursor:pointer",
      "box-shadow:0 1px 4px rgba(0,0,0,.5)", "transition:transform .3s ease",
    ].join(";");
    return element;
  }

  _styleMarker(element, active) {
    const color = this._routeColor();
    element.style.background = active ? color : "#fff";
    element.style.color = active ? "#fff" : "#111";
    element.style.border = `3px solid ${active ? "#fff" : color}`;
    element.style.transform = active ? "scale(1.25)" : "scale(1)";
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
    this._map.zoom = Number(this._config.place_zoom) || DEFAULTS.place_zoom;

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

  _fitTrip(fly) {
    if (!this._map || this._places.length === 0) return;
    const points = this._places.map((place) => [place.latitude, place.longitude]);
    this._map.fitBounds(points, { zoom: 14, pad: 0.25, fly });
  }

  _flyTo(place) {
    this._map.fitBounds([[place.latitude, place.longitude]], {
      zoom: Number(this._config.place_zoom) || DEFAULTS.place_zoom,
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
      this._fitTrip(true);
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
    this._frame.classList.remove("playing", "showing");
    this._clearMedia();
    this._setActive(undefined);
    this._updatePlayButton();
  }

  async _play(startIndex) {
    if (this._places.length === 0) return;
    this._generation += 1;
    if (this._wake) this._wake();
    const generation = this._generation;
    this._playing = true;
    this._frame.classList.add("playing");
    this._updatePlayButton();
    this._pointerActive();

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
    this._frame.classList.remove("showing");
    this._flyTo(place);
    await this._sleep(FLY_MS);
    const media = place.media || [];
    if (media.length === 0) {
      await this._sleep(2000);
      return;
    }
    for (let i = 0; i < media.length; i += 1) {
      if (!this._alive(generation)) return;
      this._showCaption(place, media[i], i, media.length);
      await this._showMedia(generation, media[i]);
    }
    if (!this._alive(generation)) return;
    this._frame.classList.remove("showing");
    if (this._frame.classList.contains("overlay")) {
      await this._sleep(FADE_MS);
      this._clearMedia();
    }
  }

  async _signedUrl(path) {
    const signed = await this._hass.callWS({
      type: "auth/sign_path",
      path,
      expires: SIGN_EXPIRES_SECONDS,
    });
    return this._hass.hassUrl ? this._hass.hassUrl(signed.path) : signed.path;
  }

  async _showMedia(generation, item) {
    let element;
    let seconds;
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
        const limit = Number(this._config.video_seconds) || DEFAULTS.video_seconds;
        seconds = Number.isFinite(element.duration) ? Math.min(element.duration, limit) : limit;
      } else {
        element = document.createElement("img");
        element.alt = "";
        element.decoding = "async";
        element.src = url;
        await element.decode();
        seconds = Number(this._config.photo_seconds) || DEFAULTS.photo_seconds;
        element.className = Math.random() < 0.5 ? "drift-a" : "drift-b";
        element.style.setProperty("--drift-ms", `${seconds * 1000 + FADE_MS * 2}ms`);
      }
    } catch (err) {
      // A file that cannot be shown is skipped; the rest of the place plays on.
      return;
    }
    if (!this._alive(generation)) return;

    const previous = Array.from(this._media.children);
    this._media.appendChild(element);
    // Force a style pass so the fade starts from transparent.
    void element.offsetWidth;
    element.classList.add("show");
    this._frame.classList.add("showing");
    if (item.type === "video") element.play().catch(() => undefined);
    for (const old of previous) old.classList.remove("show");
    setTimeout(() => previous.forEach((old) => old.remove()), FADE_MS + 100);

    await this._sleep(seconds * 1000);
  }

  _clearMedia() {
    if (this._media) this._media.replaceChildren();
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

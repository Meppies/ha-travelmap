/**
 * Management panel of the Travel map integration.
 *
 * Shows the trip folders and their place folders, and lets an administrator
 * set title, country, year and zoom of a trip, and the name and position of a
 * place. Everything is saved in the trip.yaml of the trip folder, through the
 * integration.
 */

const TEXT = {
  en: {
    heading: "Travel map",
    intro: "Your trip folders and the places in them. Choose one to edit it.",
    loading: "Loading…",
    no_integration: "The Travel map integration is not set up.",
    no_trips: "No trip folders found. Add a folder per trip to the folder of the integration.",
    no_folder: "The folder {path} is not available yet.",
    places: "places",
    place_one: "place",
    has_position: "has a position",
    no_position: "no position yet",
    trip: "Trip",
    place: "Place",
    folder: "Folder",
    title: "Title",
    title_help: "Shown on the map. Empty uses the folder name.",
    country: "Country",
    year: "Year",
    year_help: "Shown on the photos. Empty takes the year from the folder name, when it has one.",
    zoom: "Zoom level for this trip",
    zoom_help: "How far the map zooms in on the places of this trip. Empty uses the setting of the card.",
    zoom_default: "Card setting",
    name: "Name",
    name_help: "Shown on the map and on the photos. Empty uses the folder name.",
    position: "Position",
    position_help: "Click the map, drag the marker, or type the coordinates.",
    latitude: "Latitude",
    longitude: "Longitude",
    source: "Now from",
    source_exif: "the GPS data of a photo",
    source_yaml: "trip.yaml",
    save: "Save",
    saving: "Saving…",
    saved: "Saved in trip.yaml.",
    unsaved: "Not saved yet.",
    error_write_failed: "The file could not be written. The user of the network storage needs write access.",
    error_trip_file_invalid: "The existing trip.yaml is not valid YAML and was left alone. Correct or remove it first.",
    error_position: "Fill in both latitude and longitude, or neither.",
    error_other: "Saving failed",
    photos_here: "photos in this folder",
    refresh: "Refresh",
    refreshing: "Scanning the folders…",
    refreshed: "Scanned: {trips} trips, {photos} photos and videos.",
    move_up: "Move up",
    move_down: "Move down",
    order_help: "The arrows set the order of playing: of the trips, and of the places within a trip.",
    groups: "Groups",
    groups_help: "A group is your own selection of trips and places, in your own order. Choose it in the card to play only that.",
    new_group: "New group",
    group_name: "Name of the group",
    group_items: "In this group, in order of playing",
    group_empty: "Nothing in this group yet.",
    group_add: "Add a trip or a place",
    add: "Add",
    remove: "Remove",
    whole_trip: "whole trip",
    delete_group: "Delete group",
    delete_confirm: "Click again to delete",
    saved_group: "Group saved.",
    deleted_group: "Group deleted.",
    error_name: "Give the group a name.",
  },
  nl: {
    heading: "Reiskaart",
    intro: "Je reismappen en de plekken daarin. Kies er een om hem aan te passen.",
    loading: "Laden…",
    no_integration: "De integratie Reiskaart is niet ingesteld.",
    no_trips: "Geen reismappen gevonden. Zet per reis een map in de map van de integratie.",
    no_folder: "De map {path} is nog niet beschikbaar.",
    places: "plekken",
    place_one: "plek",
    has_position: "heeft een positie",
    no_position: "nog geen positie",
    trip: "Reis",
    place: "Plek",
    folder: "Map",
    title: "Titel",
    title_help: "Te zien op de kaart. Leeg gebruikt de mapnaam.",
    country: "Land",
    year: "Jaartal",
    year_help: "Te zien op de foto's. Leeg haalt het jaar uit de mapnaam, als dat erin staat.",
    zoom: "Zoomniveau voor deze reis",
    zoom_help: "Hoe ver de kaart inzoomt op de plekken van deze reis. Leeg gebruikt de instelling van de kaart.",
    zoom_default: "Instelling van de kaart",
    name: "Naam",
    name_help: "Te zien op de kaart en op de foto's. Leeg gebruikt de mapnaam.",
    position: "Positie",
    position_help: "Klik op de kaart, versleep de marker, of typ de coördinaten.",
    latitude: "Breedtegraad",
    longitude: "Lengtegraad",
    source: "Nu uit",
    source_exif: "de GPS-gegevens van een foto",
    source_yaml: "trip.yaml",
    save: "Opslaan",
    saving: "Opslaan…",
    saved: "Opgeslagen in trip.yaml.",
    unsaved: "Nog niet opgeslagen.",
    error_write_failed: "Het bestand kon niet worden geschreven. De gebruiker van de netwerkopslag heeft schrijfrechten nodig.",
    error_trip_file_invalid: "De bestaande trip.yaml is geen geldige YAML en is met rust gelaten. Herstel of verwijder hem eerst.",
    error_position: "Vul zowel breedte- als lengtegraad in, of geen van beide.",
    error_other: "Opslaan is mislukt",
    photos_here: "foto's in deze map",
    refresh: "Vernieuwen",
    refreshing: "De mappen worden gescand…",
    refreshed: "Gescand: {trips} reizen, {photos} foto's en video's.",
    move_up: "Omhoog",
    move_down: "Omlaag",
    order_help: "Met de pijlen bepaal je de afspeelvolgorde: van de reizen, en van de plekken binnen een reis.",
    groups: "Groepen",
    groups_help: "Een groep is je eigen selectie van reizen en plekken, in je eigen volgorde. Kies hem in de kaart om alleen die af te spelen.",
    new_group: "Nieuwe groep",
    group_name: "Naam van de groep",
    group_items: "In deze groep, in afspeelvolgorde",
    group_empty: "Nog niets in deze groep.",
    group_add: "Een reis of plek toevoegen",
    add: "Toevoegen",
    remove: "Verwijderen",
    whole_trip: "hele reis",
    delete_group: "Groep verwijderen",
    delete_confirm: "Klik nogmaals om te verwijderen",
    saved_group: "Groep opgeslagen.",
    deleted_group: "Groep verwijderd.",
    error_name: "Geef de groep een naam.",
  },
};

const ROOT_PLACE = "_";

const STYLE = `
  :host {
    display: block; height: 100%;
    background: var(--primary-background-color);
    color: var(--primary-text-color);
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, sans-serif));
    font-size: 16px; line-height: 1.5;
  }
  header {
    display: flex; align-items: center; gap: 8px;
    height: var(--header-height, 56px); padding: 0 12px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, #fff);
  }
  header h1 { font-size: 20px; font-weight: 400; margin: 0; flex: 1; }
  header button {
    font: inherit; font-weight: 600; padding: 8px 16px; border-radius: 999px; cursor: pointer;
    border: 2px solid currentColor; background: transparent; color: inherit;
  }
  header button:disabled { opacity: 0.5; cursor: default; }
  header button:focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }
  .notice { padding: 8px 16px 0; max-width: 1280px; margin: 0 auto; font-size: 15px; min-height: 1.5em; }
  .side { display: flex; flex-direction: column; gap: 16px; align-self: start; }
  h2.box-title { font-size: 17px; font-weight: 600; margin: 0 0 4px; }
  .layout {
    display: grid; grid-template-columns: minmax(260px, 340px) 1fr; gap: 16px;
    padding: 16px; max-width: 1280px; margin: 0 auto; box-sizing: border-box;
  }
  .scroll { height: calc(100% - var(--header-height, 56px)); overflow: auto; }
  @media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
  .box {
    background: var(--card-background-color); border-radius: 12px;
    border: 1px solid var(--divider-color); padding: 12px; align-self: start;
  }
  .intro, .help { color: var(--secondary-text-color); font-size: 15px; margin: 0 0 12px; }
  .tree { list-style: none; margin: 0; padding: 0; }
  .tree ul { list-style: none; margin: 0 0 6px; padding: 0 0 0 20px; }
  .line { display: flex; gap: 4px; align-items: center; }
  .pick {
    display: flex; flex: 1; min-width: 0; gap: 8px; align-items: baseline; text-align: left;
    font: inherit; color: inherit; background: none; border: 2px solid transparent;
    border-radius: 8px; padding: 8px 10px; cursor: pointer;
  }
  .pick:hover, .small:hover { background: var(--secondary-background-color); }
  .pick:focus-visible, .small:focus-visible { outline: 3px solid var(--primary-color); outline-offset: 1px; }
  .pick[aria-current="true"] {
    border-color: var(--primary-color); background: var(--secondary-background-color); font-weight: 600;
  }
  .small {
    flex: 0 0 36px; height: 36px; font: inherit; font-size: 18px; line-height: 1; color: inherit;
    background: none; border: 1px solid var(--divider-color); border-radius: 8px; cursor: pointer;
  }
  .small:disabled { opacity: 0.3; cursor: default; }
  .tree .trip > .line .label { font-weight: 600; }
  .items { list-style: none; margin: 0 0 16px; padding: 0; max-width: 520px; }
  .items li { display: flex; gap: 4px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--divider-color); }
  .items .label { flex: 1; overflow-wrap: anywhere; }
  .addrow { display: flex; gap: 8px; max-width: 520px; margin-bottom: 16px; }
  .addrow select {
    flex: 1; min-width: 0; font: inherit; color: inherit; padding: 10px 12px; border-radius: 8px;
    border: 1px solid var(--outline-color, var(--divider-color)); background: var(--secondary-background-color);
  }
  .addrow button, .actions .plain {
    font: inherit; font-weight: 600; padding: 10px 18px; border-radius: 999px; cursor: pointer;
    border: 2px solid var(--primary-color); background: transparent; color: var(--primary-color);
  }
  .wide { width: 100%; margin-top: 8px; }
  .tree .mark { flex: 0 0 1.2em; }
  .tree .label { flex: 1; overflow-wrap: anywhere; }
  .tree .meta { color: var(--secondary-text-color); font-size: 14px; white-space: nowrap; }
  form h2 { font-size: 22px; margin: 0 0 4px; font-weight: 600; overflow-wrap: anywhere; }
  form .path { font-family: var(--ha-font-family-code, monospace); font-size: 14px; color: var(--secondary-text-color); margin: 0 0 16px; }
  .field { margin: 0 0 16px; max-width: 520px; }
  .field label { display: block; font-weight: 600; margin-bottom: 4px; }
  .field input {
    font: inherit; color: inherit; width: 100%; box-sizing: border-box;
    padding: 10px 12px; border-radius: 8px;
    border: 1px solid var(--outline-color, var(--divider-color));
    background: var(--secondary-background-color);
  }
  .field input:focus-visible { outline: 3px solid var(--primary-color); outline-offset: 1px; }
  .field .hint { color: var(--secondary-text-color); font-size: 14px; margin-top: 4px; }
  .row { display: flex; gap: 12px; max-width: 520px; }
  .row .field { flex: 1; }
  .zoomrow { display: flex; gap: 12px; align-items: center; }
  .zoomrow input[type=range] { flex: 1; padding: 0; }
  .zoomrow output { min-width: 9em; font-size: 15px; }
  h3 { font-size: 17px; margin: 20px 0 4px; }
  ha-selector { display: block; max-width: 720px; margin-bottom: 12px; }
  .actions { display: flex; gap: 16px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  .actions button[type=submit] {
    font: inherit; font-weight: 600; padding: 10px 22px; border-radius: 999px; border: none; cursor: pointer;
    background: var(--primary-color); color: var(--text-primary-color, #fff);
  }
  .actions button:disabled { opacity: 0.5; cursor: default; }
  .actions button:focus-visible { outline: 3px solid var(--primary-text-color); outline-offset: 2px; }
  .status { font-size: 15px; }
  .status.error { font-weight: 600; }
  .empty { padding: 24px; }
`;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

class TravelmapPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._narrow = false;
    this._entries = [];
    this._selected = undefined;
    this._state = "new";
    this._status = { text: "", error: false };
    this._selectorReady = false;
    this._position = undefined;
    this._draft = undefined;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.hass = hass;
    const selector = this.shadowRoot.querySelector("ha-selector");
    if (selector) selector.hass = hass;
    if (first) this._start();
  }

  set narrow(narrow) {
    this._narrow = narrow;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.narrow = narrow;
  }

  set panel(_panel) {}

  set route(_route) {}

  _t(key) {
    const language = (this._hass && this._hass.locale && this._hass.locale.language) || "en";
    const table = language.toLowerCase().startsWith("nl") ? TEXT.nl : TEXT.en;
    return table[key] || TEXT.en[key] || key;
  }

  async _start() {
    this._state = "loading";
    this._render();
    this._loadSelector();
    try {
      const result = await this._hass.callWS({ type: "travelmap/library" });
      this._entries = result.entries || [];
      this._state = "ready";
    } catch (err) {
      this._state = "failed";
    }
    this._render();
  }

  async _loadSelector() {
    // The map picker is Home Assistant's own location selector. It is loaded
    // on demand elsewhere in the frontend, so ask for it; the coordinate
    // fields below work without it.
    const ready = () => !!customElements.get("ha-selector");
    const attempts = [
      async () => {
        const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : undefined;
        if (!helpers) return;
        await helpers.createCardElement({ type: "tile", entity: "sun.sun" });
        const card = customElements.get("hui-tile-card");
        if (card && card.getConfigElement) await card.getConfigElement();
      },
      async () => {
        await customElements.whenDefined("partial-panel-resolver");
        const resolver = document.createElement("partial-panel-resolver");
        resolver.hass = { panels: [{ url_path: "tmp", component_name: "config" }] };
        resolver._updateRoutes();
        await resolver.routerOptions.routes.tmp.load();
        await customElements.whenDefined("ha-panel-config");
        const config = document.createElement("ha-panel-config");
        await config.routerOptions.routes.automation.load();
      },
    ];
    for (const attempt of attempts) {
      if (ready()) break;
      try {
        await attempt();
      } catch (err) {
        // Try the next way.
      }
    }
    await Promise.race([
      customElements.whenDefined("ha-selector"),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
    if (ready() && !this._selectorReady) {
      this._selectorReady = true;
      this._renderEditor();
    }
  }

  // ----- Data ---------------------------------------------------------------

  _find() {
    if (!this._selected) return {};
    const entry = this._entries.find((e) => e.entry_id === this._selected.entry);
    const trip = entry && entry.trips.find((t) => t.id === this._selected.trip);
    const place =
      trip && this._selected.place !== undefined
        ? trip.places.find((p) => p.id === this._selected.place)
        : undefined;
    return { entry, trip, place };
  }

  _ownPlace(trip) {
    return trip.places.find((place) => place.id === ROOT_PLACE);
  }

  // ----- Rendering ----------------------------------------------------------

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>${STYLE}</style>
      <header>
        <ha-menu-button></ha-menu-button>
        <h1>${escapeHtml(this._t("heading"))}</h1>
        <button type="button" class="refresh">⟳ ${escapeHtml(this._t("refresh"))}</button>
      </header>
      <div class="scroll">
        <div class="notice" role="status" aria-live="polite"></div>
        <div class="layout">
          <div class="side">
            <div class="box"><p class="intro"></p><ul class="tree"></ul></div>
            <div class="box groups"></div>
          </div>
          <div class="box editor"></div>
        </div>
      </div>
    `;
    root.querySelector(".refresh").addEventListener("click", () => this._refresh());
    const menu = root.querySelector("ha-menu-button");
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    this._renderTree();
    this._renderGroups();
    this._renderEditor();
  }

  _notice(text) {
    const notice = this.shadowRoot.querySelector(".notice");
    if (notice) notice.textContent = text || "";
  }

  async _refresh() {
    // Scan the folders now, so new trips, places and photos show up.
    const button = this.shadowRoot.querySelector(".refresh");
    button.disabled = true;
    this._notice(this._t("refreshing"));
    try {
      const result = await this._hass.callWS({ type: "travelmap/rescan" });
      this._entries = result.entries || [];
      this._state = "ready";
      const trips = this._entries.flatMap((entry) => entry.trips);
      const photos = trips.reduce(
        (sum, trip) => sum + trip.places.reduce((n, place) => n + place.media.length, 0),
        0
      );
      this._draft = undefined;
      this._renderTree();
      this._renderGroups();
      this._renderEditor();
      this._notice(
        this._t("refreshed").replace("{trips}", trips.length).replace("{photos}", photos)
      );
    } catch (err) {
      this._notice(`▲ ${this._t("error_other")}: ${(err && err.message) || err}`);
    }
    button.disabled = false;
  }

  async _arrange(entry, fields) {
    // Order and groups are saved straight away; the answer is the new state.
    try {
      const result = await this._hass.callWS({ type: "travelmap/arrange", entry_id: entry.entry_id, ...fields });
      entry.trips = result.trips;
      entry.groups = result.groups;
      this._notice("");
      return true;
    } catch (err) {
      const known = err && TEXT.en[`error_${err.code}`] ? this._t(`error_${err.code}`) : undefined;
      this._notice(`▲ ${known || `${this._t("error_other")}: ${(err && err.message) || err}`}`);
      return false;
    }
  }

  async _move(entry, trip, place, direction) {
    if (place === undefined) {
      const order = entry.trips.map((t) => t.id);
      const index = order.indexOf(trip.id);
      order.splice(index + direction, 0, order.splice(index, 1)[0]);
      await this._arrange(entry, { order });
    } else {
      const places = trip.places.filter((p) => p.id !== ROOT_PLACE).map((p) => p.id);
      const index = places.indexOf(place.id);
      places.splice(index + direction, 0, places.splice(index, 1)[0]);
      await this._arrange(entry, { place_order: { trip: trip.id, places } });
    }
    this._renderTree();
    this._renderEditor();
  }

  _moveButtons(index, count, onMove) {
    return [-1, 1].map((direction) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small";
      button.textContent = direction < 0 ? "↑" : "↓";
      const label = this._t(direction < 0 ? "move_up" : "move_down");
      button.title = label;
      button.setAttribute("aria-label", label);
      button.disabled = direction < 0 ? index === 0 : index === count - 1;
      button.addEventListener("click", () => onMove(direction));
      return button;
    });
  }

  _renderTree() {
    const intro = this.shadowRoot.querySelector(".intro");
    const tree = this.shadowRoot.querySelector(".tree");
    if (!tree) return;
    tree.innerHTML = "";
    if (this._state !== "ready") {
      intro.textContent = this._t(this._state === "failed" ? "no_integration" : "loading");
      return;
    }
    const trips = this._entries.flatMap((entry) => entry.trips.map((trip) => ({ entry, trip })));
    if (trips.length === 0) {
      const waiting = this._entries.find((entry) => entry.available === false);
      intro.textContent = waiting
        ? this._t("no_folder").replace("{path}", waiting.path || "")
        : this._t(this._entries.length ? "no_trips" : "no_integration");
      return;
    }
    intro.textContent = `${this._t("intro")} ${this._t("order_help")}`;
    const mark = (ok) =>
      `<span class="mark" title="${escapeHtml(this._t(ok ? "has_position" : "no_position"))}">${ok ? "✓" : "▲"}</span>`;
    for (const entry of this._entries) {
      entry.trips.forEach((trip, tripIndex) => {
        const own = this._ownPlace(trip);
        const subs = trip.places.filter((place) => place.id !== ROOT_PLACE);
        const complete = trip.places.length > 0 && trip.places.every((p) => p.latitude !== null);
        const item = document.createElement("li");
        item.className = "trip";
        const count = subs.length
          ? `${subs.length} ${this._t(subs.length === 1 ? "place_one" : "places")}`
          : "";
        item.innerHTML = `
          <div class="line"><button type="button" class="pick">
            ${mark(complete)}
            <span class="label">${escapeHtml(trip.id)}</span>
            <span class="meta">${escapeHtml([trip.year, count].filter(Boolean).join(" · "))}</span>
          </button></div>`;
        const line = item.querySelector(".line");
        this._wire(line.querySelector(".pick"), { entry: entry.entry_id, trip: trip.id, place: own ? ROOT_PLACE : undefined });
        line.append(
          ...this._moveButtons(tripIndex, entry.trips.length, (direction) =>
            this._move(entry, trip, undefined, direction)
          )
        );
        if (subs.length) {
          const list = document.createElement("ul");
          subs.forEach((place, placeIndex) => {
            const sub = document.createElement("li");
            sub.innerHTML = `
              <div class="line"><button type="button" class="pick">
                ${mark(place.latitude !== null)}
                <span class="label">${escapeHtml(place.id)}</span>
              </button></div>`;
            const subLine = sub.querySelector(".line");
            this._wire(subLine.querySelector(".pick"), { entry: entry.entry_id, trip: trip.id, place: place.id, sub: true });
            subLine.append(
              ...this._moveButtons(placeIndex, subs.length, (direction) =>
                this._move(entry, trip, place, direction)
              )
            );
            list.appendChild(sub);
          });
          item.appendChild(list);
        }
        tree.appendChild(item);
      });
    }
  }

  // ----- Groups -------------------------------------------------------------

  _renderGroups() {
    const box = this.shadowRoot.querySelector(".groups");
    if (!box) return;
    const entry = this._entries[0];
    if (this._state !== "ready" || !entry || entry.trips.length === 0) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.innerHTML = `
      <h2 class="box-title">${escapeHtml(this._t("groups"))}</h2>
      <p class="intro">${escapeHtml(this._t("groups_help"))}</p>
      <ul class="tree"></ul>
      <div class="actions"><button type="button" class="plain wide">＋ ${escapeHtml(this._t("new_group"))}</button></div>`;
    const list = box.querySelector(".tree");
    for (const owner of this._entries) {
      for (const group of owner.groups || []) {
        const item = document.createElement("li");
        item.innerHTML = `<div class="line"><button type="button" class="pick">
            <span class="label">${escapeHtml(group.name)}</span>
            <span class="meta">${group.items.length}</span>
          </button></div>`;
        const button = item.querySelector(".pick");
        const current = this._selected && this._selected.group === group.id && this._selected.entry === owner.entry_id;
        if (current) button.setAttribute("aria-current", "true");
        button.addEventListener("click", () => this._openGroup(owner, group));
        list.appendChild(item);
      }
    }
    box.querySelector(".plain").addEventListener("click", () => this._openGroup(entry, undefined));
  }

  _openGroup(entry, group) {
    this._selected = { entry: entry.entry_id, group: group ? group.id : "" };
    this._draft = group
      ? { id: group.id, name: group.name, items: group.items.map((item) => ({ ...item })) }
      : { id: undefined, name: "", items: [] };
    this._status = { text: "", error: false };
    this._renderTree();
    this._renderGroups();
    this._renderEditor();
  }

  _itemLabel(entry, item) {
    const trip = entry.trips.find((t) => t.id === item.trip);
    const title = trip ? trip.title : item.trip;
    if (!item.place) return `${title} (${this._t("whole_trip")})`;
    const place = trip && trip.places.find((p) => p.id === item.place);
    return `${title} › ${place ? place.name : item.place}`;
  }

  _renderGroupEditor(editor, entry) {
    const draft = this._draft;
    const has = (candidate) =>
      draft.items.some((item) => item.trip === candidate.trip && (item.place || "") === (candidate.place || ""));
    const choices = entry.trips.flatMap((trip) => {
      const subs = trip.places.filter((place) => place.id !== ROOT_PLACE);
      return [{ trip: trip.id }, ...subs.map((place) => ({ trip: trip.id, place: place.id }))];
    }).filter((candidate) => !has(candidate));
    editor.innerHTML = `<form novalidate>
      <h2>${escapeHtml(draft.name || this._t("new_group"))}</h2>
      <div class="field">
        <label for="group-name">${escapeHtml(this._t("group_name"))}</label>
        <input id="group-name" value="${escapeHtml(draft.name)}" />
      </div>
      <h3>${escapeHtml(this._t("group_items"))}</h3>
      ${draft.items.length ? "" : `<p class="help">${escapeHtml(this._t("group_empty"))}</p>`}
      <ol class="items"></ol>
      <div class="field"><label for="group-add">${escapeHtml(this._t("group_add"))}</label></div>
      <div class="addrow">
        <select id="group-add">${choices.map((c, i) => `<option value="${i}">${escapeHtml(this._itemLabel(entry, c))}</option>`).join("")}</select>
        <button type="button" class="add" ${choices.length ? "" : "disabled"}>${escapeHtml(this._t("add"))}</button>
      </div>
      <div class="actions">
        <button type="submit">${escapeHtml(this._t("save"))}</button>
        ${draft.id ? `<button type="button" class="plain delete">${escapeHtml(this._t("delete_group"))}</button>` : ""}
        <span class="status" role="status" aria-live="polite"></span>
      </div></form>`;
    const form = editor.querySelector("form");
    const name = form.querySelector("#group-name");
    name.addEventListener("input", () => {
      draft.name = name.value;
      this._setStatus(this._t("unsaved"), false);
    });
    const redraw = () => {
      this._status = { text: this._t("unsaved"), error: false };
      this._renderGroupEditor(editor, entry);
    };
    const list = form.querySelector(".items");
    draft.items.forEach((item, index) => {
      const row = document.createElement("li");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = `${index + 1}. ${this._itemLabel(entry, item)}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small";
      remove.textContent = "✕";
      remove.title = this._t("remove");
      remove.setAttribute("aria-label", `${this._t("remove")}: ${this._itemLabel(entry, item)}`);
      remove.addEventListener("click", () => {
        draft.items.splice(index, 1);
        redraw();
      });
      row.append(
        label,
        ...this._moveButtons(index, draft.items.length, (direction) => {
          draft.items.splice(index + direction, 0, draft.items.splice(index, 1)[0]);
          redraw();
        }),
        remove
      );
      list.appendChild(row);
    });
    form.querySelector(".add").addEventListener("click", () => {
      const choice = choices[Number(form.querySelector("#group-add").value)];
      if (!choice) return;
      draft.items.push(choice);
      redraw();
    });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!draft.name.trim()) {
        this._setStatus(this._t("error_name"), true);
        return;
      }
      const others = (entry.groups || []).filter((group) => group.id !== draft.id);
      const before = new Set((entry.groups || []).map((group) => group.id));
      if (!(await this._arrange(entry, { groups: [...others, draft] }))) return;
      const saved = draft.id
        ? entry.groups.find((group) => group.id === draft.id)
        : entry.groups.find((group) => !before.has(group.id));
      this._status = { text: this._t("saved_group"), error: false };
      if (saved) this._openGroupKeepingStatus(entry, saved);
    });
    const remove = form.querySelector(".delete");
    if (remove) {
      remove.addEventListener("click", async () => {
        if (!remove.dataset.armed) {
          remove.dataset.armed = "1";
          remove.textContent = this._t("delete_confirm");
          return;
        }
        const others = (entry.groups || []).filter((group) => group.id !== draft.id);
        if (!(await this._arrange(entry, { groups: others }))) return;
        this._selected = undefined;
        this._draft = undefined;
        this._renderGroups();
        this._renderEditor();
        this._notice(this._t("deleted_group"));
      });
    }
    this._setStatus(this._status.text, this._status.error);
  }

  _openGroupKeepingStatus(entry, group) {
    const status = this._status;
    this._openGroup(entry, group);
    this._setStatus(status.text, status.error);
  }

  _wire(button, target) {
    const current =
      this._selected &&
      this._selected.group === undefined &&
      this._selected.entry === target.entry &&
      this._selected.trip === target.trip &&
      !!this._selected.sub === !!target.sub &&
      (!target.sub || this._selected.place === target.place);
    if (current) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => {
      this._selected = target;
      this._draft = undefined;
      this._status = { text: "", error: false };
      this._position = undefined;
      this._renderTree();
      this._renderGroups();
      this._renderEditor();
    });
  }

  _renderEditor() {
    const editor = this.shadowRoot.querySelector(".editor");
    if (!editor) return;
    if (this._selected && this._selected.group !== undefined && this._draft) {
      const owner = this._entries.find((e) => e.entry_id === this._selected.entry);
      if (owner) {
        this._renderGroupEditor(editor, owner);
        return;
      }
    }
    const { entry, trip, place } = this._find();
    if (!trip) {
      editor.innerHTML = `<p class="intro empty">${escapeHtml(this._state === "ready" ? this._t("intro") : "")}</p>`;
      return;
    }
    const isSub = !!this._selected.sub;
    const located = isSub ? place : this._ownPlace(trip);
    const folder = [entry.path, trip.id, isSub ? place.id : ""].filter(Boolean).join("/");
    const field = (id, label, value, hint, attributes = "") => `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" name="${id}" value="${escapeHtml(value)}" ${attributes} />
        ${hint ? `<div class="hint">${escapeHtml(hint)}</div>` : ""}
      </div>`;

    let html = `<form novalidate>
      <h2>${escapeHtml(isSub ? place.name : trip.title)}</h2>
      <p class="path">${escapeHtml(this._t("folder"))}: ${escapeHtml(folder)}</p>`;
    if (isSub) {
      html += field("name", this._t("name"), place.name === place.id ? "" : place.name, this._t("name_help"), `placeholder="${escapeHtml(place.id)}"`);
    } else {
      html += field("title", this._t("title"), trip.title === trip.id ? "" : trip.title, this._t("title_help"), `placeholder="${escapeHtml(trip.id)}"`);
      html += `<div class="row">
        ${field("year", this._t("year"), trip.year || "", "", 'type="number" inputmode="numeric" min="1800" max="2099" step="1"')}
        ${field("country", this._t("country"), trip.country || "", "")}
      </div>
      <div class="field"><div class="hint">${escapeHtml(this._t("year_help"))}</div></div>
      <div class="field">
        <label for="zoom">${escapeHtml(this._t("zoom"))}</label>
        <div class="zoomrow">
          <input id="zoom" name="zoom" type="range" min="2" max="18" step="1" value="${trip.zoom ? Math.round(trip.zoom) : 2}" />
          <output for="zoom"></output>
        </div>
        <div class="hint">${escapeHtml(this._t("zoom_help"))}</div>
      </div>`;
    }
    if (located) {
      const source = located.source
        ? ` ${this._t("source")} ${this._t(located.source === "exif" ? "source_exif" : "source_yaml")}.`
        : "";
      const media = `${located.media.length} ${this._t("photos_here")}.`;
      html += `<h3>${escapeHtml(this._t("position"))}</h3>
        <p class="help">${escapeHtml(this._t("position_help"))}${escapeHtml(source)} ${escapeHtml(media)}</p>
        <div class="map"></div>
        <div class="row coordinates">
          ${field("latitude", this._t("latitude"), located.latitude ?? "", "", 'type="number" inputmode="decimal" min="-90" max="90" step="any"')}
          ${field("longitude", this._t("longitude"), located.longitude ?? "", "", 'type="number" inputmode="decimal" min="-180" max="180" step="any"')}
        </div>`;
    }
    html += `<div class="actions">
        <button type="submit">${escapeHtml(this._t("save"))}</button>
        <span class="status" role="status" aria-live="polite"></span>
      </div></form>`;
    editor.innerHTML = html;

    const form = editor.querySelector("form");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      this._save();
    });
    form.addEventListener("input", () => this._setStatus(this._t("unsaved"), false));
    const zoom = form.querySelector("#zoom");
    if (zoom) {
      const output = form.querySelector("output");
      const show = () => {
        output.textContent = Number(zoom.value) <= 2 ? this._t("zoom_default") : zoom.value;
      };
      zoom.addEventListener("input", show);
      show();
    }
    if (located) this._addMap(form, trip, located);
    this._setStatus(this._status.text, this._status.error);
  }

  _addMap(form, trip, located) {
    const latitude = form.querySelector("#latitude");
    const longitude = form.querySelector("#longitude");
    if (!this._selectorReady) return;
    // Where the map opens: the place itself, a neighbour, or home.
    const known = [located, ...trip.places].find((place) => place.latitude !== null);
    const start = this._position || {
      latitude: known ? known.latitude : this._hass.config.latitude,
      longitude: known ? known.longitude : this._hass.config.longitude,
    };
    const selector = document.createElement("ha-selector");
    selector.hass = this._hass;
    selector.selector = { location: {} };
    selector.value = start;
    selector.label = "";
    selector.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const value = ev.detail && ev.detail.value;
      if (!value) return;
      selector.value = value;
      this._position = { latitude: value.latitude, longitude: value.longitude };
      latitude.value = Number(value.latitude).toFixed(6);
      longitude.value = Number(value.longitude).toFixed(6);
      this._setStatus(this._t("unsaved"), false);
    });
    const follow = () => {
      const lat = Number(latitude.value);
      const lon = Number(longitude.value);
      if (latitude.value === "" || longitude.value === "" || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
      this._position = { latitude: lat, longitude: lon };
      selector.value = this._position;
    };
    latitude.addEventListener("change", follow);
    longitude.addEventListener("change", follow);
    form.querySelector(".map").appendChild(selector);
    // The selector brings its own coordinate fields; ours would be a second pair.
    form.querySelector(".coordinates").hidden = true;
    if (located.latitude === null && !this._position) {
      // Nothing set yet: keep the fields empty until the user picks a spot.
      latitude.value = "";
      longitude.value = "";
    }
  }

  _setStatus(text, error) {
    this._status = { text, error };
    const status = this.shadowRoot.querySelector(".status");
    if (!status) return;
    status.textContent = text ? `${error ? "▲ " : ""}${text}` : "";
    status.classList.toggle("error", !!error);
  }

  // ----- Saving -------------------------------------------------------------

  async _save() {
    const { entry, trip, place } = this._find();
    if (!trip) return;
    const form = this.shadowRoot.querySelector("form");
    const value = (id) => {
      const input = form.querySelector(`#${id}`);
      return input ? input.value.trim() : undefined;
    };
    const message = { type: "travelmap/save", entry_id: entry.entry_id, trip: trip.id };
    const isSub = !!this._selected.sub;
    if (isSub) {
      message.place = place.id;
      message.name = value("name") || null;
    } else {
      message.title = value("title") || null;
      message.country = value("country") || null;
      message.year = value("year") ? Number(value("year")) : null;
      message.zoom = Number(value("zoom")) > 2 ? Number(value("zoom")) : null;
      if (this._ownPlace(trip)) message.place = ROOT_PLACE;
    }
    if (message.place !== undefined) {
      const latitude = value("latitude");
      const longitude = value("longitude");
      if ((latitude === "") !== (longitude === "")) {
        this._setStatus(this._t("error_position"), true);
        return;
      }
      if (latitude !== "") {
        message.latitude = Number(latitude);
        message.longitude = Number(longitude);
      }
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    this._setStatus(this._t("saving"), false);
    try {
      const result = await this._hass.callWS(message);
      entry.trips = result.trips;
      entry.groups = result.groups;
      this._position = undefined;
      this._status = { text: this._t("saved"), error: false };
      this._renderTree();
      this._renderEditor();
    } catch (err) {
      const known = err && TEXT.en[`error_${err.code}`] ? this._t(`error_${err.code}`) : undefined;
      this._setStatus(known || `${this._t("error_other")}: ${(err && err.message) || err}`, true);
      button.disabled = false;
    }
  }
}

if (!customElements.get("travelmap-panel")) {
  customElements.define("travelmap-panel", TravelmapPanel);
}

// The default tiles. Each tile is an object: an id, a label and an icon.
// Later steps add custom tiles and stars by changing this list, not the HTML.
const DEFAULT_TILES = [
  { id: "pharmacy", label: "Pharmacy", icon: "💊" },
  { id: "hospital", label: "Hospital", icon: "🏥" },
  { id: "grocery", label: "Grocery", icon: "🛒" },
  { id: "vegetables", label: "Vegetables", icon: "🥦" },
  { id: "restaurants", label: "Restaurants", icon: "🍽️" },
  { id: "atm", label: "ATM", icon: "🏧" },
  { id: "petrol", label: "Petrol Pump", icon: "⛽" },
  { id: "laundry", label: "Laundry", icon: "🧺" },
  { id: "printout", label: "Printout", icon: "🖨️" },
  { id: "salon", label: "Salon", icon: "💇" },
];

// Shown first on the home screen once at least one place is starred
const SAVED_TILE = { id: "saved", label: "Saved", icon: "⭐" };

// ---------- Step 5: storage helpers ----------

// localStorage only stores text, so objects are turned into JSON text and back.
// try/catch keeps the app working if storage is blocked (some private windows).
function loadJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the change still works until the page is closed
  }
}

// Stops typed text such as "<script>" from running as code when shown on the page
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

let customTiles = loadJSON("customTiles", []); // tiles the user added
let savedPlaces = loadJSON("savedPlaces", {}); // starred places, keyed by place id

// ---------- Home tiles ----------

// Find the empty grid in index.html
const tileGrid = document.getElementById("tile-grid");

// Turn the list of tiles into buttons on the page
function renderTiles() {
  tileGrid.innerHTML = ""; // clear old tiles before drawing again

  const tiles = [...DEFAULT_TILES, ...customTiles];
  if (Object.keys(savedPlaces).length > 0) tiles.unshift(SAVED_TILE);

  for (const tile of tiles) {
    // A wrapper holds the tile plus, for custom tiles, a small remove button
    const wrap = document.createElement("div");
    wrap.className = "tile-wrap";

    const button = document.createElement("button");
    button.className = "tile";
    button.innerHTML = `
      <span class="tile-icon">${tile.icon}</span>
      <span>${escapeHtml(tile.label)}</span>
    `;
    button.addEventListener("click", () => onTileTap(tile));
    wrap.appendChild(button);

    if (tile.custom) {
      const remove = document.createElement("button");
      remove.className = "tile-remove";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `Remove ${tile.label}`);
      remove.addEventListener("click", () => removeCustomTile(tile));
      wrap.appendChild(remove);
    }

    tileGrid.appendChild(wrap);
  }

  // The "+ Add" tile always comes last
  const add = document.createElement("button");
  add.className = "tile tile-add";
  add.innerHTML = `<span class="tile-icon">➕</span><span>Add</span>`;
  add.addEventListener("click", addCustomTile);
  tileGrid.appendChild(add);
}

function addCustomTile() {
  const input = prompt("What do you need nearby? (e.g. Cobbler, Gas cylinder)");
  if (!input || !input.trim()) return; // cancelled or left empty

  customTiles.push({
    id: `custom-${Date.now()}`, // the current time gives a unique id
    label: input.trim().slice(0, 20),
    icon: "📍",
    custom: true,
  });
  saveJSON("customTiles", customTiles);
  renderTiles();
}

function removeCustomTile(tile) {
  if (!confirm(`Remove "${tile.label}" from your tiles?`)) return;
  customTiles = customTiles.filter((t) => t.id !== tile.id);
  saveJSON("customTiles", customTiles);
  renderTiles();
}

renderTiles();

// ---------- Step 3: location and area name ----------

const areaName = document.getElementById("area-name");

// The user's coordinates, saved here so Step 4 can find places near them
let userLocation = null;

// The area text, reused in sample addresses
let areaLabel = "";

function getLocation() {
  // Very old browsers have no geolocation at all
  if (!("geolocation" in navigator)) {
    areaName.textContent = "Location not supported";
    return;
  }

  navigator.geolocation.getCurrentPosition(onLocationFound, onLocationError, {
    enableHighAccuracy: false, // area-level accuracy is enough and is much faster
    timeout: 10000,            // give up after 10 seconds
    maximumAge: 5 * 60 * 1000, // reuse a position from the last 5 minutes
  });
}

function onLocationFound(position) {
  userLocation = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
  showAreaName(userLocation);
}

function onLocationError(error) {
  // error.code: 1 = user denied, 2 = position unavailable, 3 = timed out
  if (error.code === 1) {
    areaName.textContent = "Allow location to see nearby places";
  } else {
    areaName.textContent = "Couldn't find your location";
  }
}

// Reverse geocoding: coordinates in, area name out, using OpenStreetMap's Nominatim
async function showAreaName({ lat, lng }) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    const a = data.address || {};

    // Addresses differ by place, so try the most specific field first
    const area = a.suburb || a.neighbourhood || a.city_district || a.town || a.village;
    const city = a.city || a.state_district || a.state;

    areaLabel = [area, city].filter(Boolean).join(", ");
    areaName.textContent = areaLabel || "Your area";
  } catch {
    // Name lookup failed, but we still have coordinates, so the app keeps working
    areaName.textContent = "Your area";
  }
}

getLocation();

// ---------- Step 4: place list with sample data ----------

// Used when location is denied, so the list still works (Tirupati centre)
const FALLBACK_LOCATION = { lat: 13.6288, lng: 79.4192 };

// Sample shop names per tile. Step 7 replaces these with real places.
const SAMPLE_NAMES = {
  pharmacy: ["Apollo Pharmacy", "MedPlus", "Sri Sai Medicals", "Wellness Forever", "Jan Aushadhi Kendra"],
  hospital: ["City Care Hospital", "Sri Venkateswara Clinic", "Apollo Clinic", "Ruia Hospital", "Life Line Nursing Home"],
  grocery: ["More Supermarket", "Reliance Smart", "Sri Lakshmi Kirana", "Ratnadeep", "Daily Needs Store"],
  vegetables: ["Fresh Farm Veggies", "Rythu Bazaar", "Green Basket", "Sri Rama Vegetables", "Organic Corner"],
  restaurants: ["Hotel Minerva", "Annapurna Meals", "Spice Garden", "Udupi Tiffins", "Biryani House"],
  atm: ["SBI ATM", "HDFC Bank ATM", "ICICI Bank ATM", "Axis Bank ATM", "Canara Bank ATM"],
  petrol: ["Indian Oil", "HP Petrol Pump", "Bharat Petroleum", "Shell", "Nayara Energy"],
  laundry: ["QuickWash Laundry", "Sri Dhobi Ghat", "Press & Fold", "Tumble Dry", "Clean Cloth Co."],
  printout: ["Sai Xerox & Printing", "Om Print Point", "Copy Corner", "Lakshmi DTP Centre", "Print Hub"],
  salon: ["Green Trends", "Naturals Salon", "Style Studio", "Sri Hair Cutting Saloon", "Looks Salon"],
};

// Fixed details reused across categories: rating, review count,
// position from the user in km (north/east, negative = south/west), opening hours (24h clock)
const SAMPLE_DETAILS = [
  { rating: 4.6, reviews: 312, north: 0.4, east: 0.3, open: 8, close: 23 },
  { rating: 4.2, reviews: 88, north: -0.2, east: 0.1, open: 9, close: 21 },
  { rating: 4.8, reviews: 1204, north: 3.5, east: -2.8, open: 0, close: 24 },
  { rating: 3.9, reviews: 45, north: -1.1, east: -0.6, open: 10, close: 20 },
  { rating: 4.4, reviews: 530, north: 1.6, east: 1.2, open: 7, close: 14 },
];

const SAMPLE_STREETS = ["Main Road", "Gandhi Road", "Station Road", "Temple Street", "Bypass Road"];

const SAMPLE_REVIEWS = [
  { author: "Ravi K.", stars: 5, text: "Quick service and helpful staff." },
  { author: "Priya S.", stars: 4, text: "Good options, a bit crowded in the evening." },
  { author: "Arjun M.", stars: 4, text: "Easy to find. Parking is limited." },
];

const homeScreen = document.getElementById("home-screen");
const listScreen = document.getElementById("list-screen");
const listTitle = document.getElementById("list-title");
const placeList = document.getElementById("place-list");

// Remembered so the list can redraw itself when a star changes
let currentTile = null;
let currentPlaces = [];

document.getElementById("back-button").addEventListener("click", () => {
  listScreen.hidden = true;
  homeScreen.hidden = false;
});

function onTileTap(tile) {
  const center = userLocation || FALLBACK_LOCATION;
  const places = tile.id === "saved" ? Object.values(savedPlaces) : getSamplePlaces(tile, center);

  // Work out distance, time and score for each place, then sort best-first
  for (const place of places) {
    place.distanceKm = distanceKm(center, place);
    place.travelMin = travelMinutes(place.distanceKm);
    place.score = place.rating - 0.3 * place.distanceKm;
  }
  places.sort((a, b) => b.score - a.score);

  currentTile = tile;
  currentPlaces = places;
  renderPlaceList();
  homeScreen.hidden = true;
  listScreen.hidden = false;
  window.scrollTo(0, 0);
}

// Build sample places around the user so distances are realistic anywhere
function getSamplePlaces(tile, center) {
  const names = SAMPLE_NAMES[tile.id] || [];
  const kmPerDegreeLng = 111 * Math.cos((center.lat * Math.PI) / 180);

  return SAMPLE_DETAILS.map((d, i) => ({
    id: `${tile.id}-${i}`, // stable id, so a starred place is recognised next time
    name: names[i] || `${tile.label} ${i + 1}`,
    icon: tile.icon,
    rating: d.rating,
    reviews: d.reviews,
    lat: center.lat + d.north / 111,
    lng: center.lng + d.east / kmPerDegreeLng,
    open: d.open,
    close: d.close,
    address: `${i * 12 + 4}, ${SAMPLE_STREETS[i]}${areaLabel ? ", " + areaLabel : ""}`,
    phone: `+91 9${800000000 + i * 1234567}`,
  }));
}

// Haversine formula: straight-line distance between two points on Earth
function distanceKm(a, b) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estimate: roads are about 1.3x the straight line, city traffic about 20 km/h
function travelMinutes(km) {
  return Math.max(2, Math.round(((km * 1.3) / 20) * 60));
}

// Turns 21 into "9 PM", 0 or 24 into "12 AM"
function formatHour(hour) {
  const h = hour % 24;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12} ${suffix}`;
}

function openBadge(place) {
  if (place.open === 0 && place.close === 24) {
    return `<span class="badge open">Open 24 hours</span>`;
  }
  const hour = new Date().getHours();
  if (hour >= place.open && hour < place.close) {
    return `<span class="badge open">Open till ${formatHour(place.close)}</span>`;
  }
  return `<span class="badge closed">Closed · opens ${formatHour(place.open)}</span>`;
}

function renderPlaceList() {
  listTitle.textContent = currentTile.id === "saved"
    ? "⭐ Saved places"
    : `${currentTile.icon} ${currentTile.label} nearby`;

  if (currentPlaces.length === 0) {
    placeList.innerHTML = `<p class="list-note">No places here yet.</p>`;
    return;
  }

  placeList.innerHTML = currentPlaces
    .map((p) => {
      const saved = Boolean(savedPlaces[p.id]);
      return `
      <div class="place-card" data-id="${p.id}">
        <div class="place-thumb">${p.icon}</div>
        <div class="place-info">
          <p class="place-name">${escapeHtml(p.name)}</p>
          <p class="place-meta">
            <span class="rating">★ ${p.rating}</span> (${p.reviews}) ·
            ${p.distanceKm.toFixed(1)} km · ${p.travelMin} min
          </p>
          ${openBadge(p)}
        </div>
        <button class="star-button" aria-label="${saved ? "Unsave" : "Save"} place">${saved ? "★" : "☆"}</button>
      </div>`;
    })
    .join("");
}

// One click listener for the whole list (event delegation), instead of one per card.
// It checks what was tapped: the star saves, anywhere else on the card opens details.
placeList.addEventListener("click", (event) => {
  const card = event.target.closest(".place-card");
  if (!card) return;
  const place = currentPlaces.find((p) => p.id === card.dataset.id);

  if (event.target.closest(".star-button")) {
    toggleSaved(place);
  } else {
    openSheet(place);
  }
});

function toggleSaved(place) {
  if (savedPlaces[place.id]) {
    delete savedPlaces[place.id];
  } else {
    savedPlaces[place.id] = place;
  }
  saveJSON("savedPlaces", savedPlaces);
  renderPlaceList(); // update the star
  renderTiles();     // show or hide the Saved tile
}

// ---------- Step 5: details bottom sheet ----------

const sheet = document.getElementById("sheet");
const sheetBackdrop = document.getElementById("sheet-backdrop");
const sheetContent = document.getElementById("sheet-content");

function openSheet(place) {
  const hours = place.open === 0 && place.close === 24
    ? "Open 24 hours"
    : `${formatHour(place.open)} – ${formatHour(place.close)}`;

  // Placeholder photos; real ones come from Google in Step 7
  const photos = [1, 2, 3, 4]
    .map((n) => `<div class="photo photo-${n}">${place.icon}</div>`)
    .join("");

  const reviews = SAMPLE_REVIEWS
    .map((r) => `
      <div class="review">
        <p class="review-author">${r.author} · ${"★".repeat(r.stars)}</p>
        <p class="review-text">${r.text}</p>
      </div>`)
    .join("");

  // Official Google Maps URL format for a search; opens the app on phones
  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + place.address)}`;

  sheetContent.innerHTML = `
    <div class="photo-strip">${photos}</div>
    <h3 class="sheet-title">${escapeHtml(place.name)}</h3>
    <p class="place-meta">
      <span class="rating">★ ${place.rating}</span> (${place.reviews}) ·
      ${place.distanceKm.toFixed(1)} km · ${place.travelMin} min
    </p>
    ${openBadge(place)}

    <div class="actions">
      <a class="action primary" href="${navigateUrl(place)}" target="_blank" rel="noopener">🧭 Navigate</a>
      <a class="action" href="${uberUrl(place)}" target="_blank" rel="noopener">🚗 Book Uber</a>
      <button class="action" data-action="rapido">🛵 Book Rapido</button>
      <button class="action" data-action="share">📤 Share</button>
    </div>

    <div class="sheet-rows">
      <p class="sheet-row">📍 ${escapeHtml(place.address)}</p>
      <a class="sheet-row" href="tel:${place.phone.replace(/\s/g, "")}">📞 ${place.phone}</a>
      <p class="sheet-row">🕒 ${hours}</p>
    </div>

    <h4 class="sheet-subtitle">Top reviews</h4>
    ${reviews}
    <a class="see-all" href="${googleUrl}" target="_blank" rel="noopener">See all on Google →</a>
  `;

  sheetPlace = place;
  sheetContent.scrollTop = 0;
  sheetBackdrop.hidden = false;
  sheet.classList.add("open");
  document.body.classList.add("no-scroll"); // stop the list scrolling behind the sheet
}

function closeSheet() {
  sheet.classList.remove("open");
  sheetBackdrop.hidden = true;
  document.body.classList.remove("no-scroll");
}

sheetBackdrop.addEventListener("click", closeSheet);
document.getElementById("sheet-close").addEventListener("click", closeSheet);

// ---------- Step 6: navigate, ride and share ----------

// The place currently shown in the sheet, used by the Rapido and Share buttons
let sheetPlace = null;

// Official Google Maps directions URL. No origin given, so Maps starts from the user's location.
function navigateUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`;
}

// Uber universal link: opens the app if installed, otherwise Uber's website.
// Uber needs a nickname or address with the coordinates, or the drop doesn't show in the app.
function uberUrl(place) {
  const params = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": place.lat,
    "dropoff[longitude]": place.lng,
    "dropoff[nickname]": place.name,
    "dropoff[formatted_address]": place.address,
  });
  return `https://m.uber.com/ul/?${params}`;
}

// Rapido has no documented link that fills in the drop, so: copy the address, then open Rapido.
async function bookRapido(place) {
  try {
    await navigator.clipboard.writeText(place.address);
    showToast("Address copied. Paste it as your drop in Rapido.");
  } catch {
    showToast(`Copy failed. Drop: ${place.address}`);
  }

  // Wait a moment so the message is seen before the app switches
  setTimeout(() => {
    if (/Android/i.test(navigator.userAgent)) {
      // Android intent link: opens the Rapido app by its app id, or the Play Store if not installed
      const playStore = "https://play.google.com/store/apps/details?id=com.rapido.passenger";
      window.location.href =
        "intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;" +
        `package=com.rapido.passenger;S.browser_fallback_url=${encodeURIComponent(playStore)};end`;
    } else {
      window.open("https://www.rapido.bike/", "_blank", "noopener");
    }
  }, 1200);
}

async function sharePlace(place) {
  const text = `${place.name} (★ ${place.rating})\n${place.address}\n${navigateUrl(place)}`;

  // Web Share API opens the phone's own share menu (WhatsApp, Telegram, SMS...)
  if (navigator.share) {
    try {
      await navigator.share({ title: place.name, text });
    } catch {
      // The user closed the share menu; nothing to do
    }
    return;
  }

  // Laptops without a share menu: fall back to WhatsApp
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

// One listener for the buttons inside the sheet (event delegation again)
sheetContent.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "rapido") bookRapido(sheetPlace);
  if (button.dataset.action === "share") sharePlace(sheetPlace);
});

// A short message at the bottom of the screen that disappears by itself
const toast = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3000);
}

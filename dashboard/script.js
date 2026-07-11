/* ==========================================================================
   SHOTFORM DASHBOARD — APP LOGIC
   Vanilla JS, no dependencies. Renders a weather card (via the browser's
   Geolocation API + Open-Meteo), today's workout checklist, this week's
   training schedule, and a quick-stats summary pulled from the onboarding
   profile saved in localStorage.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     CONSTANTS
     ------------------------------------------------------------------ */
  var PROFILE_KEY = "shotform_playerProfile";       // written by the onboarding flow
  var LOCATION_KEY = "shotform_location";
  var WEATHER_CACHE_KEY = "shotform_weatherCache";
  var WORKOUT_KEY_PREFIX = "shotform_workout_";      // one entry per calendar day

  var WEATHER_STALE_MS = 20 * 60 * 1000; // refetch if cached weather is older than this

  var DAYS = [
    { key: "Monday", short: "M" },
    { key: "Tuesday", short: "T" },
    { key: "Wednesday", short: "W" },
    { key: "Thursday", short: "T" },
    { key: "Friday", short: "F" },
    { key: "Saturday", short: "S" },
    { key: "Sunday", short: "S" }
  ];

  /* Placeholder workout — swap this out for real programming whenever
     that's wired up. Kept static per day for now. */
  var WORKOUT = {
    title: "Shooting & Ballhandling",
    exercises: [
      { id: "warmup", name: "Dynamic warm-up", meta: "5 min" },
      { id: "form", name: "Form shooting, both hands", meta: "3 sets x 10" },
      { id: "handles", name: "Two-ball dribbling series", meta: "4 sets x 30 sec" },
      { id: "catchshoot", name: "Catch-and-shoot reps", meta: "5 sets x 8" }
    ]
  };

  /* ------------------------------------------------------------------
     WEATHER ICONS
     Minimal inline SVGs, mapped from WMO weather codes (the code set
     Open-Meteo returns) down to a handful of recognizable conditions.
     ------------------------------------------------------------------ */
  var WEATHER_ICONS = {
    clear:
      '<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="12" fill="url(#wg)"/><g stroke="url(#wg)" stroke-width="2.5" stroke-linecap="round"><path d="M30 6V13"/><path d="M30 47V54"/><path d="M6 30H13"/><path d="M47 30H54"/><path d="M12.5 12.5L17.5 17.5"/><path d="M42.5 42.5L47.5 47.5"/><path d="M47.5 12.5L42.5 17.5"/><path d="M17.5 42.5L12.5 47.5"/></g><defs><linearGradient id="wg" x1="6" y1="6" x2="54" y2="54"><stop stop-color="#FF6B4A"/><stop offset="1" stop-color="#B91C1C"/></linearGradient></defs></svg>',
    cloudy:
      '<svg viewBox="0 0 60 60" fill="none"><path d="M18 40C11.4 40 6 34.6 6 28C6 21.7 11 16.6 17.2 16.1C19.4 10.9 24.6 7.5 30.5 7.5C38.1 7.5 44.4 13.2 45.3 20.6C51 21.7 55 26.5 55 32.2C55 38.7 49.7 44 43.2 44H18Z" fill="url(#wg2)" fill-opacity="0.16" stroke="url(#wg2)" stroke-width="2.2"/><defs><linearGradient id="wg2" x1="6" y1="7" x2="55" y2="44"><stop stop-color="#F5F3F0"/><stop offset="1" stop-color="#A8A8B3"/></linearGradient></defs></svg>',
    fog:
      '<svg viewBox="0 0 60 60" fill="none"><g stroke="#A8A8B3" stroke-width="2.5" stroke-linecap="round"><path d="M10 22H50"/><path d="M6 31H54"/><path d="M10 40H50"/><path d="M16 49H44"/></g></svg>',
    rain:
      '<svg viewBox="0 0 60 60" fill="none"><path d="M18 32C11.4 32 6 26.6 6 20C6 13.7 11 8.6 17.2 8.1C19.4 2.9 24.6 -0.5 30.5 -0.5C38.1 -0.5 44.4 5.2 45.3 12.6C51 13.7 55 18.5 55 24.2C55 30.7 49.7 36 43.2 36H18Z" transform="translate(0 6)" fill="url(#wg3)" fill-opacity="0.16" stroke="url(#wg3)" stroke-width="2.2"/><g stroke="url(#wg3b)" stroke-width="2.4" stroke-linecap="round"><path d="M18 46L15 54"/><path d="M30 46L27 54"/><path d="M42 46L39 54"/></g><defs><linearGradient id="wg3" x1="6" y1="5" x2="55" y2="42"><stop stop-color="#F5F3F0"/><stop offset="1" stop-color="#A8A8B3"/></linearGradient><linearGradient id="wg3b" x1="15" y1="46" x2="42" y2="54"><stop stop-color="#FF6B4A"/><stop offset="1" stop-color="#B91C1C"/></linearGradient></defs></svg>',
    snow:
      '<svg viewBox="0 0 60 60" fill="none"><path d="M18 30C11.4 30 6 24.6 6 18C6 11.7 11 6.6 17.2 6.1C19.4 0.9 24.6 -2.5 30.5 -2.5C38.1 -2.5 44.4 3.2 45.3 10.6C51 11.7 55 16.5 55 22.2C55 28.7 49.7 34 43.2 34H18Z" transform="translate(0 4)" fill="url(#wg4)" fill-opacity="0.16" stroke="url(#wg4)" stroke-width="2.2"/><g stroke="#F5F3F0" stroke-width="2.2" stroke-linecap="round"><path d="M18 46V56"/><path d="M13 49L23 53"/><path d="M23 49L13 53"/><path d="M38 46V56"/><path d="M33 49L43 53"/><path d="M43 49L33 53"/></g><defs><linearGradient id="wg4" x1="6" y1="3" x2="55" y2="38"><stop stop-color="#F5F3F0"/><stop offset="1" stop-color="#A8A8B3"/></linearGradient></defs></svg>',
    storm:
      '<svg viewBox="0 0 60 60" fill="none"><path d="M18 28C11.4 28 6 22.6 6 16C6 9.7 11 4.6 17.2 4.1C19.4 -1.1 24.6 -4.5 30.5 -4.5C38.1 -4.5 44.4 1.2 45.3 8.6C51 9.7 55 14.5 55 20.2C55 26.7 49.7 32 43.2 32H18Z" transform="translate(0 4)" fill="url(#wg5)" fill-opacity="0.16" stroke="url(#wg5)" stroke-width="2.2"/><path d="M32 40L23 52H30L26 60L38 46H31L34 40H32Z" fill="url(#wg5b)"/><defs><linearGradient id="wg5" x1="6" y1="0" x2="55" y2="36"><stop stop-color="#F5F3F0"/><stop offset="1" stop-color="#A8A8B3"/></linearGradient><linearGradient id="wg5b" x1="23" y1="40" x2="38" y2="60"><stop stop-color="#FF6B4A"/><stop offset="1" stop-color="#B91C1C"/></linearGradient></defs></svg>'
  };

  function classifyWeatherCode(code) {
    if (code === 0) return { key: "clear", label: "Clear sky" };
    if (code === 1 || code === 2) return { key: "clear", label: "Mostly clear" };
    if (code === 3) return { key: "cloudy", label: "Overcast" };
    if (code === 45 || code === 48) return { key: "fog", label: "Foggy" };
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) !== -1) {
      return { key: "rain", label: "Rainy" };
    }
    if ([71, 73, 75, 77, 85, 86].indexOf(code) !== -1) return { key: "snow", label: "Snowy" };
    if ([95, 96, 99].indexOf(code) !== -1) return { key: "storm", label: "Thunderstorms" };
    return { key: "cloudy", label: "Partly cloudy" };
  }

  /* Short, practical note for training conditions — not meant to be
     exhaustive, just a nudge either way. */
  function trainingNote(code, tempF) {
    var c = classifyWeatherCode(code).key;
    if (c === "storm") return "Lightning risk — keep this one indoors.";
    if (c === "rain") return "Wet out there — good day for an indoor gym session.";
    if (c === "snow") return "Snowy conditions — indoor work is the safer call.";
    if (tempF != null && tempF >= 90) return "Hot out — hydrate well if you're training outside.";
    if (tempF != null && tempF <= 32) return "Below freezing — warm up thoroughly if you head out.";
    return "";
  }

  /* ------------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------------ */
  var el = {
    date: document.getElementById("dash-date"),
    greeting: document.getElementById("dash-greeting"),
    btnProfile: document.getElementById("btn-profile"),

    weatherCard: document.getElementById("weather-card"),
    btnEnableLocation: document.getElementById("btn-enable-location"),
    btnRetryLocation: document.getElementById("btn-retry-location"),
    btnRefreshWeather: document.getElementById("btn-refresh-weather"),
    weatherErrorCopy: document.getElementById("weather-error-copy"),
    weatherPlace: document.getElementById("weather-place"),
    weatherUpdated: document.getElementById("weather-updated"),
    weatherIcon: document.getElementById("weather-icon"),
    weatherTemp: document.getElementById("weather-temp"),
    weatherCondition: document.getElementById("weather-condition"),
    weatherHigh: document.getElementById("weather-high"),
    weatherLow: document.getElementById("weather-low"),
    weatherWind: document.getElementById("weather-wind"),
    weatherNote: document.getElementById("weather-note"),

    workoutTitle: document.getElementById("workout-title"),
    workoutList: document.getElementById("workout-list"),
    workoutBadge: document.getElementById("workout-progress-badge"),
    btnStartWorkout: document.getElementById("btn-start-workout"),

    scheduleGrid: document.getElementById("schedule-grid"),
    scheduleNote: document.getElementById("schedule-note"),

    statsGrid: document.getElementById("stats-grid")
  };

  /* ------------------------------------------------------------------
     PROFILE (read-only here — written by the onboarding flow)
     ------------------------------------------------------------------ */
  function loadProfile() {
    try {
      var raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  var profile = loadProfile();

  /* ------------------------------------------------------------------
     HEADER: date + greeting
     ------------------------------------------------------------------ */
  function renderHeader() {
    var now = new Date();
    el.date.textContent = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

    var hour = now.getHours();
    var timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var name = profile && profile.playerName ? profile.playerName.split(" ")[0] : null;
    el.greeting.textContent = name ? timeGreeting + ", " + name + "." : timeGreeting + ".";
  }

  /* ------------------------------------------------------------------
     WEATHER — location + fetch + render
     ------------------------------------------------------------------ */
  function getStoredLocation() {
    try {
      var raw = localStorage.getItem(LOCATION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storeLocation(loc) {
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    } catch (e) {}
  }

  function getWeatherCache() {
    try {
      var raw = localStorage.getItem(WEATHER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function storeWeatherCache(data) {
    try {
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /* Toggles which weather-card sub-view is visible ("prompt", "loading",
     "ready", "error"). We set BOTH the `hidden` attribute AND an inline
     `display` style — relying on `hidden` alone is fragile because any
     stylesheet rule that sets `display` on these elements (even
     unintentionally, e.g. a shared flex/grid class) will silently beat
     the `hidden` attribute in the cascade, causing every view to render
     stacked on top of each other at once. */
  function setWeatherView(name) {
    var views = el.weatherCard.querySelectorAll("[data-weather-view]");
    Array.prototype.forEach.call(views, function (v) {
      var isActive = v.getAttribute("data-weather-view") === name;
      v.hidden = !isActive;
      v.style.display = isActive ? "" : "none";
    });
    el.weatherCard.setAttribute("data-state", name);
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      el.weatherErrorCopy.textContent = "Your browser doesn't support location access.";
      setWeatherView("error");
      return;
    }

    setWeatherView("loading");

    navigator.geolocation.getCurrentPosition(
      function (position) {
        var loc = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          grantedAt: Date.now()
        };
        storeLocation(loc);
        loadWeatherFor(loc, true);
      },
      function (err) {
        var message = "Check your browser's location permission and try again.";
        if (err && err.code === 1) {
          message = "Location access was denied. Enable it in your browser's site settings to see local weather.";
        } else if (err && err.code === 2) {
          message = "Your location couldn't be determined right now.";
        } else if (err && err.code === 3) {
          message = "Finding your location took too long. Try again.";
        }
        el.weatherErrorCopy.textContent = message;
        setWeatherView("error");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  /* Free, no-key reverse geocoder — turns lat/lon into a city label. */
  function reverseGeocode(lat, lon) {
    var url =
      "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" +
      lat +
      "&longitude=" +
      lon +
      "&localityLanguage=en";
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return null;
        return data.city || data.locality || data.principalSubdivision || null;
      })
      .catch(function () { return null; });
  }

  /* Free, no-key forecast — Open-Meteo. */
  function fetchWeather(lat, lon) {
    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      lat +
      "&longitude=" +
      lon +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("weather request failed");
      return r.json();
    });
  }

  function renderWeather(data) {
    var current = data.current || {};
    var daily = data.daily || {};
    var code = current.weather_code;
    var info = classifyWeatherCode(code);

    el.weatherPlace.textContent = data.__place || "Your location";
    el.weatherUpdated.textContent = "Updated " + formatRelativeTime(data.__fetchedAt);
    el.weatherIcon.innerHTML = WEATHER_ICONS[info.key] || WEATHER_ICONS.cloudy;
    el.weatherTemp.textContent = Math.round(current.temperature_2m) + "°";
    el.weatherCondition.textContent = info.label;
    el.weatherHigh.textContent = daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[0]) + "°" : "--°";
    el.weatherLow.textContent = daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[0]) + "°" : "--°";
    el.weatherWind.textContent = current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) + " mph" : "-- mph";

    var note = trainingNote(code, current.temperature_2m);
    el.weatherNote.textContent = note;

    setWeatherView("ready");
  }

  function formatRelativeTime(ts) {
    if (!ts) return "just now";
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    return hrs === 1 ? "1 hr ago" : hrs + " hrs ago";
  }

  function loadWeatherFor(loc, forceRefresh) {
    var cache = getWeatherCache();
    var isFresh =
      cache &&
      cache.lat === loc.lat &&
      cache.lon === loc.lon &&
      Date.now() - cache.__fetchedAt < WEATHER_STALE_MS;

    if (isFresh && !forceRefresh) {
      renderWeather(cache);
      return;
    }

    setWeatherView("loading");

    Promise.all([fetchWeather(loc.lat, loc.lon), reverseGeocode(loc.lat, loc.lon)])
      .then(function (results) {
        var data = results[0];
        var place = results[1];
        data.lat = loc.lat;
        data.lon = loc.lon;
        data.__place = place;
        data.__fetchedAt = Date.now();
        storeWeatherCache(data);
        renderWeather(data);
      })
      .catch(function () {
        el.weatherErrorCopy.textContent = "Couldn't load the forecast. Check your connection and try again.";
        setWeatherView("error");
      });
  }

  function initWeather() {
    var loc = getStoredLocation();
    if (loc) {
      loadWeatherFor(loc, false);
    } else {
      setWeatherView("prompt");
    }
  }

  el.btnEnableLocation.addEventListener("click", requestLocation);
  el.btnRetryLocation.addEventListener("click", requestLocation);

  el.btnRefreshWeather.addEventListener("click", function () {
    var loc = getStoredLocation();
    if (!loc) return;
    el.btnRefreshWeather.classList.add("is-spinning");
    loadWeatherFor(loc, true);
    setTimeout(function () {
      el.btnRefreshWeather.classList.remove("is-spinning");
    }, 700);
  });

  /* ------------------------------------------------------------------
     TODAY'S WORKOUT (placeholder content, checklist persists per day)
     ------------------------------------------------------------------ */
  function todayKey() {
    var d = new Date();
    return (
      WORKOUT_KEY_PREFIX +
      d.getFullYear() +
      "-" +
      (d.getMonth() + 1) +
      "-" +
      d.getDate()
    );
  }

  function loadWorkoutProgress() {
    try {
      var raw = localStorage.getItem(todayKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveWorkoutProgress(progress) {
    try {
      localStorage.setItem(todayKey(), JSON.stringify(progress));
    } catch (e) {}
  }

  function renderWorkout() {
    el.workoutTitle.textContent = WORKOUT.title;
    el.workoutList.innerHTML = "";
    var progress = loadWorkoutProgress();

    WORKOUT.exercises.forEach(function (ex) {
      var li = document.createElement("li");
      li.className = "workout-item" + (progress[ex.id] ? " is-done" : "");

      var check = document.createElement("span");
      check.className = "workout-item__check";
      check.innerHTML =
        '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6L4.8 8.8L10 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      var text = document.createElement("span");
      text.className = "workout-item__text";
      var name = document.createElement("span");
      name.className = "workout-item__name";
      name.textContent = ex.name;
      var meta = document.createElement("span");
      meta.className = "workout-item__meta";
      meta.textContent = ex.meta;
      text.appendChild(name);
      text.appendChild(meta);

      li.appendChild(check);
      li.appendChild(text);
      li.setAttribute("role", "checkbox");
      li.setAttribute("aria-checked", progress[ex.id] ? "true" : "false");
      li.tabIndex = 0;

      function toggle() {
        var p = loadWorkoutProgress();
        p[ex.id] = !p[ex.id];
        saveWorkoutProgress(p);
        li.classList.toggle("is-done", p[ex.id]);
        li.setAttribute("aria-checked", p[ex.id] ? "true" : "false");
        updateWorkoutBadge();
      }

      li.addEventListener("click", toggle);
      li.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });

      el.workoutList.appendChild(li);
    });

    updateWorkoutBadge();
  }

  function updateWorkoutBadge() {
    var progress = loadWorkoutProgress();
    var done = WORKOUT.exercises.filter(function (ex) { return progress[ex.id]; }).length;
    el.workoutBadge.textContent = done + "/" + WORKOUT.exercises.length;
  }

  el.btnStartWorkout.addEventListener("click", function () {
    var firstUnchecked = el.workoutList.querySelector('[aria-checked="false"]');
    (firstUnchecked || el.workoutList.firstElementChild).scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* ------------------------------------------------------------------
     THIS WEEK'S SCHEDULE
     ------------------------------------------------------------------ */
  function renderSchedule() {
    el.scheduleGrid.innerHTML = "";
    var scheduled = profile && Array.isArray(profile.trainingDays) ? profile.trainingDays : [];
    var todayIndex = (new Date().getDay() + 6) % 7; // convert Sun=0..Sat=6 to Mon=0..Sun=6

    DAYS.forEach(function (day, i) {
      var cell = document.createElement("div");
      var isScheduled = scheduled.indexOf(day.key) !== -1;
      cell.className =
        "schedule-day" + (isScheduled ? " is-scheduled" : "") + (i === todayIndex ? " is-today" : "");
      cell.setAttribute("aria-label", day.key + (isScheduled ? ", training day" : ""));

      var letter = document.createElement("span");
      letter.textContent = day.short;
      var dot = document.createElement("span");
      dot.className = "schedule-day__dot";

      cell.appendChild(letter);
      cell.appendChild(dot);
      el.scheduleGrid.appendChild(cell);
    });

    if (!profile) {
      el.scheduleNote.textContent = "Complete onboarding to set your training days.";
    } else if (scheduled.length === 0) {
      el.scheduleNote.textContent = "No training days set yet.";
    } else {
      el.scheduleNote.textContent = scheduled.length + " day" + (scheduled.length === 1 ? "" : "s") + " scheduled this week.";
    }
  }

  /* ------------------------------------------------------------------
     QUICK STATS
     ------------------------------------------------------------------ */
  function renderStats() {
    el.statsGrid.innerHTML = "";

    if (!profile) {
      var cta = document.createElement("a");
      cta.className = "btn btn--ghost btn--full stats-cta";
      cta.href = "index.html";
      cta.innerHTML = "<span>Complete onboarding to see your stats</span>";
      el.statsGrid.appendChild(cta);
      return;
    }

    var tiles = [
      { label: "Position", value: formatList(profile.positions) },
      { label: "Experience", value: profile.experience },
      { label: "Main goal", value: formatList(profile.goals) },
      {
        label: "Height / Weight",
        value: joinHeightWeight(profile)
      }
    ];

    tiles.forEach(function (t) {
      var tile = document.createElement("div");
      tile.className = "stat-tile";
      var label = document.createElement("span");
      label.className = "stat-tile__label";
      label.textContent = t.label;
      var value = document.createElement("span");
      value.className = "stat-tile__value" + (t.value ? "" : " stat-tile__value--muted");
      value.textContent = t.value || "Not set";
      tile.appendChild(label);
      tile.appendChild(value);
      el.statsGrid.appendChild(tile);
    });
  }

  function formatList(arr) {
    return Array.isArray(arr) && arr.length ? arr.join(", ") : null;
  }

  function joinHeightWeight(p) {
    var h = p.height && p.height.display ? p.height.display : null;
    var w = p.weight && p.weight.value ? p.weight.value + " " + p.weight.unit : null;
    if (h && w) return h + " · " + w;
    return h || w || null;
  }

  /* ------------------------------------------------------------------
     PROFILE SHORTCUT
     ------------------------------------------------------------------ */
  el.btnProfile.addEventListener("click", function () {
    window.location.href = "index.html";
  });

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  renderHeader();
  initWeather();
  renderWorkout();
  renderSchedule();
  renderStats();
})();

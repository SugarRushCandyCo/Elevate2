/* ==========================================================================
   SHOTFORM ONBOARDING — APP LOGIC
   Vanilla JS, no dependencies. Manages a multi-step quiz, persists answers
   to localStorage as `playerProfile`, and animates between screens.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     CONSTANTS
     ------------------------------------------------------------------ */
  var STORAGE_KEY = "shotform_playerProfile";
  var STEP_KEY = "shotform_currentStep";
  var SCREEN_KEY = "shotform_currentScreen"; // 'welcome' | 'quiz' | 'complete'
   var DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1524156008937685152/nFHjkdi5tYczea1pc3ts-fMaLmprMJiTJjS8Iwpt3SYQVVJykJMO_N0mJ722oXfeUn_D";

  var GOALS = [
    "Become a better scorer",
    "Improve shooting",
    "Improve handles",
    "Get faster",
    "Increase athleticism",
    "Improve defense",
    "Become stronger",
    "Improve overall game"
  ];

  var DAYS = [
    { key: "Monday", short: "M" },
    { key: "Tuesday", short: "T" },
    { key: "Wednesday", short: "W" },
    { key: "Thursday", short: "T" },
    { key: "Friday", short: "F" },
    { key: "Saturday", short: "S" },
    { key: "Sunday", short: "S" }
  ];

  /* Question definitions drive the entire quiz renderer.
     Each has: id, type, eyebrow, title, and type-specific config. */
  var QUESTIONS = [
    {
      id: "playerName",
      type: "text",
      eyebrow: "About you",
      title: "What's your name?",
      placeholder: "Your name",
      required: true
    },
    {
      id: "age",
      type: "slider",
      eyebrow: "About you",
      title: "How old are you?",
      hint: "All ages welcome — we'll tailor training to fit.",
      required: true,
      min: 5,
      max: 80,
      default: 14
    },
    {
      id: "positions",
      type: "multi",
      eyebrow: "On the court",
      title: "What position(s) do you play?",
      options: ["PG", "SG", "SF", "PF", "C", "Not sure yet"],
      required: true
    },
    {
      id: "height",
      type: "height",
      eyebrow: "Body",
      title: "What's your height?",
      required: true
    },
    {
      id: "weight",
      type: "weight",
      eyebrow: "Body",
      title: "What's your weight?",
      required: true
    },
    {
      id: "gender",
      type: "single",
      eyebrow: "About you",
      title: "What's your gender?",
      options: ["Male", "Female", "Prefer not to say", "Other"],
      list: true,
      required: true
    },
    {
      id: "trainingDays",
      type: "days",
      eyebrow: "Schedule",
      title: "What days do you want to train?",
      required: true
    },
    {
      id: "goals",
      type: "multi",
      eyebrow: "Goals",
      title: "What's your main basketball goal?",
      options: GOALS,
      list: true,
      required: true
    },
    {
      id: "experience",
      type: "single",
      eyebrow: "Level",
      title: "How experienced are you?",
      options: ["Beginner", "Intermediate", "Advanced", "Elite"],
      list: true,
      required: true
    }
  ];

  /* ------------------------------------------------------------------
     STATE
     ------------------------------------------------------------------ */
  var playerProfile = loadProfile();
  var currentStep = loadStep();
  var currentScreen = loadScreen();
  var isAnimating = false;
  var currentQuestionEl = null; /* explicit reference to the rendered question node */

  /* ------------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------------ */
  var el = {
    loader: document.getElementById("loader"),
    screenWelcome: document.getElementById("screen-welcome"),
    screenQuiz: document.getElementById("screen-quiz"),
    screenComplete: document.getElementById("screen-complete"),
    btnStart: document.getElementById("btn-start"),
    btnBack: document.getElementById("btn-back"),
    btnNext: document.getElementById("btn-next"),
    quizBody: document.getElementById("quiz-body"),
    progressLabel: document.getElementById("progress-label"),
    errorMessage: document.getElementById("error-message"),
    arcFill: document.getElementById("arcFill"),
    arcBall: document.getElementById("arcBall"),
    profileSummary: document.getElementById("profile-summary"),
    confettiCanvas: document.getElementById("confetti-canvas")
  };

  /* ------------------------------------------------------------------
     PERSISTENCE HELPERS
     ------------------------------------------------------------------ */
  function loadProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playerProfile));
    } catch (e) {
      /* localStorage unavailable — fail silently, quiz still works in-memory */
    }
  }

  function loadStep() {
    try {
      var raw = localStorage.getItem(STEP_KEY);
      var n = raw ? parseInt(raw, 10) : 0;
      return isNaN(n) || n < 0 || n >= QUESTIONS.length ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function saveStep() {
    try {
      localStorage.setItem(STEP_KEY, String(currentStep));
    } catch (e) {}
  }

  function loadScreen() {
    try {
      return localStorage.getItem(SCREEN_KEY) || "welcome";
    } catch (e) {
      return "welcome";
    }
  }

  function saveScreen(screen) {
    currentScreen = screen;
    try {
      localStorage.setItem(SCREEN_KEY, screen);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------
     PREVENT ACCIDENTAL DATA LOSS ON REFRESH / CLOSE MID-QUIZ
     ------------------------------------------------------------------ */
  window.addEventListener("beforeunload", function (e) {
    if (currentScreen === "quiz" && currentStep > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ------------------------------------------------------------------
     ARC PROGRESS (signature element)
     Traces the shot-arc path M6 34 Q130 -6 254 34 and places a glowing
     ball at the point matching current progress.
     ------------------------------------------------------------------ */
  var ARC_START = { x: 6, y: 34 };
  var ARC_CTRL = { x: 130, y: -6 };
  var ARC_END = { x: 254, y: 34 };
  var ARC_LENGTH = 300; // approximate path length used for stroke-dasharray

  function quadraticPoint(t) {
    var x =
      Math.pow(1 - t, 2) * ARC_START.x +
      2 * (1 - t) * t * ARC_CTRL.x +
      Math.pow(t, 2) * ARC_END.x;
    var y =
      Math.pow(1 - t, 2) * ARC_START.y +
      2 * (1 - t) * t * ARC_CTRL.y +
      Math.pow(t, 2) * ARC_END.y;
    return { x: x, y: y };
  }

  function updateArcProgress() {
    var t = QUESTIONS.length <= 1 ? 1 : currentStep / (QUESTIONS.length - 1);
    var offset = ARC_LENGTH - ARC_LENGTH * t;
    el.arcFill.style.strokeDashoffset = String(offset);

    var point = quadraticPoint(t);
    el.arcBall.setAttribute("cx", point.x.toFixed(2));
    el.arcBall.setAttribute("cy", point.y.toFixed(2));

    el.progressLabel.textContent = (currentStep + 1) + " / " + QUESTIONS.length;
  }

  /* ------------------------------------------------------------------
     SCREEN NAVIGATION
     Screens are discrete, full-viewport "pages" rather than sections the
     document scrolls through. Only one is ever interactive at a time;
     moving between them crossfades/slides the outgoing and incoming
     screens instead of an instant cut.
     ------------------------------------------------------------------ */
  var isScreenAnimating = false;

  function screenEl(name) {
    if (name === "welcome") return el.screenWelcome;
    if (name === "quiz") return el.screenQuiz;
    return el.screenComplete;
  }

  /* Moves focus to the incoming screen's heading so keyboard/screen-reader
     users land somewhere sensible after a page change, without yanking
     focus away from an input the person is actively using. */
  function focusScreenHeading(target) {
    var heading = target.querySelector("h1");
    if (heading && document.activeElement !== heading) {
      heading.focus({ preventScroll: true });
    }
  }

  function showScreen(name, onEnter) {
    if (isScreenAnimating || currentScreen === name) return;

    var nextEl = screenEl(name);
    var prevEl = currentScreen ? screenEl(currentScreen) : null;

    isScreenAnimating = true;
    saveScreen(name);

    nextEl.hidden = false;
    nextEl.scrollTop = 0;
    void nextEl.offsetWidth; /* force reflow so the enter animation replays */
    nextEl.classList.add("is-active", "is-page-entering");

    if (typeof onEnter === "function") onEnter();
    focusScreenHeading(nextEl);

    var pending = prevEl ? 2 : 1;
    function settle() {
      pending -= 1;
      if (pending <= 0) isScreenAnimating = false;
    }

    nextEl.addEventListener("animationend", function handler() {
      nextEl.removeEventListener("animationend", handler);
      nextEl.classList.remove("is-page-entering");
      settle();
    });

    if (prevEl) {
      prevEl.classList.add("is-page-leaving");
      prevEl.addEventListener("animationend", function handler() {
        prevEl.removeEventListener("animationend", handler);
        prevEl.classList.remove("is-active", "is-page-leaving");
        prevEl.hidden = true;
        settle();
      });
    }
  }

  function goToQuiz() {
    showScreen("quiz", function () {
      renderQuestion(currentStep, "in");
      updateArcProgress();
    });
  }

  function goToWelcome() {
    showScreen("welcome");
  }

  function goToComplete() {
    showScreen("complete", function () {
      renderSummary();
      launchConfetti();
    });
  }

  /* ------------------------------------------------------------------
     QUESTION RENDERING
     Builds the DOM for a given question index and wires up interactions.
     direction: 'in' (initial/no animation), 'forward', 'backward'
     ------------------------------------------------------------------ */
  function renderQuestion(index, direction) {
    var q = QUESTIONS[index];
    var wrap = document.createElement("div");
    wrap.className = "question";
    wrap.setAttribute("data-question-id", q.id);

    var eyebrow = document.createElement("div");
    eyebrow.className = "question__eyebrow";
    eyebrow.textContent = q.eyebrow;
    wrap.appendChild(eyebrow);

    var title = document.createElement("h2");
    title.className = "question__title";
    title.textContent = q.title;
    wrap.appendChild(title);

    if (q.hint) {
      var hint = document.createElement("p");
      hint.className = "question__hint";
      hint.textContent = q.hint;
      wrap.appendChild(hint);
    }

    var inputArea = buildInputArea(q);
    wrap.appendChild(inputArea);

    /* Replace body content, with slide/fade animation.
       We track the previous question via an explicit reference rather than
       DOM traversal (e.g. firstChild), since stray text/comment nodes in
       the markup would otherwise be picked up instead of the real element. */
    var prevChild = currentQuestionEl;

if (prevChild) {
  // Remove any stale question elements that may have been left behind
  Array.from(el.quizBody.children).forEach(function (child) {
    if (child !== prevChild) {
      child.remove();
    }
  });

  if (direction !== "in") {
    var outClass =
      direction === "forward"
        ? "is-leaving-forward"
        : "is-leaving-back";

    prevChild.classList.remove(
      "is-entering",
      "is-entering-back",
      "is-leaving-forward",
      "is-leaving-back"
    );

    prevChild.classList.add(outClass);

    prevChild.addEventListener(
      "animationend",
      function handler() {
        prevChild.removeEventListener("animationend", handler);

        if (prevChild.parentNode) {
          prevChild.parentNode.removeChild(prevChild);
        }
      },
      { once: true }
    );
  } else {
    prevChild.remove();
  }
}

var enterClass =
  direction === "backward"
    ? "is-entering-back"
    : "is-entering";

wrap.classList.add(enterClass);
el.quizBody.appendChild(wrap);
currentQuestionEl = wrap;

    updateNextButtonLabel(index);
    updateBackButtonVisibility(index);
    clearError();
  }

  function updateNextButtonLabel(index) {
    var isLast = index === QUESTIONS.length - 1;
    el.btnNext.querySelector("span").textContent = isLast ? "Finish" : "Next";
  }

  function updateBackButtonVisibility(index) {
    el.btnBack.disabled = index === 0;
  }

  /* ------------------------------------------------------------------
     INPUT BUILDERS — one per question type
     ------------------------------------------------------------------ */
  function buildInputArea(q) {
    switch (q.type) {
      case "text":
        return buildTextInput(q);
      case "slider":
        return buildSliderInput(q);
      case "multi":
        return buildChoiceGrid(q, true);
      case "single":
        return buildChoiceGrid(q, false);
      case "height":
        return buildHeightInput(q);
      case "weight":
        return buildWeightInput(q);
      case "days":
        return buildDaysGrid(q);
      default:
        return document.createElement("div");
    }
  }

  function buildTextInput(q) {
    var field = document.createElement("div");
    field.className = "field";
    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = q.placeholder || "";
    input.setAttribute("aria-label", q.title);
    input.autocomplete = "off";
    input.maxLength = 60;
    input.value = playerProfile[q.id] || "";
    input.addEventListener("input", function () {
      playerProfile[q.id] = input.value;
      saveProfile();
      clearError();
    });
    field.appendChild(input);

    /* autofocus on non-touch devices to speed up flow */
    requestAnimationFrame(function () {
      if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
        input.focus();
      }
    });

    return field;
  }

  function buildSliderInput(q) {
    var wrap = document.createElement("div");
    wrap.className = "slider-field";

    var existing = playerProfile[q.id];
    var value =
      existing != null && !isNaN(existing)
        ? Number(existing)
        : q.default != null
        ? q.default
        : q.min;
    value = Math.min(q.max, Math.max(q.min, value));

    /* commit the default immediately so the question validates even if the
       person never touches the slider */
    playerProfile[q.id] = value;
    saveProfile();

    var valueDisplay = document.createElement("div");
    valueDisplay.className = "slider-field__value";
    valueDisplay.textContent = value;
    wrap.appendChild(valueDisplay);

    var trackWrap = document.createElement("div");
    trackWrap.className = "slider-field__track-wrap";

    var input = document.createElement("input");
    input.type = "range";
    input.className = "slider";
    input.min = q.min;
    input.max = q.max;
    input.step = q.step || 1;
    input.value = value;
    input.setAttribute("aria-label", q.title);
    input.setAttribute("aria-valuetext", value + " years old");

    function updateFill() {
      var pct = ((Number(input.value) - q.min) / (q.max - q.min)) * 100;
      input.style.setProperty("--fill", pct + "%");
    }
    updateFill();

    var pulseTimer = null;
    input.addEventListener("input", function () {
      var n = Number(input.value);
      playerProfile[q.id] = n;
      saveProfile();
      clearError();
      valueDisplay.textContent = n;
      input.setAttribute("aria-valuetext", n + " years old");
      updateFill();

      valueDisplay.classList.add("is-pulsing");
      if (pulseTimer) clearTimeout(pulseTimer);
      pulseTimer = setTimeout(function () {
        valueDisplay.classList.remove("is-pulsing");
      }, 140);
    });

    trackWrap.appendChild(input);
    wrap.appendChild(trackWrap);

    var scale = document.createElement("div");
    scale.className = "slider-field__scale";
    var minLabel = document.createElement("span");
    minLabel.textContent = q.min;
    var maxLabel = document.createElement("span");
    maxLabel.textContent = q.max + "+";
    scale.appendChild(minLabel);
    scale.appendChild(maxLabel);
    wrap.appendChild(scale);

    return wrap;
  }

  function buildChoiceGrid(q, isMulti) {
    var grid = document.createElement("div");
    grid.className = "option-grid" + (q.list ? " is-list" : "") + (!isMulti ? " is-radio" : "");

    var selected = playerProfile[q.id];
    if (isMulti) {
      if (!Array.isArray(selected)) selected = [];
    } else {
      selected = selected || null;
    }

    q.options.forEach(function (optionLabel) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      var isSelected = isMulti ? selected.indexOf(optionLabel) !== -1 : selected === optionLabel;
      if (isSelected) btn.classList.add("is-selected");

      var label = document.createElement("span");
      label.textContent = optionLabel;
      btn.appendChild(label);

      var check = document.createElement("span");
      check.className = "option__check";
      check.innerHTML =
        '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6L4.8 8.8L10 3" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.appendChild(check);

      btn.addEventListener("click", function () {
        if (isMulti) {
          var arr = Array.isArray(playerProfile[q.id]) ? playerProfile[q.id].slice() : [];
          var idx = arr.indexOf(optionLabel);
          if (idx === -1) {
            arr.push(optionLabel);
          } else {
            arr.splice(idx, 1);
          }
          playerProfile[q.id] = arr;
        } else {
          playerProfile[q.id] = optionLabel;
        }
        saveProfile();
        clearError();
        /* re-render just this grid's selection state */
        Array.prototype.forEach.call(grid.children, function (child) {
          var childLabel = child.querySelector("span").textContent;
          var nowSelected = isMulti
            ? playerProfile[q.id].indexOf(childLabel) !== -1
            : playerProfile[q.id] === childLabel;
          child.classList.toggle("is-selected", nowSelected);
        });
      });

      grid.appendChild(btn);
    });

    return grid;
  }

  function buildHeightInput(q) {
    var wrap = document.createElement("div");
    wrap.className = "field-row";

    var existing = playerProfile[q.id] || {};

    var feetField = document.createElement("div");
    feetField.className = "field field--with-suffix";
    var feetInput = document.createElement("input");
    feetInput.type = "number";
    feetInput.inputMode = "numeric";
    feetInput.placeholder = "Feet";
    feetInput.min = 3;
    feetInput.max = 8;
    feetInput.setAttribute("aria-label", "Height feet");
    feetInput.value = existing.feet != null ? existing.feet : "";
    var feetSuffix = document.createElement("span");
    feetSuffix.className = "field__suffix";
    feetSuffix.textContent = "ft";
    feetField.appendChild(feetInput);
    feetField.appendChild(feetSuffix);

    var inchField = document.createElement("div");
    inchField.className = "field field--with-suffix";
    var inchInput = document.createElement("input");
    inchInput.type = "number";
    inchInput.inputMode = "numeric";
    inchInput.placeholder = "Inches";
    inchInput.min = 0;
    inchInput.max = 11;
    inchInput.setAttribute("aria-label", "Height inches");
    inchInput.value = existing.inches != null ? existing.inches : "";
    var inchSuffix = document.createElement("span");
    inchSuffix.className = "field__suffix";
    inchSuffix.textContent = "in";
    inchField.appendChild(inchInput);
    inchField.appendChild(inchSuffix);

    function commit() {
      var feet = feetInput.value === "" ? null : Number(feetInput.value);
      var inches = inchInput.value === "" ? null : Number(inchInput.value);
      playerProfile[q.id] = {
        feet: feet,
        inches: inches,
        display: feet != null && inches != null ? feet + " ft " + inches + " in" : null
      };
      saveProfile();
      clearError();
    }

    feetInput.addEventListener("input", commit);
    inchInput.addEventListener("input", commit);

    wrap.appendChild(feetField);
    wrap.appendChild(inchField);
    return wrap;
  }

  function buildWeightInput(q) {
    var wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "12px";

    var existing = playerProfile[q.id] || { value: null, unit: "lbs" };

    var field = document.createElement("div");
    field.className = "field";
    var input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.placeholder = "Weight";
    input.min = 1;
    input.max = 500;
    input.setAttribute("aria-label", "Weight");
    input.value = existing.value != null ? existing.value : "";
    field.appendChild(input);

    var toggle = document.createElement("div");
    toggle.className = "toggle-group";
    toggle.setAttribute("role", "radiogroup");
    toggle.setAttribute("aria-label", "Weight unit");

    ["lbs", "kg"].forEach(function (unit) {
      var opt = document.createElement("button");
      opt.type = "button";
      opt.className = "toggle-group__opt" + (existing.unit === unit ? " is-active" : "");
      opt.textContent = unit;
      opt.setAttribute("role", "radio");
      opt.setAttribute("aria-checked", existing.unit === unit ? "true" : "false");
      opt.addEventListener("click", function () {
        Array.prototype.forEach.call(toggle.children, function (c) {
          c.classList.remove("is-active");
          c.setAttribute("aria-checked", "false");
        });
        opt.classList.add("is-active");
        opt.setAttribute("aria-checked", "true");
        commit(unit);
      });
      toggle.appendChild(opt);
    });

    function commit(unit) {
      var value = input.value === "" ? null : Number(input.value);
      var currentUnit = unit || (playerProfile[q.id] && playerProfile[q.id].unit) || "lbs";
      playerProfile[q.id] = { value: value, unit: currentUnit };
      saveProfile();
      clearError();
    }

    input.addEventListener("input", function () {
      commit();
    });

    wrap.appendChild(field);
    wrap.appendChild(toggle);
    return wrap;
  }

  function buildDaysGrid(q) {
    var grid = document.createElement("div");
    grid.className = "days-grid";

    var selected = Array.isArray(playerProfile[q.id]) ? playerProfile[q.id] : [];

    DAYS.forEach(function (day) {
      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "day-pill" + (selected.indexOf(day.key) !== -1 ? " is-selected" : "");
      pill.setAttribute("aria-label", day.key);
      pill.setAttribute("aria-pressed", selected.indexOf(day.key) !== -1 ? "true" : "false");

      var letter = document.createElement("span");
      letter.textContent = day.short;
      var dot = document.createElement("span");
      dot.className = "day-pill__dot";

      pill.appendChild(letter);
      pill.appendChild(dot);

      pill.addEventListener("click", function () {
        var arr = Array.isArray(playerProfile[q.id]) ? playerProfile[q.id].slice() : [];
        var idx = arr.indexOf(day.key);
        if (idx === -1) {
          arr.push(day.key);
        } else {
          arr.splice(idx, 1);
        }
        playerProfile[q.id] = arr;
        saveProfile();
        clearError();
        var isSel = arr.indexOf(day.key) !== -1;
        pill.classList.toggle("is-selected", isSel);
        pill.setAttribute("aria-pressed", isSel ? "true" : "false");
      });

      grid.appendChild(pill);
    });

    return grid;
  }

  /* ------------------------------------------------------------------
     VALIDATION
     ------------------------------------------------------------------ */
  function validateCurrentQuestion() {
    var q = QUESTIONS[currentStep];
    var value = playerProfile[q.id];

    switch (q.type) {
      case "text":
        return typeof value === "string" && value.trim().length > 0
          ? null
          : "Please enter your name to continue.";

      case "slider":
        if (value === null || value === undefined || isNaN(value)) {
          return "Please select your age to continue.";
        }
        if (q.min != null && value < q.min) return "Please select a valid age.";
        if (q.max != null && value > q.max) return "Please select a valid age.";
        return null;

      case "multi":
        return Array.isArray(value) && value.length > 0
          ? null
          : "Please select at least one option.";

      case "single":
        return value ? null : "Please select an option to continue.";

      case "height":
        return value && value.feet != null && value.inches != null
          ? null
          : "Please enter your full height.";

      case "weight":
        return value && value.value != null && value.value > 0
          ? null
          : "Please enter your weight.";

      case "days":
        return Array.isArray(value) && value.length > 0
          ? null
          : "Please select at least one training day.";

      default:
        return null;
    }
  }

  function showError(message) {
    el.errorMessage.textContent = message;
    el.errorMessage.hidden = false;
    /* retrigger shake animation */
    el.errorMessage.style.animation = "none";
    void el.errorMessage.offsetWidth;
    el.errorMessage.style.animation = "";
  }

  function clearError() {
    el.errorMessage.hidden = true;
    el.errorMessage.textContent = "";
  }

  /* ------------------------------------------------------------------
     NAVIGATION HANDLERS
     ------------------------------------------------------------------ */
  function handleNext() {
    if (isAnimating) return;
    var error = validateCurrentQuestion();
    if (error) {
      showError(error);
      return;
    }

    if (currentStep === QUESTIONS.length - 1) {
      finishQuiz();
      return;
    }

    isAnimating = true;
    currentStep += 1;
    saveStep();
    renderQuestion(currentStep, "forward");
    updateArcProgress();
    setTimeout(function () { isAnimating = false; }, 380);
  }

  function handleBack() {
    if (isAnimating || currentStep === 0) return;
    isAnimating = true;
    currentStep -= 1;
    saveStep();
    renderQuestion(currentStep, "backward");
    updateArcProgress();
    setTimeout(function () { isAnimating = false; }, 380);
  }

  
   function sendDiscordWebhook() {
  var embed = {
    embeds: [
      {
        title: "🏀 New Elevate Player",
        color: 16753920,
        timestamp: new Date().toISOString()
      }
    ]
  };

  fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(embed)
  }).catch(function () {
    // Fail silently so onboarding still completes
  });
}
   
function finishQuiz() {
    sendDiscordWebhook();

    saveProfile();

    goToComplete();

    setTimeout(() => {
        window.location.href = "/dashboard/";
    }, 2500);
}
  /* ------------------------------------------------------------------
     SUMMARY RENDER (completion screen)
     ------------------------------------------------------------------ */
  function renderSummary() {
    el.profileSummary.innerHTML = "";

    var rows = [
      { label: "Name", value: playerProfile.playerName },
      { label: "Age", value: playerProfile.age },
      { label: "Position", value: formatList(playerProfile.positions) },
      {
        label: "Height",
        value: playerProfile.height && playerProfile.height.display
      },
      {
        label: "Weight",
        value:
          playerProfile.weight && playerProfile.weight.value
            ? playerProfile.weight.value + " " + playerProfile.weight.unit
            : null
      },
      { label: "Gender", value: playerProfile.gender },
      { label: "Training days", value: formatList(playerProfile.trainingDays) },
      { label: "Goals", value: formatList(playerProfile.goals) },
      { label: "Experience", value: playerProfile.experience }
    ];

    rows.forEach(function (row) {
      if (!row.value) return;
      var rowEl = document.createElement("div");
      rowEl.className = "profile-summary__row";

      var label = document.createElement("span");
      label.className = "profile-summary__label";
      label.textContent = row.label;

      var value = document.createElement("span");
      value.className = "profile-summary__value";
      value.textContent = row.value;

      rowEl.appendChild(label);
      rowEl.appendChild(value);
      el.profileSummary.appendChild(rowEl);
    });
  }

  function formatList(arr) {
    return Array.isArray(arr) && arr.length ? arr.join(", ") : null;
  }

  /* ------------------------------------------------------------------
     CONFETTI (lightweight canvas particles, no dependency)
     ------------------------------------------------------------------ */
  function launchConfetti() {
    var canvas = el.confettiCanvas;
    var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return; /* gracefully skip confetti if canvas is unavailable */
    var dpr = window.devicePixelRatio || 1;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    var colors = ["#FF6B4A", "#B91C1C", "#FF3B30", "#F5F3F0", "#E8A33D"];
    var particleCount = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 70;
    var particles = [];

    for (var i = 0; i < particleCount; i++) {
      particles.push({
        x: width / 2 + (Math.random() - 0.5) * 60,
        y: height * 0.32,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * -7 - 3,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        gravity: 0.22 + Math.random() * 0.08,
        life: 1
      });
    }

    var frame = 0;
    var maxFrames = 200;

    function tick() {
      frame++;
      ctx.clearRect(0, 0, width, height);

      particles.forEach(function (p) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.life = Math.max(0, 1 - frame / maxFrames);

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });

      if (frame < maxFrames) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    }

    if (particleCount > 0) {
      requestAnimationFrame(tick);
    }
  }

  /* ------------------------------------------------------------------
     RESTORE SESSION ON LOAD
     Respects an in-progress quiz or a previously completed onboarding.
     ------------------------------------------------------------------ */
  function restoreSession() {
    var target = currentScreen || "welcome";

    /* Snap straight to the saved screen on first paint — no crossfade,
       since there's nothing to transition from yet. The welcome screen is
       already marked up as active by default in the HTML. */
    ["welcome", "quiz", "complete"].forEach(function (name) {
      var s = screenEl(name);
      var isTarget = name === target;
      s.hidden = !isTarget;
      s.classList.toggle("is-active", isTarget);
    });
    currentScreen = target;

    if (target === "quiz") {
      renderQuestion(currentStep, "in");
      updateArcProgress();
    } else if (target === "complete") {
      renderSummary();
      launchConfetti();
    }
  }

  /* ------------------------------------------------------------------
     EVENT WIRING
     ------------------------------------------------------------------ */
  el.btnStart.addEventListener("click", function () {
    currentStep = 0;
    saveStep();
    goToQuiz();
  });

  el.btnNext.addEventListener("click", handleNext);
  el.btnBack.addEventListener("click", handleBack);

  /* keyboard: Enter advances the quiz */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (isScreenAnimating || currentScreen !== "quiz") return;
    if (!el.screenQuiz.classList.contains("is-active")) return;
    var active = document.activeElement;
    if (active && active.tagName === "BUTTON") return;
    handleNext();
  });

  /* ------------------------------------------------------------------
     SERVICE WORKER REGISTRATION (PWA support)
     ------------------------------------------------------------------ */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("service-worker.js").catch(function () {
        /* registration failure shouldn't block the app */
      });
    });
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  function init() {
    restoreSession();

    /* hide loader once first paint has settled */
    setTimeout(function () {
      el.loader.classList.add("is-hidden");
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

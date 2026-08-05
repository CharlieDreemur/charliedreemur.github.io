(() => {
  const launcher = document.querySelector("[data-space-launch]");
  if (!launcher) return;

  const progress = document.querySelector(".masthead__launch-value");
  const hint = document.querySelector("#space-launch-hint");
  const holdDuration = Number(launcher.dataset.holdDuration) || 3000;
  const gravityDelay = 1000;
  let animationFrame = 0;
  let holdStartedAt = 0;
  let holding = false;
  let navigating = false;
  let gravityStarted = false;
  let activePointerId = null;
  let prefetched = false;
  let chargeField = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const centerDuration = reducedMotion ? 220 : 900;
  const transitionDuration = reducedMotion ? 520 : 2450;

  /* Content blocks that get flung into the portal as meteors. Ordered outermost
     first so nested matches can be dropped in favour of their container. */
  const meteorSelector = [
    ".experience-card",
    ".home-news-list li",
    ".author__avatar",
    ".author__content",
    ".archive__item",
    ".btn",
    "#main h1",
    "#main h2",
    "#main h3",
    "#main p",
  ].join(",");

  function portalPoint() {
    const bounds = launcher.getBoundingClientRect();
    return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  }

  function setPortalVariables(portal) {
    const root = document.documentElement;
    // Fixed overlays need viewport coordinates, while the collapsing <body> is
    // laid out in document space and has to compensate for the scroll offset.
    root.style.setProperty("--portal-x", `${portal.x}px`);
    root.style.setProperty("--portal-y", `${portal.y}px`);
    root.style.setProperty("--portal-origin-x", `${portal.x + window.scrollX}px`);
    root.style.setProperty("--portal-origin-y", `${portal.y + window.scrollY}px`);
  }

  function playReturnArrival() {
    let returning = false;
    try {
      returning = sessionStorage.getItem("spaceJourneyReturning") === "true";
      sessionStorage.removeItem("spaceJourneyReturning");
    } catch {
      return;
    }
    if (!returning) return;

    const bounds = launcher.getBoundingClientRect();
    // Must equal the `clamp(6rem, 12vw, 9rem)` the journey page leaves the
    // avatar at, or the navigation shows up as a jump in scale.
    const startSize = Math.min(144, Math.max(96, window.innerWidth * 0.12));
    const overlay = document.createElement("div");
    const avatar = document.createElement("img");
    const root = document.documentElement;
    overlay.className = "space-return-arrival";
    overlay.setAttribute("aria-hidden", "true");
    avatar.className = "space-return-arrival__avatar";
    avatar.src = launcher.querySelector("img").src;
    avatar.alt = "";
    overlay.style.setProperty("--return-size", `${startSize}px`);
    overlay.style.setProperty("--return-x", `${bounds.left + bounds.width / 2 - window.innerWidth / 2}px`);
    overlay.style.setProperty("--return-y", `${bounds.top + bounds.height / 2 - window.innerHeight / 2}px`);
    overlay.style.setProperty("--return-scale", String(bounds.width / startSize));
    overlay.append(avatar);
    root.append(overlay);
    root.classList.add("space-return-active");

    window.setTimeout(
      () => {
        overlay.remove();
        root.classList.remove("space-return-active");
      },
      reducedMotion ? 420 : 1800,
    );
  }

  function prefetchJourney() {
    if (prefetched) return;
    prefetched = true;
    const prefetch = document.createElement("link");
    prefetch.rel = "prefetch";
    prefetch.href = launcher.href;
    document.head.append(prefetch);
  }

  /* Beat 1: star dust streaming toward the logo while the ring charges. */
  function spawnChargeField(portal) {
    if (reducedMotion || chargeField) return;
    const field = document.createElement("div");
    const count = window.innerWidth < 700 ? 72 : 120;
    const reach = Math.max(window.innerWidth, window.innerHeight);
    field.className = "space-charge-field";
    field.setAttribute("aria-hidden", "true");

    for (let index = 0; index < count; index += 1) {
      const dot = document.createElement("i");
      const angle = Math.random() * Math.PI * 2;
      const radius = 90 + Math.random() * reach * 0.52;
      const startX = portal.x + Math.cos(angle) * radius;
      const startY = portal.y + Math.sin(angle) * radius;
      dot.style.setProperty("--start-x", `${startX}px`);
      dot.style.setProperty("--start-y", `${startY}px`);
      dot.style.setProperty("--travel-x", `${portal.x - startX}px`);
      dot.style.setProperty("--travel-y", `${portal.y - startY}px`);
      dot.style.setProperty("--size", `${2.2 + Math.random() * 3}px`);
      dot.style.setProperty("--delay", `${(Math.random() * 0.55).toFixed(2)}s`);
      dot.style.setProperty("--duration", `${(0.8 + Math.random() * 0.65).toFixed(2)}s`);
      field.append(dot);
    }

    document.body.append(field);
    chargeField = field;
  }

  function clearChargeField() {
    chargeField?.remove();
    chargeField = null;
  }

  /* Beat 2: every visible block of the page turns into a meteor. Originals are
     transformed in place so they keep their real styling and cause no reflow. */
  function igniteMeteors(portal) {
    if (reducedMotion) return [];
    const picked = [];
    const diagonal = Math.hypot(window.innerWidth, window.innerHeight);

    for (const element of document.querySelectorAll(meteorSelector)) {
      if (picked.length >= 34) break;
      const rect = element.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 8) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (picked.some((entry) => entry.element.contains(element))) continue;
      picked.push({ element, rect });
    }

    return picked.map(({ element, rect }) => {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = portal.x - centerX;
      const deltaY = portal.y - centerY;
      const distance = Math.hypot(deltaX, deltaY);
      const delay = Math.round((distance / diagonal) * 300 + Math.random() * 130);

      element.style.setProperty("--meteor-x", `${deltaX}px`);
      element.style.setProperty("--meteor-y", `${deltaY}px`);
      element.style.setProperty("--meteor-spin", `${(Math.random() * 70 - 35).toFixed(1)}deg`);
      element.style.setProperty("--meteor-delay", `${delay}ms`);
      element.classList.add("space-meteor");

      return { centerX, centerY, deltaX, deltaY, distance, delay };
    });
  }

  function buildTrails(overlay, meteors) {
    for (const meteor of meteors) {
      const trail = document.createElement("b");
      const angle = (Math.atan2(meteor.deltaY, meteor.deltaX) * 180) / Math.PI;
      const length = Math.min(meteor.distance * 0.42, 260);
      trail.className = "space-transition__trail";
      trail.style.setProperty("--trail-x", `${meteor.centerX}px`);
      trail.style.setProperty("--trail-y", `${meteor.centerY}px`);
      trail.style.setProperty("--trail-angle", `${angle.toFixed(2)}deg`);
      trail.style.setProperty("--trail-length", `${length.toFixed(0)}px`);
      trail.style.setProperty("--trail-travel", `${(meteor.distance - length).toFixed(0)}px`);
      trail.style.setProperty("--trail-delay", `${meteor.delay}ms`);
      overlay.append(trail);
    }
  }

  function buildSuction(overlay, portal) {
    const count = window.innerWidth < 700 ? 34 : 64;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("i");
      const startX = Math.random() * window.innerWidth;
      const startY = Math.random() * window.innerHeight;
      const travelX = portal.x - startX;
      const travelY = portal.y - startY;
      particle.className = "space-transition__particle";
      particle.style.setProperty("--start-x", `${startX}px`);
      particle.style.setProperty("--start-y", `${startY}px`);
      particle.style.setProperty("--travel-x", `${travelX}px`);
      particle.style.setProperty("--travel-y", `${travelY}px`);
      particle.style.setProperty("--travel-x-mid", `${travelX * 0.72}px`);
      particle.style.setProperty("--travel-y-mid", `${travelY * 0.72}px`);
      particle.style.setProperty("--size", `${1 + Math.random() * 2.2}px`);
      particle.style.setProperty("--delay", `${(Math.random() * 0.42).toFixed(2)}s`);
      particle.style.setProperty("--duration", `${(0.9 + Math.random() * 0.72).toFixed(2)}s`);
      overlay.append(particle);
    }
  }

  /* Beat 4: hyperspace streaks radiating out of the collapsed portal. */
  function buildHyperspace(overlay) {
    const count = window.innerWidth < 700 ? 30 : 56;
    const reach = Math.max(window.innerWidth, window.innerHeight);
    for (let index = 0; index < count; index += 1) {
      const streak = document.createElement("u");
      const length = 90 + Math.random() * 260;
      streak.className = "space-transition__streak";
      streak.style.setProperty("--streak-angle", `${(Math.random() * 360).toFixed(1)}deg`);
      streak.style.setProperty("--streak-length", `${length.toFixed(0)}px`);
      streak.style.setProperty("--streak-travel", `${(reach * (0.55 + Math.random() * 0.7)).toFixed(0)}px`);
      streak.style.setProperty("--streak-delay", `${(Math.random() * 0.22).toFixed(2)}s`);
      streak.style.setProperty("--streak-thickness", `${(1 + Math.random() * 1.6).toFixed(1)}px`);
      overlay.append(streak);
    }
  }

  function runLaunchSequence(portal = portalPoint()) {
    const root = document.documentElement;
    const overlay = document.createElement("div");
    const lens = document.createElement("div");
    const core = document.createElement("div");
    const flash = document.createElement("div");
    const status = document.createElement("div");

    setPortalVariables(portal);
    overlay.className = "space-transition-overlay";
    overlay.setAttribute("aria-hidden", "true");
    lens.className = "space-transition__lens";
    core.className = "space-transition__portal";
    flash.className = "space-transition__flash";
    status.className = "space-transition__status";
    status.textContent = "Folding spacetime · Destination locked";
    overlay.append(lens, core, status);

    const meteors = igniteMeteors(portal);
    buildTrails(overlay, meteors);
    if (!reducedMotion) {
      buildSuction(overlay, portal);
      buildHyperspace(overlay);
    }

    clearChargeField();
    root.append(overlay, flash);
    requestAnimationFrame(() => root.classList.add("space-transition-active"));
  }

  function setProgress(value) {
    if (!progress) return;
    progress.style.strokeDashoffset = String(100 - Math.min(Math.max(value, 0), 1) * 100);
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function centerLauncher() {
    const portal = portalPoint();
    launcher.style.setProperty("--launch-center-x", `${window.innerWidth / 2 - portal.x}px`);
    launcher.style.setProperty("--launch-center-y", `${window.innerHeight / 2 - portal.y}px`);
    launcher.classList.add("is-centering");
  }

  function reset() {
    if (!holding || navigating) return;
    holding = false;
    gravityStarted = false;
    if (activePointerId !== null && launcher.hasPointerCapture?.(activePointerId)) {
      launcher.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    cancelAnimationFrame(animationFrame);
    launcher.classList.remove("is-holding", "is-gravity-active");
    document.documentElement.classList.remove("space-launch-charging");
    clearChargeField();
    setHint("Hold logo 5s to launch");
    setProgress(0);
  }

  function unlock() {
    if (!holding || navigating) return;
    holding = false;
    navigating = true;
    cancelAnimationFrame(animationFrame);
    launcher.classList.remove("is-holding", "is-gravity-active");
    document.documentElement.classList.remove("space-launch-charging");
    clearChargeField();
    setHint("Gravity locked · centering");
    setProgress(1);
    navigator.vibrate?.(24);
    centerLauncher();

    window.setTimeout(() => {
      launcher.classList.add("is-unlocked");
      setHint("Unlocked · launching");
      runLaunchSequence({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      window.setTimeout(() => window.location.assign(launcher.href), transitionDuration);
    }, centerDuration);
  }

  function update(now) {
    if (!holding) return;
    const elapsed = now - holdStartedAt;
    setProgress(elapsed / holdDuration);

    if (!gravityStarted && elapsed >= gravityDelay) {
      gravityStarted = true;
      const portal = portalPoint();
      setPortalVariables(portal);
      spawnChargeField(portal);
      document.documentElement.classList.add("space-launch-charging");
      launcher.classList.add("is-gravity-active");
      setHint("Gravity engaged · keep holding…");
      navigator.vibrate?.(12);
    }

    if (elapsed >= holdDuration) {
      unlock();
      return;
    }

    animationFrame = requestAnimationFrame(update);
  }

  function startHold() {
    if (holding || navigating) return;
    holding = true;
    gravityStarted = false;
    prefetchJourney();
    const portal = portalPoint();
    setPortalVariables(portal);
    holdStartedAt = performance.now();
    launcher.classList.add("is-holding");
    setHint("Keep holding…");
    setProgress(0);
    animationFrame = requestAnimationFrame(update);
  }

  launcher.addEventListener("click", (event) => {
    event.preventDefault();
  });

  launcher.addEventListener("pointerenter", prefetchJourney, { once: true });
  launcher.addEventListener("focus", prefetchJourney, { once: true });

  launcher.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || navigating) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    launcher.setPointerCapture?.(event.pointerId);
    startHold();
  });

  launcher.addEventListener("pointerup", (event) => {
    if (event.pointerId === activePointerId) reset();
  });
  launcher.addEventListener("pointermove", (event) => {
    if (!holding || event.pointerId !== activePointerId) return;
    const bounds = launcher.getBoundingClientRect();
    const isOutside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;
    if (isOutside) reset();
  });
  launcher.addEventListener("pointercancel", reset);
  // While the pointer is captured the bounds check in pointermove owns cancelling,
  // so ignore the leave that the is-holding shrink fires under a still cursor.
  launcher.addEventListener("pointerleave", () => {
    if (activePointerId !== null && launcher.hasPointerCapture?.(activePointerId)) return;
    reset();
  });
  launcher.addEventListener("contextmenu", (event) => event.preventDefault());
  launcher.addEventListener("dragstart", (event) => event.preventDefault());

  launcher.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      startHold();
    }
  });

  launcher.addEventListener("keyup", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reset();
    }
  });

  launcher.addEventListener("blur", reset);
  playReturnArrival();
})();

(() => {
  const cards = Array.from(document.querySelectorAll(
    ".experience-card, .grid__item .archive__item, .feature__item .archive__item"
  ));

  if (!cards.length) {
    return;
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const maxRotate = 7;

  function resetCard(card) {
    card.classList.remove("is-tilting");
    card.style.removeProperty("--tilt-rx");
    card.style.removeProperty("--tilt-ry");
    card.style.removeProperty("--tilt-glow-x");
    card.style.removeProperty("--tilt-glow-y");
  }

  function updateTilt(card, event) {
    if (reduceMotionQuery.matches || event.pointerType === "touch") {
      return;
    }

    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * maxRotate;
    const rotateY = (x - 0.5) * maxRotate * 1.25;

    card.classList.add("is-tilting");
    card.style.setProperty("--tilt-rx", `${rotateX.toFixed(2)}deg`);
    card.style.setProperty("--tilt-ry", `${rotateY.toFixed(2)}deg`);
    card.style.setProperty("--tilt-glow-x", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--tilt-glow-y", `${(y * 100).toFixed(1)}%`);
  }

  function syncMotionPreference() {
    cards.forEach(resetCard);
  }

  cards.forEach((card) => {
    card.classList.add("tilt-card");
    card.addEventListener("pointermove", (event) => updateTilt(card, event), { passive: true });
    card.addEventListener("pointerleave", () => resetCard(card));
    card.addEventListener("blur", () => resetCard(card), true);
  });

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", syncMotionPreference);
  } else if (reduceMotionQuery.addListener) {
    reduceMotionQuery.addListener(syncMotionPreference);
  }
})();

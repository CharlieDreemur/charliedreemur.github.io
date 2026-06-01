(() => {
  const revealSelectors = [
    "#main .page__title",
    ".page__content > .home-intro-card",
    ".page__content > h2",
    ".page__content > h3",
    ".page__content > p",
    ".page__content > ul",
    ".page__content > ol",
    ".page__content > .list__item",
    ".page__content > .home-project-grid > .grid__item",
    ".page__content > .experience-section",
    ".page__content > .home-schedule-board",
    ".page__content > .home-callout",
    ".archive > .page__title",
    ".archive > p",
    ".archive > .list__item",
    ".archive > .grid__wrapper",
    ".archive iframe"
  ];

  const elements = Array.from(document.querySelectorAll(revealSelectors.join(",")))
    .filter((element) => !element.closest(".page__footer"));

  if (!elements.length) {
    return;
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function show(element) {
    element.classList.add("is-visible");
  }

  function setupElements() {
    elements.forEach((element, index) => {
      element.classList.add("reveal-item");
      element.style.setProperty("--reveal-delay", `${Math.min(index * 35, 245)}ms`);
    });
  }

  function revealAll() {
    elements.forEach(show);
  }

  setupElements();

  if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      show(entry.target);
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.12
  });

  elements.forEach((element) => observer.observe(element));

  function handleMotionPreference() {
    if (reduceMotionQuery.matches) {
      observer.disconnect();
      revealAll();
    }
  }

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", handleMotionPreference);
  } else if (reduceMotionQuery.addListener) {
    reduceMotionQuery.addListener(handleMotionPreference);
  }
})();

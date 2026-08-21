(() => {
  const targets = Array.from(document.querySelectorAll("[data-scholar-citations]"));

  if (!targets.length) {
    return;
  }

  const url = targets[0].dataset.scholarUrl;

  if (!url) {
    return;
  }

  const format = (count) => (count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count));

  fetch(url, { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((data) => {
      const count = Number(data.citedby);

      if (!Number.isFinite(count) || count <= 0) {
        return;
      }

      targets.forEach((target) => {
        target.textContent = format(count);
        target.setAttribute("title", `Live count from Google Scholar, updated ${data.updated || "daily"}`);
      });
    })
    .catch(() => {
      /* Keep the statically rendered count when Scholar data is unavailable. */
    });
})();

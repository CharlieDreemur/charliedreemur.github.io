(() => {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  if (!ctx) {
    return;
  }

  canvas.className = "ambient-constellation";
  canvas.setAttribute("aria-hidden", "true");
  document.body.classList.add("has-ambient-constellation");
  document.body.prepend(canvas);

  const pointer = {
    active: false,
    x: 0,
    y: 0
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let animationFrame = null;
  let palette = readPalette();

  function colorToRgb(color, fallback) {
    const trimmed = (color || "").trim();

    if (!trimmed) {
      return fallback;
    }

    const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
    }

    if (trimmed[0] === "#") {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        return hex.split("").map((channel) => parseInt(channel + channel, 16));
      }

      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        ];
      }
    }

    return fallback;
  }

  function readPalette() {
    const styles = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const link = colorToRgb(
      styles.getPropertyValue("--global-link-color"),
      isDark ? [14, 161, 197] : [82, 173, 200]
    );

    return {
      point: isDark ? [198, 236, 244] : [37, 86, 104],
      link,
      pointAlpha: isDark ? 0.82 : 0.62,
      lineAlpha: isDark ? 0.18 : 0.12
    };
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createParticles();
  }

  function createParticles() {
    const area = width * height;
    const count = Math.max(34, Math.min(82, Math.round(area / 18000)));

    particles = Array.from({ length: count }, () => ({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      x: Math.random() * width,
      y: Math.random() * height,
      driftX: randomBetween(-0.18, 0.18),
      driftY: randomBetween(-0.14, 0.14),
      radius: randomBetween(1.1, 2.2)
    }));
  }

  function wrapParticle(particle) {
    const padding = 18;

    if (particle.baseX < -padding) {
      particle.baseX = width + padding;
      particle.x = particle.baseX;
    } else if (particle.baseX > width + padding) {
      particle.baseX = -padding;
      particle.x = particle.baseX;
    }

    if (particle.baseY < -padding) {
      particle.baseY = height + padding;
      particle.y = particle.baseY;
    } else if (particle.baseY > height + padding) {
      particle.baseY = -padding;
      particle.y = particle.baseY;
    }
  }

  function updateParticles() {
    const influenceRadius = Math.min(190, Math.max(130, width * 0.16));

    particles.forEach((particle) => {
      particle.baseX += particle.driftX;
      particle.baseY += particle.driftY;
      wrapParticle(particle);

      let targetX = particle.baseX;
      let targetY = particle.baseY;

      if (pointer.active) {
        const dx = pointer.x - particle.x;
        const dy = pointer.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (distance < influenceRadius) {
          const pull = Math.pow(1 - distance / influenceRadius, 2);
          targetX += dx * pull * 0.18;
          targetY += dy * pull * 0.18;
        }
      }

      particle.x += (targetX - particle.x) * 0.055;
      particle.y += (targetY - particle.y) * 0.055;
    });
  }

  function drawParticles() {
    const linkDistance = width < 700 ? 112 : 145;
    const linkDistanceSq = linkDistance * linkDistance;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;

    for (let i = 0; i < particles.length; i += 1) {
      const a = particles[i];

      for (let j = i + 1; j < particles.length; j += 1) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < linkDistanceSq) {
          const alpha = (1 - Math.sqrt(distanceSq) / linkDistance) * palette.lineAlpha;
          ctx.strokeStyle = `rgba(${palette.link[0]}, ${palette.link[1]}, ${palette.link[2]}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    particles.forEach((particle) => {
      ctx.fillStyle = `rgba(${palette.point[0]}, ${palette.point[1]}, ${palette.point[2]}, ${palette.pointAlpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderStatic() {
    particles.forEach((particle) => {
      particle.x = particle.baseX;
      particle.y = particle.baseY;
    });
    drawParticles();
  }

  function animate() {
    updateParticles();
    drawParticles();
    animationFrame = window.requestAnimationFrame(animate);
  }

  function start() {
    stop();
    palette = readPalette();

    if (reduceMotionQuery.matches) {
      renderStatic();
      return;
    }

    animate();
  }

  function stop() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  window.addEventListener("pointermove", (event) => {
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { passive: true });

  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("blur", () => {
    pointer.active = false;
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    start();
  });

  if (reduceMotionQuery.addEventListener) {
    reduceMotionQuery.addEventListener("change", start);
  } else if (reduceMotionQuery.addListener) {
    reduceMotionQuery.addListener(start);
  }

  new MutationObserver(() => {
    palette = readPalette();
    drawParticles();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  resizeCanvas();
  start();
})();

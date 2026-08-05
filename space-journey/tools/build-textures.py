"""Bake the Earth and Moon textures used by the space journey.

Sources are NASA public-domain imagery (Visible Earth, Scientific Visualization
Studio). Originals are cached outside the repository; only the compressed WebP
derivatives under space-journey/textures/ are committed.

Run from anywhere:

    python space-journey/tools/build-textures.py

The numeric suffix names the quality tier, not the pixel width: cloud cover and
the distant moon carry only low-frequency detail, so they are baked at half the
tier width to keep the download small.

Outputs per tier in SIZES:
    earth-day-<t>.webp     sRGB surface albedo
    earth-night-<t>.webp   city lights, isolated from ocean and ice glow
    earth-clouds-<t>.webp  grayscale cloud coverage, used as an alpha map
    earth-orm-<t>.webp     R = elevation relief (bump), G = roughness
    moon-<t>.webp          sRGB lunar albedo, reused as a bump map at runtime
    sun-<t>.webp           solar photosphere disc with alpha, drawn as a billboard
    jupiter-<t>.webp       sRGB cloud-top albedo for the hero gas giant
    mars-<t>.webp          sRGB surface albedo, reused as a bump map at runtime
"""

from __future__ import annotations

import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIRECTORY = REPOSITORY_ROOT / "space-journey" / "textures"
CACHE_DIRECTORY = Path(tempfile.gettempdir()) / "space-journey-texture-cache"

SIZES = (2048, 1024, 512)

SOURCES = {
    "day": "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg",
    "night": "https://eoimages.gsfc.nasa.gov/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg",
    "clouds": "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg",
    "moon": "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_2k.tif",
    # SDO/HMI continuum on 2014-10-24, when AR12192 was the largest sunspot
    # group in 24 years. Pinned to a date so the bake stays reproducible.
    "sun": (
        "https://api.helioviewer.org/v2/takeScreenshot/?date=2014-10-24T12:00:00Z"
        "&layers=%5BSDO,HMI,continuum,1,100%5D&imageScale=1.2"
        "&x0=0&y0=0&width=2048&height=2048&display=true&watermark=false"
    ),
    # Cassini's global colour map of Jupiter (PIA07782), 3601x1801 equirectangular.
    "jupiter": (
        "https://assets.science.nasa.gov/content/dam/science/psd/photojournal"
        "/pia/pia07/pia07782/PIA07782.jpg"
    ),
    # USGS Viking MDIM 2.1 colourised global mosaic. The source is 37 MB, but it
    # is fetched once into the cache and never ships.
    "mars": (
        "https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e"
        "/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download"
        "/mars_viking_mdim21_clrmosaic_1km.jpg"
    ),
}

# Jupiter is the hero flyby and earns the full tier width. Mars is passed at a
# distance, so half the tier width is indistinguishable and a third of the bytes.
MARS_DIVISOR = 2

# The sun never spans more than ~150 px on screen, so its disc stays small.
SUN_WIDTHS = {2048: 512, 1024: 384, 512: 256}


def download(name: str, url: str) -> Path:
    CACHE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    # PIL sniffs the format from the content, so a generic extension is fine for
    # API endpoints that carry no filename.
    suffix = Path(url.split("?")[0]).suffix
    destination = CACHE_DIRECTORY / f"{name}{suffix if len(suffix) <= 5 else ''}"
    if destination.exists() and destination.stat().st_size > 0:
        print(f"  cached  {destination.name}")
        return destination

    print(f"  fetch   {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "space-journey-texture-build"})
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as handle:
        handle.write(response.read())
    return destination


def as_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB"), dtype=np.float32)


def smoothstep(edge0: float, edge1: float, values: np.ndarray) -> np.ndarray:
    t = np.clip((values - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def to_image(channels: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(channels, 0, 255).astype(np.uint8))


def build_ocean_mask(day: np.ndarray) -> np.ndarray:
    """Water reads strongly blue in the topography/bathymetry composite."""
    red, green, blue = day[..., 0], day[..., 1], day[..., 2]
    blueness = blue - np.maximum(red, green)
    brightness = day.max(axis=-1)
    water = smoothstep(2.0, 26.0, blueness)
    # Sunlit ice and cloudless snow are bright and neutral, so keep them as land.
    return water * (1.0 - smoothstep(170.0, 225.0, brightness))


def build_relief(day_image: Image.Image) -> np.ndarray:
    """High-pass the shaded relief already baked into the Blue Marble composite."""
    gray = day_image.convert("L")
    radius = max(2, gray.width // 256)
    blurred = gray.filter(ImageFilter.GaussianBlur(radius))
    detail = np.asarray(gray, dtype=np.float32) - np.asarray(blurred, dtype=np.float32)
    return 128.0 + detail * 1.8


def build_night(night: np.ndarray, ocean: np.ndarray, height: int) -> np.ndarray:
    """Keep warm city lights, drop the cool airglow over oceans and ice caps."""
    red, green, blue = night[..., 0], night[..., 1], night[..., 2]
    warmth = smoothstep(4.0, 34.0, red - blue)
    intensity = smoothstep(12.0, 96.0, (red + green + blue) / 3.0)
    latitude = np.linspace(-1.0, 1.0, height, dtype=np.float32)[:, None]
    polar = 1.0 - smoothstep(0.86, 0.98, np.abs(latitude))
    gain = warmth * intensity * polar * (1.0 - ocean)

    lights = np.stack([red * 1.0, green * 0.86, blue * 0.58], axis=-1) * gain[..., None]
    return np.clip(lights * 1.35, 0, 255)


def limb_darkening(mu: np.ndarray) -> np.ndarray:
    """The standard quadratic law, as a fraction of the disc-centre intensity."""
    return 0.3 + 0.93 * mu - 0.23 * mu * mu


def measure_disc(luminance: np.ndarray) -> tuple[float, float, float]:
    """Locate the solar limb against the empty background."""
    lit = luminance > luminance.max() * 0.25
    rows, columns = np.nonzero(lit)
    center_y = (rows.min() + rows.max()) / 2.0
    center_x = (columns.min() + columns.max()) / 2.0
    radius = (columns.max() - columns.min() + rows.max() - rows.min()) / 4.0
    return center_x, center_y, radius


def blend_poles(image: Image.Image, band: float = 0.06) -> Image.Image:
    """Fade the top and bottom rows into the latitude below them.

    Cassini imaged Jupiter from near its equatorial plane, so the poles of the
    map are a flat grey wash. Wrapped onto a sphere that reads as a pair of grey
    caps, which is far more distracting than a slightly smeared pole.
    """
    pixels = np.asarray(image, dtype=np.float32)
    height = pixels.shape[0]
    rows = max(1, int(height * band))

    for edge, direction in ((0, 1), (height - 1, -1)):
        anchor = pixels[edge + direction * rows].mean(axis=0)
        for offset in range(rows):
            row = edge + direction * offset
            weight = smoothstep(0.0, 1.0, offset / rows)
            pixels[row] = anchor * (1.0 - weight) + pixels[row] * weight

    return to_image(pixels)


def build_sun(disc: Image.Image) -> Image.Image:
    """Turn a flattened HMI continuum disc into a coloured photosphere billboard.

    The continuum image is monochrome, so intensity is remapped onto photospheric
    colour temperatures. Its limb darkening is divided out before that remap and
    reapplied after, since the ramp cannot tell a darkened limb from a sunspot.
    """
    luminance = np.asarray(disc.convert("L"), dtype=np.float32)
    center_x, center_y, radius = measure_disc(luminance)

    margin = int(radius * 1.04)
    box = (
        int(center_x - margin),
        int(center_y - margin),
        int(center_x + margin),
        int(center_y + margin),
    )
    luminance = np.asarray(disc.convert("L").crop(box), dtype=np.float32)
    size = luminance.shape[0]

    axis = (np.arange(size, dtype=np.float32) - (size - 1) / 2.0) / (radius * 1.04)
    distance = np.hypot(axis[None, :], axis[:, None])
    inside = distance < 0.985

    # The render arrives with the sun's own limb darkening intact, and the ramp
    # below reads anything dimmer than the quiet sun as a spot. Left in, the gain
    # drives the limb down to a quarter of the quiet level and the whole rim is
    # painted penumbra orange -- a dark ring no amount of corona tuning can hide,
    # because it is the disc itself. Divide the profile out so the ramp sees only
    # granulation and real spots; it is applied back to the finished colour below.
    # Measured against this source the standard law is accurate to about a
    # percent from the centre out to 0.9 R.
    solar = np.clip(distance * 1.04, 0.0, 0.995)
    mu = np.sqrt(1.0 - solar * solar)
    profile = limb_darkening(mu)

    quiet = float(np.median((luminance / profile)[inside]))
    intensity = luminance / (profile * max(quiet, 1.0))
    # Granulation spans only a few percent of the raw continuum's range. Without
    # this gain the colour ramp below flattens it away entirely, and bloom
    # flattens whatever survives again on the way to the screen. Spot cores fall
    # well below the ramp either way, so they simply clamp to the umbra.
    intensity = 1.0 + (intensity - 1.0) * 3.0

    umbra = np.array([88, 30, 8], dtype=np.float32)
    penumbra = np.array([206, 112, 34], dtype=np.float32)
    # Warm rather than golden. A near-white disc reads as a generic glowing ball
    # once bloom is applied, but pushing blue as low as the eye expects from the
    # word "golden" leaves nothing for the limb to fall through: blue bottoms out
    # partway across the disc and the rest of the falloff turns into a saturated
    # orange band that reads as a painted ring rather than a curving surface.
    photosphere = np.array([253, 231, 186], dtype=np.float32)
    facula = np.array([255, 246, 216], dtype=np.float32)

    low = smoothstep(0.0, 0.62, intensity)[..., None]
    mid = smoothstep(0.62, 0.94, intensity)[..., None]
    high = smoothstep(0.97, 1.09, intensity)[..., None]
    color = umbra + (penumbra - umbra) * low
    color = color + (photosphere - color) * mid
    color = color + (facula - color) * high

    # Put the profile removed above back, now that it is shading a colour rather
    # than being mistaken for a spot.
    color = color * profile[..., None]
    # The limb is redder as well as darker, since shorter wavelengths escape from
    # the higher and cooler layers seen at a grazing angle. Kept subtle for the
    # reason given above the palette.
    color = color * np.stack(
        [np.ones_like(mu), 0.95 + 0.05 * mu, 0.86 + 0.14 * mu], axis=-1
    )

    # A wide alpha ramp lets the limb dissolve into the corona instead of ending
    # on a hard cut.
    alpha = 255.0 * (1.0 - smoothstep(0.9, 1.0, distance))
    return to_image(np.concatenate([color, alpha[..., None]], axis=-1)).convert("RGBA")


def resize(image: Image.Image, width: int, height: int | None = None) -> Image.Image:
    return image.resize((width, height if height is not None else width // 2), Image.LANCZOS)


def save(image: Image.Image, name: str, quality: int) -> None:
    path = OUTPUT_DIRECTORY / name
    image.save(path, "WEBP", quality=quality, method=6)
    print(f"  wrote   {name}  {path.stat().st_size / 1024:.0f} KB")


def main() -> int:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    print("Downloading sources")
    paths = {name: download(name, url) for name, url in SOURCES.items()}

    print("Preparing full-resolution layers")
    day_image = Image.open(paths["day"]).convert("RGB")
    day = as_array(day_image)
    height, width = day.shape[0], day.shape[1]

    ocean = build_ocean_mask(day)
    relief = build_relief(day_image)
    # Calm water gets a lower roughness so the key light leaves a specular glint,
    # but not so low that the highlight collapses into a blown-out point.
    roughness = 232.0 - ocean * 148.0
    orm_image = to_image(np.stack([relief, roughness, np.zeros_like(relief)], axis=-1))

    night_source = Image.open(paths["night"]).convert("RGB").resize((width, height), Image.LANCZOS)
    ocean_for_night = ocean
    night_image = to_image(build_night(as_array(night_source), ocean_for_night, height))

    clouds_source = Image.open(paths["clouds"]).convert("L")
    clouds = np.asarray(clouds_source, dtype=np.float32)
    clouds = np.clip((clouds - 24.0) * 1.28, 0, 255)
    clouds_image = to_image(np.repeat(clouds[..., None], 3, axis=-1))

    moon_image = Image.open(paths["moon"]).convert("RGB")
    sun_image = build_sun(Image.open(paths["sun"]))
    jupiter_image = blend_poles(Image.open(paths["jupiter"]).convert("RGB"))
    mars_image = Image.open(paths["mars"]).convert("RGB")

    print("Writing derivatives")
    for tier in SIZES:
        save(resize(day_image, tier), f"earth-day-{tier}.webp", 82)
        save(resize(night_image, tier), f"earth-night-{tier}.webp", 74)
        save(resize(orm_image, tier), f"earth-orm-{tier}.webp", 72)
        save(resize(clouds_image, max(256, tier // 2)), f"earth-clouds-{tier}.webp", 68)
        save(resize(moon_image, max(256, tier // 2)), f"moon-{tier}.webp", 80)
        sun_width = SUN_WIDTHS[tier]
        save(resize(sun_image, sun_width, sun_width), f"sun-{tier}.webp", 84)
        save(resize(jupiter_image, tier), f"jupiter-{tier}.webp", 82)
        save(resize(mars_image, max(256, tier // MARS_DIVISOR)), f"mars-{tier}.webp", 80)

    total = sum(path.stat().st_size for path in OUTPUT_DIRECTORY.glob("*.webp"))
    print(f"Total committed texture payload: {total / 1024 / 1024:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

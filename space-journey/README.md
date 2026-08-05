# Space Journey

Standalone, optional Three.js experience launched from the pixel-art avatar in
the site masthead.

## Toggle

The integration is controlled in `_config.yml`:

```yml
space_journey:
  enabled: true
  url: "/space-journey/"
```

Set `enabled: false` to make the avatar link to the home page again. The module
has its own HTML, CSS, and JavaScript. When enabled, normal pages load only the
small `launcher.css` and `launcher.js` transition; Three.js and the full
experience remain isolated until the visitor enters `/space-journey/`.

Hold the masthead avatar for three seconds to charge the launch ring. The page
then folds like a three-dimensional sheet into a portal before navigation. Once
`/space-journey/` finishes loading, the flight starts on its own — there is no
intro screen or launch button. Audio stays muted until the visitor presses
`SOUND ON`, because browsers block autoplay without a gesture.

## Development

Restart Jekyll after changing `_config.yml`, then open:

```text
http://localhost:4000/space-journey/
```

Three.js is loaded by this module only from jsDelivr. All planets, stars,
nebulae, and cockpit graphics are generated at runtime. The soundtrack is
**Cosmic Navigation**, released under CC0 / Public Domain on
[OpenGameArt](https://opengameart.org/content/cosmic-navigation). It is mixed
with a quiet, procedurally generated engine drone at runtime.

The page preloads the pinned minified Three.js module. Google Fonts are linked
directly from the document head instead of through a render-blocking CSS import.

### Rendering

The scene renders into a half-float HDR buffer, so highlights stay above 1.0
until the composite pass. Bloom and anamorphic streaks are extracted with a
bright-pass filter and blurred at a quarter of the frame resolution, which keeps
the cost roughly flat as the window grows. The composite pass applies the
streaks, an ACES filmic curve, split toning, mild barrel distortion, edge-only
chromatic aberration, vignette, and film grain. Grain samples a reusable 64×64
noise texture instead of evaluating a trigonometric hash for every screen pixel.

Earth, the Moon, Jupiter, and Mars use photographic maps baked from NASA imagery
(see below). Jupiter is the hero of the flyby: the flight path skims about 60
units above its cloud tops, so it swells past 45° of frame and gets three times
the sphere tessellation of the other bodies, otherwise its limb reads as a
polygon. The ringed giant is the one remaining invented world, generated at load
into an equirectangular canvas using 3D value-noise fBm sampled on the unit
sphere, which avoids pole pinching. Cassini never mapped Saturn in
equirectangular projection — its global products are perspective mosaics — so
that planet stays procedural, with zonal banding warped only enough to churn the
belt edges.

The sun is a billboard placed along the key light's direction, and the flyby
layout has to keep its line of sight clear: at these radii the ringed giant sits
below the flight axis purely because at its first position it and its rings
eclipsed the sun for the entire first half of the trip.

Nothing in the star field may draw across a nearby planet: at this scale a
single star stuck to a gas giant's disc collapses the sense of distance. Both
the corridor star layers and the spiral galaxy therefore reject any point that
would fall inside a planet's silhouette from anywhere along the flight path, and
they are built after the planets so the occluder list is complete. The nebulae
are billboards, which cannot be flown through, so each one dissolves as the
camera closes in rather than washing out whatever lies beyond it.
Night lights are injected into Earth's standard material through
`onBeforeCompile` and masked by the sun-facing term, so cities only glow past the
terminator. Atmospheres are Fresnel shells that shift warm at the terminator, and
the ringed planet casts an approximated cylindrical shadow onto its own rings.
Planet, cloud, and atmosphere meshes reuse two unit-sphere geometries. Identical
stellar beacons also share their baked glow texture and sprite materials. Once
immutable image and canvas textures are created, they are uploaded immediately
and their decoded CPU sources are released. This avoids a first-frame upload
spike; context restoration reloads the page and reconstructs them.

Resource creation goes through shared interfaces: `getOrCreate` backs geometry,
texture, and material caches; `prepareImmutableTexture` owns texture sampling and
upload policy; `registerFadingSprite` owns eco dimming and proximity fades; and
`applyViewportResolution` keeps renderer sizing and pixel-ratio uniforms in sync.
Time and pixel ratio use shared uniform objects, so all dependent shaders update
through one write. Eco mode contracts its disabled bloom and streak targets to
`1×1` instead of retaining unused quarter-resolution buffers.

### Textures

`textures/` holds WebP maps baked by `tools/build-textures.py`. Re-run it only
when the source imagery or the baking parameters change:

```text
python space-journey/tools/build-textures.py
```

The script downloads the originals to a temporary cache and writes one set per
quality tier, so a phone pulls 82 KB instead of 825 KB:

| Tier     | Earth width | Payload |
| -------- | ----------- | ------- |
| high     | 2048        | 825 KB  |
| balanced | 1024        | 256 KB  |
| eco      | 512         | 82 KB   |

Elevation relief and ocean-aware roughness share one `earth-orm` texture, packed
into the R and G channels that three.js already samples for `bumpMap` and
`roughnessMap`. Cloud cover and the Moon are baked at half the tier width
because they carry only low-frequency detail, and the lunar albedo doubles as its
own height field. Jupiter gets the full tier width since it dominates the frame,
while Mars is passed at a distance and is baked at half of it. Martian albedo
tracks its terrain closely enough to serve as its own bump map. Cassini imaged
Jupiter from near its equatorial plane, so the poles of that map are a flat grey
wash; the bake fades the outermost rows into the latitude below them, since a
smeared pole is far less distracting than a pair of grey caps on the sphere. The download starts before the procedural planets are
generated, so it overlaps with CPU-side baking; if it fails the module falls back
to the fully procedural Earth and Moon.

The sun is a camera-facing disc rather than a sphere. It is self-luminous and a
thousand units away, so a photograph of the real disc is both cheaper and more
faithful than reprojecting that photograph onto geometry — the foreshortening
near the limb is already correct in the source. The bake remaps the monochrome
continuum onto photospheric colour temperatures, applies a limb-darkening
profile, and ends on a wide alpha ramp so the limb dissolves into the corona
sprite drawn behind it. The disc uses normal blending and a later `renderOrder`
than the corona, otherwise additive blending would erase the sunspots.

Source imagery is NASA public-domain material: Blue Marble Next Generation
topography/bathymetry and cloud composites, Black Marble 2012 night lights (all
NASA Visible Earth), the LROC colour mosaic from the NASA Scientific
Visualization Studio, an SDO/HMI continuum frame from 2014-10-24 — when AR12192
was the largest sunspot group in 24 years — served through the Helioviewer API,
Cassini's global colour map of Jupiter (PIA07782, NASA/JPL/Space Science
Institute), and the Viking MDIM 2.1 colourised global mosaic of Mars from the
USGS Astrogeology Science Center.

Quality tiers scale device pixel ratio, star counts, sphere tessellation, baked
texture size, noise octaves, bloom, dust, and the asteroid belt. Eco skips the
bloom passes through a shader define rather than a runtime branch. Auto mode
adjusts internal resolution in small steps after sustained frame-rate pressure
without removing scene content or post effects; append `?quality=high`,
`?quality=balanced`, or `?quality=eco` to pin a tier and resolution instead.

The route begins outside a procedurally generated five-arm Milky Way, crosses
several planetary systems and a stellar nursery, enters the Solar System, and
finishes with an atmospheric entry. The cruise easing is decelerating by the
time Earth fills the frame, so the last six seconds add their own accelerating
descent term: Earth keeps growing until its limb leaves the frame, while hull
buffeting and a plasma shock layer build around the canopy edges. At touchdown
the composite pass quantises the finished frame into pixel blocks and the avatar
arrives blown up on the same grid, so the photographic Earth resolves into the
pixel one rather than crossfading with it. After navigation the same avatar
docks precisely into the masthead logo to complete the return to the home page.

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

Dragging with the left button or one finger swings the view, up to 54° of yaw and
34° of pitch, and a double click or double tap recentres it. The range is set by
how far the scene holds up rather than by taste: the corridor star layers and the
nebulae surround the flight path widely enough that the frame stays populated out
to the clamp, and at the limit the sun, the ringed giant, Jupiter, and Earth each
fill the frame from a different heading. Releasing the drag lets the residual
velocity coast to a stop, and the view eases back to centre on its own during the
final approach so the re-entry always frames Earth.

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
(see below). Jupiter is the hero of the flyby: the flight path skims about 90
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

### Cockpit and HUD

The overlay is DOM and CSS, not part of the WebGL scene, so it costs nothing per
frame beyond the readouts that actually change.

The canopy has no closed frame across the glass. An earlier version masked an
elliptical opening out of a full-screen hull, which is how a moulded canopy
really works, but on screen any curve that rings the view reads as an
obstruction rather than as a ship. The enclosure now comes from three things
that stay out of the way: narrow translucent A-pillars at the extreme edges
whose inner side dissolves instead of ending on a line, a soft overhead brow,
and the dash. The dash is the only horizontal in the design, and it stays a
hairline of light over a translucent deck — stars still read faintly through it.
That is enough to place the viewer inside something; a solid bar just crops the
frame.

Instruments are grouped into two clusters rather than scattered readouts.
Propulsion sits top-left — a 250° velocity arc plus segmented thrust, reactor,
and hull bars — and navigation sits bottom-right with the waypoint, range, and
ETA. Each cluster carries its own scrim, because the readouts have to survive a
gas giant filling the frame behind them, and every hairline in the centre group
and the trajectory tape gets a dark drop shadow for the same reason.

The centre group is a live attitude display. `viewYaw` and `viewPitch` already
drive the camera; feeding them to the heading tape, the pitch ladder, and a
cluster parallax offset is what makes the projection feel attached to the ship
instead of to the page. The roll needle also answers `yawVelocity`, so the hull
banks into a drag the way an aircraft would. Only hull integrity ever raises an
alarm, and it fails exactly when the plasma layer builds, so the caution light
has a visible cause; the alert state retints the whole projection amber through
two custom properties rather than restyling individual widgets.

Attitude runs every frame but writes only transforms, and only when the value
has moved enough to matter. Everything numeric stays on the existing 100 ms
throttle.

### Target designator

Putting the crosshair on a body names it. A card slides up under the reticle with
the body's name, class, radius, and one line about it, and the reticle brackets
close on the target at the same time so the acquisition is legible without
looking away from the centre of frame.

Acquisition is an angular test, not a raycast: the angle between the camera's
forward vector and the direction to each body, against that body's own angular
radius. Five planets and the sun is a handful of dot products, so it runs every
frame, immediately after the render so the test uses the same camera matrix the
frame was drawn with. Two details make it feel deliberate rather than twitchy.
A body's true angular radius is well under a degree for most of the flight, so
the cone has a floor of about 2.4° to aim into, and a locked target keeps its
lock slightly past that cone, which stops the card from flickering when the
crosshair rides a limb. When cones overlap the nearest body wins.

The copy lives next to the geometry it describes, in the `info` block passed to
`addCelestialBody`, so a body cannot be moved or resized without its readout
following. Stated radii are real; the one invented world on the route quotes the
ring geometry it is actually built from instead of a measurement it cannot have.

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

Three things decide whether that disc reads as *the sun* rather than a generic
glowing ball, and all three had to be dialled in together. It has to be large
enough on screen — at 40 px bloom swallowed the granulation and the sunspots
whole. Granulation carries only a few percent of contrast in the raw continuum,
so the bake amplifies the deviation from the quiet-sun median before mapping it
onto colour. And the photosphere has to be golden rather than cream, with the
limb going redder as well as darker, since shorter wavelengths escape from the
higher and cooler layers seen at a grazing angle. The corona gradient holds full
strength out to just past the limb: front-loading it buries the corona behind
the disc and leaves the limb ending on a hard edge against empty space.

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
finishes with an atmospheric entry. It runs sixty seconds, the first fifteen of
which are a run-in from 612 units further out than the corridor starts. That
distance is the whole reason the opening reads as empty sky: fog is exponential
in range, so from back there Earth sits at roughly 97% extinction and the
nearest gas giant at 77%, which reduces them to a point and a dim disc without
moving anything. Star materials carry no fog, so the field itself stays bright,
and the far plane is set past the backdrop layer because a frustum cut there
would pop rather than fade.

The run-in uses smoothstep where the cruise uses a cubic, and the two overlap
rather than meeting end to end. A cubic covering that distance in that time
peaks at five times the cruising rate and then drops to nothing, so the ship
charged the corridor and stood on the brakes; smoothstep halves the peak, and
because the cruise easing is already ramping up before the run-in has finished
decaying, there is no moment where the flight is stationary. The cruise easing is decelerating by the
time Earth fills the frame, so the last six seconds add their own accelerating
descent term, ending 46 units from a planet of radius 38 — under seven clear of
the atmosphere shell, which is front-facing and would turn inside out if the
camera crossed it. Earth's limb leaves the frame well before that, and the last
second or so is a genuine upscale of the texture: at that range a 2048-wide map
has no texels left to give. It is spent under the plasma shock layer and is
handed straight to the quantiser, which discards fine detail anyway, so the cost
buys the approach a sense of scale it otherwise reads flat without.

The hand-off then has to turn a planet that overflows the frame into a 144 px
logo. It does that by never shrinking Earth. The dolly has run out of room, so
the last of the push comes from the lens instead, and the planet is still
growing when the composite pass quantises the frame into blocks — bloom and
streaks retire as the grid closes in, since blurred buffers smear across
quantisation and leave the frame merely looking out of focus. The canvas then
darkens, the pixel-art avatar resolves out of the fading blocks at seven times
its final size, and only the avatar contracts. After navigation the same avatar,
started at exactly the size the journey page left it, docks into the masthead
logo. Bloom is also pulled back across the descent itself: a bright-pass filter
is built for point highlights against sky and turns a sunlit cloud deck that
spans every pixel into flat haze.

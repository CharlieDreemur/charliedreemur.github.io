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
to the clamp, and at the limit the sun, Saturn, Jupiter, and Earth each fill the
frame from a different heading. Releasing the drag lets the residual
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
[OpenGameArt](https://opengameart.org/content/cosmic-navigation). Everything
else in the mix is synthesised — see below.

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
polygon. Saturn is the one planet still generated at load, into an
equirectangular canvas using 3D value-noise fBm sampled on the unit sphere, which
avoids pole pinching. Cassini never mapped it in equirectangular projection — its
global products are perspective mosaics — so that planet stays procedural, with
zonal banding warped only enough to churn the belt edges.

The sun is a billboard placed along the key light's direction, and the flyby
layout has to keep its line of sight clear: at these radii Saturn sits below the
flight axis purely because at its first position it and its rings eclipsed the sun
for the entire first half of the trip.

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
Saturn casts an approximated cylindrical shadow onto its own rings.
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
following. Every body on the route is a real one, and the stated radii are the
real figures rather than measurements of a scene that was never built to scale.

### Sound

One downloaded file, the score; everything else is Web Audio. The drive is two
oscillators through a lowpass whose cutoff opens over the first four seconds and
whose pitch tracks the flight, and the two cues at either end of the trip are
synthesised on the same principle — nothing has to stay in sync with a recording,
and there is no second asset to license.

Ignition is three layers: a sub dropping from 126 Hz to 34 Hz as the drive
catches, a noise band opening from 170 Hz to 2.6 kHz for the acceleration, and a
short bright transient so the cue has an attack rather than only a swell. It
peaks about five times louder than the cruise bed and is back down to it within a
second.

Re-entry is a band of noise on the same curve as the heat shader, squared so it
stays out of the mix until the shield is actually glowing, with an 11.5 Hz LFO on
its level so the roar shakes with the hull instead of sitting under the buffeting
as a flat hiss.

Touchdown is an impact, the burn hissing away behind it, and then a two-note
resolve held back to 1.1 s. Arriving is the point of the whole flight, so the last
thing heard is consonant rather than another rumble, and the score and the drive
duck out of the way to leave it room. The master gain holds flat until the resolve
has sounded and only then falls: fading from the moment of contact swallows the
one phrase the descent is building towards.

Two pieces of timing are load-bearing, and both were measured rather than
guessed. The graph is built during the loading screen instead of at launch — the
context stays suspended until sound is allowed, but constructing it costs the
best part of a second on a loaded machine, and paying that at ignition put the
cue a second and a half behind the launch. The mix then opens as soon as the
context is live rather than waiting on the score's media element, which can spend
seconds buffering; waiting on both put ignition three seconds late.

Since the flight starts on its own, the context is usually still suspended at
ignition and the cue would be scheduled into silence. It is armed rather than
played, and fires the moment sound actually starts, which in practice is when the
visitor presses `SOUND ON`. Past the opening seconds it no longer describes
anything on screen, so it is dropped instead of played late.

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
continuum onto photospheric colour temperatures and ends on a wide alpha ramp so
the limb dissolves into the corona sprite drawn behind it. The disc uses normal
blending and a later `renderOrder` than the corona, otherwise additive blending
would erase the sunspots.

Between the remap and the corona sits the one detail the whole disc depends on.
The colour ramp reads intensity below the quiet-sun median as a spot, and the
source frame arrives with the sun's own limb darkening intact — the medians run
0.96 of quiet at 0.4 R and 0.68 at 0.88 R. The bake also amplifies deviation
from that median threefold, because granulation carries only a few percent of
contrast in the raw continuum and both the ramp and bloom flatten what survives.
Those two together drive the limb to a quarter of the quiet level and paint the
entire rim in penumbra orange: a hard dark ring, and one that no amount of
corona tuning can hide, because it is the disc itself. So the profile is divided
out before the remap and multiplied back into the finished colour. The standard
quadratic law matches this source to about a percent out to 0.9 R, which is what
gets divided out; a per-pixel model would only add noise near the limb, where the
source is already faint and the alpha ramp is fading it anyway.

Two levels then have to agree. The corona must hand off at roughly the
brightness the darkened limb arrives at and never above it, since the eye judges
the rim against the halo rather than against the disc — a corona brighter than
the star it surrounds turns ordinary limb darkening back into a ring. And the
corona is sized independently of the disc, because a disc drawn at two thirds of
the beacon buries the entire bright half of the gradient and leaves the limb
ending on a hard edge against empty space.

None of this survives if the disc is small: at 40 px bloom swallowed the
granulation and the sunspots whole. The photosphere is warm rather than golden
for the same reason the profile is divided out — pushing blue as low as *golden*
implies leaves it bottoming out partway across the disc, so the rest of the
falloff turns into a saturated orange band with the shape of a painted ring.

Getting the profile into the texture is only half of it, because the tone curve
decides how much of it reaches the screen. Mapped at full value the entire disc
lands above the ACES knee, which compresses a 34% falloff into 6%: measured
angle-averaged, centre to 0.9 R fell 239 to 207, and what little gradient
remained was crammed into the last tenth of the radius. That is a flat matte ball
with a rim, from a texture whose gradient is perfectly intact — so the disc is
scaled down onto the responsive stretch of the curve before bloom ever sees it.
Brightness and gradient trade against each other here, and the disc is worth
less than the shading.

Scaling it down neutrally, though, hands back a white ball: ACES pulls the three
channels toward each other as they climb, so a disc sitting this high on the
curve comes out at 0.07 saturation however golden the texture underneath it is.
The scale is therefore per channel — the imbalance between them is what survives
the curve as colour, and an uneven scale that costs the same luminance restores
the photosphere to 0.23 without touching the falloff.

Two smaller things sit on top. The baked alpha ramp is deliberately wide, but it
opens well inside the limb and is still partly open past it, where the texture
has already fallen to the near-black it uses beyond the edge — a seventh of the
radius of half-transparent near-black over a saturated corona, which reads as a
grey ring around the star. The ramp is steepened in the sprite's fragment shader
rather than in the bake, so the shipped texture stays usable at other sizes.
And the sun opts out of the diffraction spikes every other beacon draws: those
are a point-source artifact, and on a star resolved to several hundred pixels
they put a hard cross over the disc that reads as a reticle.

Prominences climb off the limb from a camera-facing quad, sized in solar radii
and shaded entirely by noise — modelled geometry would be sub-pixel across at
this range. The angle enters the noise field as a point on the unit circle so it
wraps without a seam, and radius rides the third axis scrolling with time, which
is what stretches the features along the radius and makes them climb rather than
swirl. Two scales do the work: a coarse field decides which sectors erupt and how
high they throw, a fine one breaks each eruption into filaments, and a narrow
core inside each tongue supplies something bright enough to read as burning
instead of as smoke. A single scale gives an evenly spaced fringe the whole way
round, which reads as fur.

The one thing that matters for correctness is where the roots start. Bright
plasma laid against a limb that is meant to be darkening turns the falloff into
a ring by contrast, and because this plasma is additive and nearly pure red, the
bloom carrying it inward drags the limb's blue channel to nothing and makes that
ring a hard maroon band — the same artifact the corona produced, arriving from
the other side. Ramping the roots in over a wide band starting just outside the
limb is the whole fix: with it the angle-averaged disc profile is identical to
the same frame rendered with the plumes switched off, so brightness can then be
set by eye. The roots also keep some blue, since they are the end whose bloom
reaches the disc; the tips carry the colour, and what they bloom onto is sky.
Filament octaves follow the quality tier, and the layer costs about 1.5% of frame
time even on the software rasteriser.

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

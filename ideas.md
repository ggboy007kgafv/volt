# Volt Energy Drink Hero — Design Directions

## Approach 1: Verdant Kinetic
**Theme Name:** Verdant Kinetic

**Very Brief Intro:** A dark editorial product film translated into an interactive web surface. Saturated Volt green, liquid motion, and sharp typographic scale create the feeling of an energy surge captured in a premium studio.

**Probability:** 0.07

## Approach 2: Alkaline Atelier
**Theme Name:** Alkaline Atelier

**Very Brief Intro:** A mineral, daylight-led product world built from pale stone, brushed aluminum, and electric chartreuse accents. Quiet luxury replaces aggression, making the can feel like a collectible object.

**Probability:** 0.03

## Approach 3: Signal Field
**Theme Name:** Signal Field

**Very Brief Intro:** A high-contrast art-direction system inspired by sports broadcast graphics and kinetic posters. The product becomes a signal inside a field of oversized numerals, directional lines, and crisp utility labels.

**Probability:** 0.09

# Chosen Direction: Verdant Kinetic

## Design Movement
A contemporary hybrid of **cinematic product photography**, **Swiss editorial typography**, and **kinetic identity design**. The page should feel like the opening shot of a product film rather than a conventional marketing landing page.

## Core Principles
1. **The can is the event.** Every layer of the interface exists to frame the bottle/can, not compete with it.
2. **Motion has mass.** Scroll animation should feel like an object settling through liquid and light, with restrained easing rather than playful UI bounce.
3. **Sharp meets organic.** Hard typographic geometry and hairline rules contrast with water ribbons, haze, and soft bloom.
4. **Premium restraint.** Keep copy sparse, surfaces deep, and accents intentional.

## Color Philosophy
The palette starts from a near-black green-black so the product's lime and reflective aluminum feel luminous. A controlled emerald field adds depth without becoming a generic green gradient; acid chartreuse acts as the ownable energy note, while warm silver text echoes the can's finish. The emotional intent is **focused power**, not chaos.

## Layout Paradigm
Use a full-bleed cinematic stage with a sticky central canvas. The composition is asymmetrical in its supporting information: small utility labels hug the edges, while the hero copy is centered and protected by a subtle radial light well. Scroll progress is expressed as a thin vertical energy rail rather than a standard progress bar.

## Signature Elements
- A vertical scroll rail with an acid-chartreuse pulse and compact frame counter.
- A soft radial green spotlight behind the product with a barely perceptible film-grain veil.
- Hairline uppercase utility labels that feel like product-film annotations.

## Interaction Philosophy
The user should feel as if they are physically advancing a short product film. Scroll is the primary control; the page responds directly, never hijacking the gesture. Small controls remain legible but quiet, with tactile opacity and translate transitions.

## Animation
Use requestAnimationFrame to map section progress to a product frame sequence. Smooth the target progress with a spring-like lerp to avoid frame chatter. The can enters with a slight scale and vertical settle, then holds near center with subtle parallax. Copy appears on initial load and fades gradually through the first 30% of section progress. Motion must stop or simplify under prefers-reduced-motion.

## Typography System
Use **Bebas Neue** for the hero display — compressed, assertive, and close to can typography — paired with **DM Sans** for utility copy, counters, and supporting labels. Hero heading uses oversized uppercase tracking of approximately 0.02em; subheading uses a lighter sentence case with generous tracking; utility labels are 10–11px uppercase with 0.18em tracking.

## Brand Essence
Volt is the energy drink for people who want their momentum visible — a charged product film in a can, built for decisive movement. Personality: **charged, precise, cinematic**.

## Brand Voice
Headlines should be short, declarative, and physical. CTAs should sound like invitations into motion, never generic conversion language. Microcopy should be factual and slightly cinematic.

Example lines:
- “Power, in motion.”
- “Scroll to feel the charge settle.”

## Wordmark & Logo
Create a compact, text-free bolt symbol built from two opposing diagonal cuts: a solid acid-green lightning shard interrupted by a narrow negative-space slash. The mark should work as a favicon, header badge, and small frame indicator without relying on generated typography.

## Signature Brand Color
**Volt Acid — #B9F44A.** A sharp yellow-green that reads as active energy against deep green-black, distinct from standard neon lime through a slightly warmer, mineral hue.

## Style Decisions

- Every scroll section must contain at least one visible cinematic product-film cue: product frame, liquid form, radial glow, annotation, or frame marker.
- Hero copy should avoid generic beverage claims and use short physical statements in Volt’s voice, such as “Power, in motion.” or “Charge, held in frame.”
- Volt Acid #B9F44A is reserved for active signal elements only: the bolt mark, rail pulse, frame counters, primary motion cues, and key rule accents.

# Product

## Register

product

> Firebelly has two co-equal surfaces. The **app** (`firebelly-client/src/Pages/AppPages`) is the
> default register — design serves the workflow. The **marketing website**
> (`firebelly-client/src/Pages/WebsitePages`) is a **brand** surface — design is the product. They
> are weighted equally by the team; pick the register per task by which surface you're working on,
> and read the matching impeccable register reference (`product.md` for the app, `brand.md` for the
> site). The bare value above is the project default for tooling.

## Users

- **Trainers** — run their training business inside the app: manage clients, build and assign
  workouts and programs, schedule sessions, track client progress, and handle billing/invoices.
  Often working at a desk between sessions, sometimes on a phone at the gym.
- **Clients** — log workouts (frequently mid-session, on a phone, one-handed), review assigned
  training, track goals and metrics, and communicate with their trainer.
- **Guardians** — manage a child's account through scoped consent and delegated access.
- **Group members** — participate in group programs, scheduling, chat, and billing.
- **Prospects** (website) — discover Firebelly through the public marketing site (home, training
  info, nutrition, workshops, public schedule) before signing up.

The job to be done: give a small training business one place to program, deliver, schedule, track,
and bill — and give the people on the other end of that relationship a clear, fast way to train.

## Product Purpose

Firebelly Fitness is a full-stack personal-training platform that unifies workout programming,
realtime workout logging, scheduling, goals/metrics, groups, programs, and billing/invoices.
It exists so independent trainers and small studios can run the whole coaching relationship —
not just the workouts — without stitching together separate scheduling, messaging, and billing
tools. Success looks like trainers spending less time on software and more on coaching, and
clients trusting the app enough to use it live, mid-set, every session.

## Brand Personality

**Professional, inviting, customizable.**

- **Professional** — a serious, trustworthy tool for running a real business (billing, client data,
  programs). It earns confidence, but it is *not* corporate or sterile.
- **Inviting** — warm and approachable; it should feel like a place people want to be, not
  enterprise software they're obligated to use.
- **Customizable** — personalization is a first-class product value. Users already choose themes
  (dark, light, moor, ember, and saved custom palettes); the design must feel like *theirs*.

The existing feel of the app **Home**, the **in-workout** screen, and the **calendar/schedule** is
the reference point the owner likes — preserve that voice. Flow and usability improvements that make
those (and the rest) easier to use are welcome; a visual reinvention that loses their character is
not.

## Anti-references

- **Corporate / enterprise sterility** — the explicit "do not" from the owner. No cold,
  buttoned-up, faceless business-software feel.
- **Generic SaaS dashboard template** — interchangeable card grids, the hero-metric block (big
  number + label + gradient accent), and the every-section eyebrow. Firebelly should not look like
  it was assembled from the default admin kit.
- **Loud, gamified consumer-fitness apps** — neon gradients, badge spam, and shouting motivation.
  Professional and inviting, not a hype machine.
- **Clinical / medical software** — this handles bodies and metrics, but it is a coaching product,
  not a chart in a clinic.

## Design Principles

1. **Inviting, not corporate.** Default toward warmth and approachability. When a choice reads as
   "safe and businesslike" versus "human and welcoming," choose human — without sacrificing the
   professional trust the billing/client features require.
2. **The session is sacred.** The in-workout, calendar, and home surfaces are used live — often on
   a phone, mid-set, one-handed, in a gym. Clarity, large touch targets, and speed beat density and
   decoration on these screens. Protect the feel the owner already likes here.
3. **Make it theirs.** Customization (themes today, more later) is a feature, not a setting. Every
   component must hold up — legible, on-brand, AA-contrast — across all themes including
   user-defined custom palettes, not just the default dark theme.
4. **Migrate without regressing.** The app is MUI today and is moving to shadcn/Tailwind gradually.
   New work uses shadcn+Tailwind; existing MUI screens migrate opportunistically and the two
   coexist. Never break or visually regress a working flow in the name of the migration.
5. **Relationship over software.** The product mediates a 1:1 (and group) coaching relationship.
   Tone, copy, and flows should support that human connection, not bury it under tooling.

## Accessibility & Inclusion

Target **WCAG 2.1 AA** across both the app and the website:

- Body text ≥ 4.5:1 contrast; large/bold text ≥ 3:1. This bar applies to **every** theme, including
  user custom palettes — the current muted slate-on-dark secondary text should be verified and
  bumped where it falls short.
- Full keyboard operability with visible, non-color-only focus states.
- Honor `prefers-reduced-motion` on every animation (crossfade or instant alternative).
- Never convey status (booked, paid, approved, etc.) by color alone — pair with text or icon, which
  also protects color-blind users.
- Large, reliable touch targets on the live-use mobile surfaces (in-workout, schedule).

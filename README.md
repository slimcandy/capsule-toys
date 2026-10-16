# Capsule Toys

A capsule toy machine for augmented reality. Turn the knob (or press Play): a capsule drops, pops open, and a random 3D model opens in AR on your iPhone. Hats and glasses go on your face with the front camera; spacecraft and a scanned flat go on the floor with the back one. Close AR and the toy is on your shelf.

**Live:** https://ar.avolkov.dev

- [Use cases](https://ar.avolkov.dev/use-cases/): four made-up websites that use AR Quick Look for real work, one trick each
- [Create your own](https://ar.avolkov.dev/create): paste a link to your own `.usdz`, set up the banner, copy the HTML
- [About](https://ar.avolkov.dev/about): what it is, the one line of HTML, where it works

No app, no 3D engine on the page: Safari's AR Quick Look does the 3D. The page only links to `.usdz` files the right way.

The look is a 1970s arcade seen through early iOS. Like the skeuomorphic iOS of 2010, it's built from pictures, not geometry: the whole scene is one rendered image (`art/arcade.png`), and the parts that move are laid over it by percentages. The Play button and the globe are cut from the same image by `scripts/art.py`, so they sit on it without a seam; the knob is two separate renders, a disc that stays put and a bar that turns on it; the capsule, its two halves and the display cabinet for the collection are renders keyed out of flat backgrounds. On a desktop the machine and the cabinet stand side by side, as tall as the window.

## Use cases

The machine is a game; the use cases are what the same links do on a real website. Each is a made-up business with a look of its own, using the models the machine uses, and each shows a different part of Quick Look:

| Site | What it shows |
|---|---|
| [Harbour & Hill](https://ar.avolkov.dev/use-cases/flat), estate agents | A flat listed with no photos, only an iPhone (RoomPlan) scan. The banner in AR has the price and a **button of the page's own** (`callToAction`); a tap closes AR and the page opens the viewing form. |
| [Perigee](https://ar.avolkov.dev/use-cases/magazine), a science magazine | An article whose **figures open in your room**, with a caption in AR and a "Read on" button back to the text. The Mars rover is **locked at real size** (`allowsContentScaling=0`), and sharing from AR shares the article (`canonicalWebPageURL`). |
| [Hollow Lantern](https://ar.avolkov.dev/use-cases/costumes), costumes | Masks and hats **on your face** with the front camera, and an **Apple Pay button** inside AR that puts the costume in the bag. |
| [Glint](https://ar.avolkov.dev/use-cases/glasses), opticians | Frames to try on under **a banner the shop designed** itself: a page of plain HTML and CSS (`custom`, `customHeight=medium`). |

Every page shows its own link under "How this page uses AR Quick Look", and a test checks that the code shown is a link the page really uses. On a Mac or Android a tap shows a QR code instead of downloading a `.usdz`.

## How the pieces fit

| Part | Where |
|---|---|
| The machine: knob, rattle, capsule reveal, shelf | `site/src/game.ts` |
| The use cases: four pages, their scripts, and their banners in AR | `site/use-cases/`, `site/src/use-cases/`, `site/public/use-cases/banner/` |
| The textures, cut from the reference renders | `art/`, `scripts/art.py` |
| AR Quick Look links and opening AR from code | `site/src/quicklook.ts` |
| The banner shown inside AR, one page per toy | `site/src/banner.ts`, `vite.config.ts` |
| The catalog and the weighted random pick | `models/catalog.json`, `site/src/catalog.ts` |
| Wear models (front camera), generated in code | `models/wear.py` |
| Downloaded models, fixed for Quick Look | `models/build.py` |
| Thumbnails, and the bigger pictures for the use cases | `models/thumbs.py` |
| **The judge** | `models/check.py` |

### The knob

A real ratchet: it turns clockwise only, keeps where you left it, clicks every 30°, and stops hard at a full turn. Let go past 70% and the mechanism finishes the turn. Play turns it for you. Safari opens AR only within a few seconds of a tap, so the whole sequence (clunk, drop, roll out, pop) fits in two and a half.

### The banner inside AR

Quick Look can show a page of your own at the bottom of the AR view (`custom=` in the link's fragment, 81, 121 or 161 points tall, no scripts). Every toy gets one, written at build time from the catalog: name, rarity, author and licence. That's where the toy's details live, so coming back from AR puts you straight back at the machine.

### The judge

Every model is checked before it goes in the machine:

- Apple's `usdchecker --arkit` passes
- Wear models are anchored to a face; Place models are not
- Place models are the size the catalog asks for, standing on the floor
- every file is under 6 MB, has a thumbnail, and credits its author with a licence that allows sharing it (CC0, CC BY or own)

Downloaded models usually fail the first check: Sketchfab's exports leave out `MaterialBindingAPI`, and RoomPlan scans put the floor 1.3 m below the origin and write shading values that turn the room black. `models/build.py` fixes all three.

The link builder, the banner page and the random pick have unit tests (`npm test`). So do the pages: every AR link has an image as its first child, points to a file that exists, and has exactly the fragment the link builder would write; every page has a link-preview card.

### The invisible head

AR Quick Look hides 3D objects behind your face, but not behind your hair or the back of your head. Hats and helmets carry an invisible head made with RealityKit's occlusion material, so the back of a crown doesn't draw over your forehead.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # link builder, banner page, random pick, every AR link on every page
npm run check      # TypeScript
```

The models are committed, so the site runs without the steps below. To rebuild or check them (macOS, for `usdchecker` and `usdrecord`):

```sh
python3 -m venv .venv && .venv/bin/pip install -r models/requirements.txt
npm run models          # build every model in models/catalog.json, with thumbnails
npm run check-models    # the judge
```

Downloaded models go in `models/downloads/` (not committed), with an entry in `models/catalog.json`.

The textures and the app icons come from the renders in `art/`: `.venv/bin/python scripts/art.py`. The pictures on the use-case pages are rendered from the models: `.venv/bin/python models/thumbs.py --shots`. The link-preview cards come from the pages themselves: `npm run build`, then `npx vite preview --port 4173 & node scripts/share-card.mjs` (needs Playwright).

## Models

Wear models are made in code for Capsule Toys (CC0). The others, with thanks:

- Curiosity rover by [Thomas Flynn](https://sketchfab.com/3d-models/0696a383f3e841d2b5c7636ee8a58aba), CC BY 4.0
- Saturn V by [dannzjs](https://sketchfab.com/3d-models/9b61dbd396334aca8faac51f9ef63f2e), CC BY 4.0
- Apollo 11 lunar module by [NINATOR](https://sketchfab.com/3d-models/88cac6203b1c4860a269b674f6657105), CC BY 4.0
- Alex's flat: my own RoomPlan scan

## History

This repo started in 2023 as *What AR Quick Look can do today*: shop scenarios for AR Quick Look, mostly in Russian, with models that were bought or of unknown licence. Its sister project *randomARt* (2022) showed a random AR model from a list of links that has since died. Capsule Toys joins the two ideas: the random model became the game, and the scenarios came back as the use cases, in English, with models the site hosts and checks itself. The 2023 version is at the [`legacy-2023`](https://github.com/slimcandy/capsule-toys/tree/legacy-2023) tag.

## License

Code: MIT. Models: see the credits above and in `models/catalog.json`.

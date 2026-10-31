# Vimourney: playable demo

A top-down action RPG where every move is a real Vim command. This folder is the finished web build, ready to host as a static site. It has no dependencies.

## Deploy on Vercel

1. Push this project to GitHub.
2. On [vercel.com/new](https://vercel.com/new), import the repository.
3. If you pushed the whole project, set **Root Directory** to `demo`. If you pushed only this folder, leave it as it is.
4. Leave the framework preset and build settings alone (`vercel.json` sets them) and press **Deploy**.

The build step only writes your site's address into the page, so the Discord link preview can find its image.

## Test it locally

```bash
python3 -m http.server 5175 -d public
```

Then open http://localhost:5175.

## Update it

Run this from the project root after changing the game, then commit and push:

```bash
npm run demo:build
```

Vercel skips a deployment when nothing inside `demo/` changed, so changes to the game only go live after this rebuild.

## Credits

- Built with [Phaser](https://phaser.io) (MIT).
- Fonts: [IBM Plex Mono](https://github.com/IBM/plex) and [Pixelify Sans](https://github.com/eiysgoks/pixelify-sans), both under the SIL Open Font License 1.1.
- Sprites drawn with Aseprite. Sources are in `game/art/`.

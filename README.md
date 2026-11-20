# SOLMAR — Streets of Gold

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/P0hyujs/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/P0hyujs/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01/leaderboard)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Solmar is a
sun-soaked coastal city you can explore on foot and by car: steal cars, outrun
the Solmar PD, and finish four story jobs for wheelman Danny Reyes.

## Play

Serve `game/` with any static server and open `index.html` in a desktop browser:

```
node serve.ts
# open http://localhost:8080
```

No network request, no build step. Everything the game loads is a file under
`game/` (three.js is vendored as `game/vendor/three.module.min.js`).

**Controls:** WASD move / drive · E steal & enter car · SHIFT run · SPACE jump ·
F punch · ESC pause & save · M mute · drag mouse to look around.

## What's in the game

- **A city to explore:** a procedural 9×9-block grid with towers downtown, a
  plaza, palms, a beach and ocean to the east, hills to the north — all lit by
  a golden-hour sun.
- **On foot and by car:** a third-person walker with jump and punch, and
  arcade driving with traffic that cruises the streets.
- **Cars to steal:** parked cars and traffic — take any of them (the law will
  notice).
- **Wanted system:** 0–5 stars. Steal, hit pedestrians, ram cruisers and the
  Solmar PD sends more cars; lay low and the heat cools off. Get boxed in
  while slow and you're busted; take too much damage and you're wasted.
- **Missions and story:** four jobs — *The Wheelman*, *The Package*,
  *Lose the Heat*, *The Big Score* — with objective markers, a beacon, cash
  rewards and a story-complete free roam.
- **HUD with minimap:** wanted stars, cash, health, a live top-down minimap
  (player, police, traffic, mission marker), speed, clock and mission tracker.
- **Save:** progress, cash and position persist in localStorage; continue from
  the title screen.
- **Sound:** engine hum, sirens, pickups and jingles, all synthesised with
  WebAudio — no audio files.

## Structure

```
game/
  index.html            page + HUD + menus
  src/
    main.js             orchestrator: loop, camera, police, missions, save flow
    city.js             procedural city: blocks, landmarks, palms, pier, hills
    textures.js         canvas-painted facades, street map, water
    vehicles.js         cars: arcade physics, traffic AI, police chase AI
    player.js           Danny on foot: walk, jump, punch, steal
    peds.js             pedestrians: stroll, flee, get knocked down
    missions.js         the four story jobs
    wanted.js           wanted stars, heat decay, busted logic
    hud.js              HUD + live minimap
    audio.js            synthesised WebAudio sound
    save.js             localStorage save / load
    input.js            keyboard + mouse-drag camera
    shots.js            deterministic screenshot staging (?shot=...)
    rng.js              seeded random helpers
  vendor/
    three.module.min.js three.js r160 (MIT), vendored
main.ts                 hands game/ + screenshots/ in, writes dossier.json
vendor/makefun-game.ts  the kit's dossier library, unchanged
screenshots/           4 real renders of the game
```

## License

MIT — see [LICENSE](LICENSE). The city, characters, vehicles, names, story,
art and music are all original; nothing here is from Rockstar Games or any
other commercial game.

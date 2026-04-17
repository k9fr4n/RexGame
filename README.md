# Rex Rush — Endless Runner (Three.js)

Un remake « Subway Surfers » du mini-jeu T-Rex de Chrome, en **Three.js** pur, sans build step.

![RexRush](#)

## Features

- 3 voies (left / mid / right) avec lerp fluide et inclinaison du corps
- Saut + glissade (squash/stretch)
- Obstacles : barrières (saut), trains néon (changer de voie), oiseaux (glissade)
- Collectibles : œufs dorés avec combo ×N et multiplicateur de score
- Monde infini en streaming de chunks (décors ville néon + désert rocks/cactus)
- Ombres PCF, tone mapping ACES, bloom (UnrealBloomPass), fog, starfield
- Particules explosion / pickup, camera shake, camera follow
- Audio procédural WebAudio (aucun asset requis)
- Contrôles clavier + touch (tap zones + swipe)
- High score persistant (localStorage)

## Run

Aucune dépendance à installer. Trois options :

```bash
# Option A — Python (built-in)
python3 -m http.server 8080
# puis ouvrir http://localhost:8080

# Option B — Node (npx)
npx --yes http-server -p 8080 -c-1

# Option C — VS Code : extension "Live Server"
```

> [WARN] Ne pas ouvrir `index.html` en `file://` : les ES modules + import-map CDN nécessitent un serveur HTTP.

## Contrôles

| Action | Clavier | Touch |
|---|---|---|
| Lane gauche | `←` / `A` | zone gauche / swipe ← |
| Lane droite | `→` / `D` | zone droite / swipe → |
| Saut | `↑` / `Space` / `W` | zone haute / swipe ↑ |
| Glissade | `↓` / `Shift` / `S` | zone basse / swipe ↓ |
| Pause | `P` / `Esc` | — |

## Arborescence

```
.
├─ index.html          # import-map + overlays UI
├─ css/style.css       # HUD, overlays, glitch title, touch zones
└─ js/
   ├─ main.js          # bootstrap, loop, post-processing
   ├─ player.js        # Rex model + state machine
   ├─ world.js         # streaming chunks, obstacles, pickups, collisions
   ├─ input.js         # keyboard + touch + swipe
   └─ audio.js         # WebAudio SFX
```

## ADR — Pas de build step, three via import-map CDN

Status       : Accepted  
Context      : L'utilisateur veut un projet HTML/JS pur dans le répertoire courant, sans tooling.  
Decision     : Charger `three` et ses addons depuis `unpkg` via `<script type="importmap">`.  
Consequences : Zero install, démarrage instantané. Nécessite une connexion réseau au premier chargement (cache navigateur ensuite) et un petit serveur HTTP local (CORS interdit le `file://` avec modules).

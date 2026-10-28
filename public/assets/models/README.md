# Models

This project ships with **no model files**. Every bus, car, rickshaw, building, tree and character is generated in
code (see `src/game/models/` and `src/game/scenery/`), so there is nothing to download or license.

The game does not currently load `.glb` files. If you want to replace a vehicle with your own model, the place to
do it is `getVehicleGeometry()` in `src/game/models/index.js` (traffic and police) or `PlayerBus` in
`src/game/PlayerBus.js` (the player's bus). Keep the vehicle dimensions in `src/config/vehicles.js` in sync with the
model so collisions still match what you see.

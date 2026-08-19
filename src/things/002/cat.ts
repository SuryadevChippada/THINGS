/**
 * The cat, as pixels.
 *
 * Front-facing when it sits, side-on when it moves — which is how sprite
 * pets have always worked, and why it reads as an animal rather than a
 * shape that slides around.
 */

export const PALETTE: Record<string, string> = {
  d: "#4a3428", // face mask, ears, tail
  m: "#6f5442", // lighter brown
  g: "#b3aca4", // grey paws
  w: "#f4f1ea", // coat
  k: "#181210", // pupils
  e: "#e8e2d6", // eye whites
  p: "#c2827a", // nose
  b: "#6f9ab0", // water
  r: "#c9875c", // hearts
};

/** Sitting, facing you. */
export const SIT = [
  "..dd........dd..",
  "..ddd......ddd..",
  "..wwwwwwwwwwww..",
  ".wwwwwwwwwwwwww.",
  ".wwddddddddddww.",
  ".wwddddddddddww.",
  ".wwdeeddddeedww.",
  ".wwdeeddddeedww.",
  ".wwddddppddddww.",
  ".wwddddddddddww.",
  "..wwddddddddww..",
  "...wwwwwwwwww...",
  "....wwwwwwww..d.",
  "...wwwwwwwwww.dd",
  "..wwwwwwwwwwwwdd",
  "..wwwwwwwwwwwwd.",
  "..wwwwwwwwwwwd..",
  "..wwwwwwwwwwww..",
  "..wggwwwwwwggw..",
];

/** Side-on, mid-stride. Head to the right, tail to the left. */
export const WALK_A = [
  "..............dd..",
  ".............dddd.",
  "............wwwwww",
  "m..........wddddkw",
  "mm.........wddddpw",
  ".mm.......wwwddddw",
  "..mwwwwwwwwwwwwww.",
  "..wwwwwwwwwwwwwww.",
  "..wwwwwwwwwwwwww..",
  "..ww.ww....ww.ww..",
  "..ww.ww....ww.ww..",
  "..gg.gg....gg.gg..",
];

/** Same body, legs gathered — the other half of the stride. */
export const WALK_B = [
  "..............dd..",
  ".............dddd.",
  "............wwwwww",
  "m..........wddddkw",
  "mm.........wddddpw",
  ".mm.......wwwddddw",
  "..mwwwwwwwwwwwwww.",
  "..wwwwwwwwwwwwwww.",
  "..wwwwwwwwwwwwww..",
  "...www......www...",
  "...www......www...",
  "...ggg......ggg...",
];

/** Eye cells in SIT, so sleeping and dizzy can draw over them. */
export const SIT_EYES: Array<[number, number]> = [
  [4, 6],
  [10, 6],
];

/** A sprite is only usable if it's actually rectangular. */
export function checkSprite(name: string, rows: string[]) {
  const w = rows[0].length;
  const bad = rows.findIndex((r) => r.length !== w);
  if (bad !== -1) {
    throw new Error(`${name}: row ${bad} is ${rows[bad].length} wide, expected ${w}`);
  }
}



/** Curled up asleep, head to the left. */
export const SLEEP_CURL = [
  "..dd..dd..........",
  "..dddddd..........",
  ".dwwwwwwd.........",
  ".dwkkwwwwdd.......",
  ".dwwwwwwwwwddd....",
  ".wwwwwwwwwwwwwdd..",
  ".wwwwwwwwwwwwwwwd.",
  ".wwwwwwwwwwwwwwwd.",
  "..wwwwwwwwwwwwwd..",
  "..mwwwwwwwwwwwm...",
  "...mmmmmmmmmmm....",
];

/** The long low stretch, front paws forward. */
export const STRETCH = [
  "................dd",
  "...............ddd",
  "..............wwww",
  "m............wddkw",
  "mm..........wddddw",
  ".mm........wwwdddw",
  "..mwwwwwwwwwwwwwww",
  "..wwwwwwwwwwwwwwww",
  "...wwwwwwwwwwwww..",
  "..ww..........ww..",
  ".gg...........gg..",
];

/** Water bowl. */
export const BOWL = [
  "..dddddd..",
  ".dbbbbbbd.",
  "dbbbbbbbbd",
  ".dddddddd.",
  "..dddddd..",
];

/** A little love. */
export const HEART = [
  ".r.r.",
  "rrrrr",
  "rrrrr",
  ".rrr.",
  "..r..",
];

if (process.env.NODE_ENV !== "production") {
  checkSprite("SIT", SIT);
  checkSprite("WALK_A", WALK_A);
  checkSprite("WALK_B", WALK_B);
  checkSprite("SLEEP_CURL", SLEEP_CURL);
  checkSprite("STRETCH", STRETCH);
  checkSprite("BOWL", BOWL);
  checkSprite("HEART", HEART);
}

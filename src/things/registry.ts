/**
 * THINGS — canonical registry.
 *
 * This file is the index of the archive. IDs, titles and dates for 001–055
 * are canonical and must not be renamed, reordered or regenerated.
 * Entries from 056 onward use the real date they were added.
 *
 * `status` must reflect reality. Never mark something complete that isn't.
 */

export type ThingStatus = "complete" | "building" | "planned";

export type ThingScale = "micro" | "small" | "medium" | "large";

export interface Thing {
  /** Zero-padded archive id, also the route segment. */
  id: string;
  title: string;
  /** ISO archive date (YYYY-MM-DD). */
  date: string;
  category: string;
  scale: ThingScale;
  status: ThingStatus;
}

export const things: Thing[] = [
  { id: "001", title: "useless machine",         date: "2025-03-01", category: "stupid",        scale: "micro",  status: "complete" },
  { id: "002", title: "cursor pet",              date: "2025-03-06", category: "character",     scale: "small",  status: "complete" },
  { id: "003", title: "four frames",             date: "2025-03-17", category: "camera",        scale: "medium", status: "complete" },
  { id: "004", title: "gravity",                 date: "2025-03-29", category: "physics",       scale: "medium", status: "complete" },
  { id: "005", title: "egg",                     date: "2025-04-03", category: "???",           scale: "micro",  status: "complete" },
  { id: "006", title: "rain machine",            date: "2025-04-18", category: "atmospheric",   scale: "small",  status: "complete" },
  { id: "007", title: "bad photocopier",         date: "2025-04-26", category: "image tool",    scale: "small",  status: "complete" },
  { id: "008", title: "infinite staircase",      date: "2025-05-09", category: "3d",            scale: "large",  status: "complete" },
  { id: "009", title: "bubble wrap",             date: "2025-05-14", category: "satisfying",    scale: "small",  status: "complete" },
  { id: "010", title: "2004 webcam",             date: "2025-05-31", category: "camera",        scale: "small",  status: "complete" },
  { id: "011", title: "falling words",           date: "2025-06-08", category: "typography",    scale: "small",  status: "complete" },
  { id: "012", title: "eyeballs",                date: "2025-06-12", category: "interaction",   scale: "micro",  status: "complete" },
  { id: "013", title: "receipt",                 date: "2025-06-27", category: "tool",          scale: "small",  status: "planned"  },
  { id: "014", title: "don't touch the walls",   date: "2025-07-05", category: "tiny game",     scale: "small",  status: "planned"  },
  { id: "015", title: "long exposure",           date: "2025-07-21", category: "camera",        scale: "medium", status: "planned"  },
  { id: "016", title: "keyboard aquarium",       date: "2025-07-25", category: "generative",    scale: "small",  status: "planned"  },
  { id: "017", title: "loading",                 date: "2025-08-11", category: "stupid",        scale: "micro",  status: "planned"  },
  { id: "018", title: "risograph",               date: "2025-08-19", category: "image tool",    scale: "medium", status: "planned"  },
  { id: "019", title: "one lightbulb",           date: "2025-09-02", category: "3d",            scale: "medium", status: "planned"  },
  { id: "020", title: "tiny synth",              date: "2025-09-06", category: "audio",         scale: "small",  status: "planned"  },
  { id: "021", title: "wrong reflection",        date: "2025-09-23", category: "camera",        scale: "medium", status: "planned"  },
  { id: "022", title: "32×32",                   date: "2025-09-30", category: "drawing",       scale: "small",  status: "planned"  },
  { id: "023", title: "cursor cemetery",         date: "2025-10-13", category: "browser",       scale: "micro",  status: "planned"  },
  { id: "024", title: "night drive",             date: "2025-10-18", category: "atmospheric",   scale: "large",  status: "planned"  },
  { id: "025", title: "ghost exposure",          date: "2025-10-31", category: "camera",        scale: "small",  status: "planned"  },
  { id: "026", title: "angry checkbox",          date: "2025-11-04", category: "stupid",        scale: "micro",  status: "planned"  },
  { id: "027", title: "constellations",          date: "2025-11-20", category: "generative",    scale: "small",  status: "planned"  },
  { id: "028", title: "sand",                    date: "2025-11-29", category: "physics",       scale: "medium", status: "planned"  },
  { id: "029", title: "the waiting room",        date: "2025-12-12", category: "atmospheric",   scale: "medium", status: "planned"  },
  { id: "030", title: "snow globe",              date: "2025-12-18", category: "3d",            scale: "small",  status: "planned"  },
  { id: "031", title: "fireplace.html",          date: "2025-12-26", category: "atmospheric",   scale: "small",  status: "planned"  },
  { id: "032", title: "27 exposures",            date: "2026-01-05", category: "camera",        scale: "large",  status: "planned"  },
  { id: "033", title: "mouse fishing",           date: "2026-01-09", category: "toy",           scale: "small",  status: "planned"  },
  { id: "034", title: "snowfall",                date: "2026-01-22", category: "physics",       scale: "medium", status: "planned"  },
  { id: "035", title: "ambient machine",         date: "2026-02-04", category: "audio",         scale: "small",  status: "planned"  },
  { id: "036", title: "passport",                date: "2026-02-11", category: "camera",        scale: "medium", status: "planned"  },
  { id: "037", title: "tiny civilization",       date: "2026-02-26", category: "simulation",    scale: "large",  status: "planned"  },
  { id: "038", title: "one year",                date: "2026-03-02", category: "meta",          scale: "large",  status: "planned"  },
  { id: "039", title: "draw a song",             date: "2026-03-17", category: "audio",         scale: "medium", status: "planned"  },
  { id: "040", title: "fisheye",                 date: "2026-03-28", category: "camera",        scale: "small",  status: "planned"  },
  { id: "041", title: "very important button",   date: "2026-04-01", category: "stupid",        scale: "small",  status: "planned"  },
  { id: "042", title: "walk home",               date: "2026-04-15", category: "atmospheric",   scale: "large",  status: "planned"  },
  { id: "043", title: "image shredder",          date: "2026-04-22", category: "image tool",    scale: "medium", status: "planned"  },
  { id: "044", title: "rain composer",           date: "2026-05-08", category: "audio",         scale: "medium", status: "planned"  },
  { id: "045", title: "tiny planet",             date: "2026-05-12", category: "3d",            scale: "medium", status: "planned"  },
  { id: "046", title: "ascii camera",            date: "2026-05-29", category: "camera",        scale: "small",  status: "planned"  },
  { id: "047", title: "scream powered rocket",   date: "2026-06-05", category: "tiny game",     scale: "small",  status: "planned"  },
  { id: "048", title: "typewriter",              date: "2026-06-19", category: "tool",          scale: "medium", status: "planned"  },
  { id: "049", title: "banana physics",          date: "2026-06-23", category: "physics",       scale: "small",  status: "planned"  },
  { id: "050", title: "slow camera",             date: "2026-07-08", category: "camera",        scale: "small",  status: "planned"  },
  { id: "051", title: "museum of one object",    date: "2026-07-12", category: "3d",            scale: "large",  status: "planned"  },
  { id: "052", title: "pixel sorter",            date: "2026-07-27", category: "image art",     scale: "medium", status: "planned"  },
  { id: "053", title: "don't wake him",          date: "2026-07-30", category: "interaction",   scale: "small",  status: "planned"  },
  { id: "054", title: "contact sheet",           date: "2026-08-06", category: "photography",   scale: "medium", status: "planned"  },
  { id: "055", title: "one minute universe",     date: "2026-08-19", category: "simulation",    scale: "large",  status: "planned"  },
];

/** Newest first — visitors meet the newest work at the top. */
export const archive: Thing[] = [...things].sort((a, b) =>
  b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
);

export function getThing(id: string): Thing | undefined {
  return things.find((t) => t.id === id);
}

export function counts() {
  return {
    total: things.length,
    complete: things.filter((t) => t.status === "complete").length,
    building: things.filter((t) => t.status === "building").length,
    planned: things.filter((t) => t.status === "planned").length,
  };
}

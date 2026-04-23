import type { Character } from "../shared";

/**
 * Bad Moon Rising — the second base edition's 25 characters.
 *
 * IDs and night-order numbers match the canonical bra1n/townsquare and
 * Pandemonium Institute roles.json scale. Travellers (Apprentice,
 * Matron, Judge, Bishop, Voudon) are not shipped here yet — they'll
 * land alongside the Phase-4 Travellers feature.
 *
 * Ability text reproduced verbatim from the official cards.
 */
export const BAD_MOON_RISING_CHARACTERS: readonly Character[] = [
  // -------------------- Townsfolk (13) --------------------
  {
    id: "grandmother",
    name: "Grandmother",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "You start knowing a good player & their character. If the Demon kills them, you die too.",
    firstNight: 40,
    otherNights: 51,
    reminders: ["Grandchild"],
    setup: false,
  },
  {
    id: "sailor",
    name: "Sailor",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each night, choose an alive player: either you or they are drunk until dusk. You can't die.",
    firstNight: 11,
    otherNights: 4,
    reminders: ["Drunk"],
    setup: false,
  },
  {
    id: "chambermaid",
    name: "Chambermaid",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each night, choose 2 alive players (not yourself): you learn how many woke tonight due to their ability.",
    firstNight: 51,
    otherNights: 70,
    reminders: [],
    setup: false,
  },
  {
    id: "exorcist",
    name: "Exorcist",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each night*, choose a player (different to last night): the Demon, if chosen, learns who you are then doesn't wake tonight.",
    firstNight: null,
    otherNights: 21,
    reminders: ["Chosen"],
    setup: false,
  },
  {
    id: "innkeeper",
    name: "Innkeeper",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each night*, choose 2 players: they can't die tonight, but 1 is drunk until dusk.",
    firstNight: null,
    otherNights: 9,
    reminders: ["Protected", "Drunk"],
    setup: false,
  },
  {
    id: "gambler",
    name: "Gambler",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each night*, choose a player & guess their character: if you guess wrong, you die.",
    firstNight: null,
    otherNights: 10,
    reminders: ["Dead"],
    setup: false,
  },
  {
    id: "gossip",
    name: "Gossip",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Each day, you may make a public statement. Tonight, if it was true, a player dies.",
    firstNight: null,
    otherNights: 38,
    reminders: ["Dead"],
    setup: false,
  },
  {
    id: "courtier",
    name: "Courtier",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Once per game, at night, choose a character: they are drunk for 3 nights & 3 days.",
    firstNight: 19,
    otherNights: 8,
    reminders: ["Drunk 3", "Drunk 2", "Drunk 1", "No ability"],
    setup: false,
  },
  {
    id: "professor",
    name: "Professor",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "Once per game, at night*, choose a dead player: if they are a Townsfolk, they are resurrected.",
    firstNight: null,
    otherNights: 43,
    reminders: ["Alive", "No ability"],
    setup: false,
  },
  {
    id: "minstrel",
    name: "Minstrel",
    team: "townsfolk",
    edition: "bmr",
    ability:
      "When a Minion dies by execution, all other players (except Travellers) are drunk until dusk tomorrow.",
    firstNight: null,
    otherNights: null,
    reminders: ["Everyone drunk"],
    setup: false,
  },
  {
    id: "tealady",
    name: "Tea Lady",
    team: "townsfolk",
    edition: "bmr",
    ability: "If both your alive neighbours are good, they can't die.",
    firstNight: null,
    otherNights: null,
    reminders: ["Can not die"],
    setup: false,
  },
  {
    id: "pacifist",
    name: "Pacifist",
    team: "townsfolk",
    edition: "bmr",
    ability: "Executed good players might not die.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "fool",
    name: "Fool",
    team: "townsfolk",
    edition: "bmr",
    ability: "The first time you die, you don't.",
    firstNight: null,
    otherNights: null,
    reminders: ["No ability"],
    setup: false,
  },

  // -------------------- Outsiders (4) --------------------
  {
    id: "tinker",
    name: "Tinker",
    team: "outsider",
    edition: "bmr",
    ability: "You might die at any time.",
    firstNight: null,
    otherNights: 49,
    reminders: ["Dead"],
    setup: false,
  },
  {
    id: "moonchild",
    name: "Moonchild",
    team: "outsider",
    edition: "bmr",
    ability:
      "When you learn that you died, publicly choose 1 alive player. Tonight, if it was a good player, they die.",
    firstNight: null,
    otherNights: 50,
    reminders: ["Dead"],
    setup: false,
  },
  {
    id: "goon",
    name: "Goon",
    team: "outsider",
    edition: "bmr",
    ability:
      "Each night, the 1st player to choose you with their ability is drunk until dusk. You become their alignment.",
    firstNight: null,
    otherNights: null,
    reminders: ["Drunk"],
    setup: false,
  },
  {
    id: "lunatic",
    name: "Lunatic",
    team: "outsider",
    edition: "bmr",
    ability:
      "You think you are a Demon, but you are not. The Demon knows who you are & who you choose at night.",
    firstNight: 8,
    otherNights: 20,
    reminders: ["Attack 1", "Attack 2", "Attack 3"],
    setup: false,
  },

  // -------------------- Minions (4) --------------------
  {
    id: "godfather",
    name: "Godfather",
    team: "minion",
    edition: "bmr",
    ability:
      "You start knowing which Outsiders are in play. If 1 died today, choose a player tonight: they die.",
    firstNight: 21,
    otherNights: 37,
    reminders: ["Died today", "Dead"],
    setup: false,
  },
  {
    id: "devilsadvocate",
    name: "Devil's Advocate",
    team: "minion",
    edition: "bmr",
    ability:
      "Each night, choose a living player (different to last night): if executed tomorrow, they don't die.",
    firstNight: 22,
    otherNights: 13,
    reminders: ["Survives execution"],
    setup: false,
  },
  {
    id: "assassin",
    name: "Assassin",
    team: "minion",
    edition: "bmr",
    ability:
      "Once per game, at night*, choose a player: they die, even if for some reason they could not.",
    firstNight: null,
    otherNights: 36,
    reminders: ["Dead", "No ability"],
    setup: false,
  },
  {
    id: "mastermind",
    name: "Mastermind",
    team: "minion",
    edition: "bmr",
    ability:
      "If the Demon dies by execution (ending the game), play for 1 more day. If a player is then executed, their team loses.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },

  // -------------------- Demons (4) --------------------
  {
    id: "zombuul",
    name: "Zombuul",
    team: "demon",
    edition: "bmr",
    ability:
      "Each night*, if no-one died today, choose a player: they die. The 1st time you die, you live but register as dead.",
    firstNight: null,
    otherNights: 25,
    reminders: ["Died today", "Dead"],
    setup: false,
  },
  {
    id: "pukka",
    name: "Pukka",
    team: "demon",
    edition: "bmr",
    ability:
      "Each night, choose a player: they are poisoned. The previously poisoned player dies then becomes healthy.",
    firstNight: 28,
    otherNights: 26,
    reminders: ["Poisoned", "Dead"],
    setup: false,
  },
  {
    id: "shabaloth",
    name: "Shabaloth",
    team: "demon",
    edition: "bmr",
    ability:
      "Each night*, choose 2 players: they die. A dead player you chose last night might be regurgitated.",
    firstNight: null,
    otherNights: 27,
    reminders: ["Dead", "Alive"],
    setup: false,
  },
  {
    id: "po",
    name: "Po",
    team: "demon",
    edition: "bmr",
    ability:
      "Each night*, you may choose a player: they die. If your last choice was no-one, choose 3 players tonight.",
    firstNight: null,
    otherNights: 28,
    reminders: ["Dead", "3 attacks"],
    setup: false,
  },
];

export const BAD_MOON_RISING_BY_ID: Readonly<Record<string, Character>> =
  Object.fromEntries(BAD_MOON_RISING_CHARACTERS.map((c) => [c.id, c]));

export const BAD_MOON_RISING_IDS: readonly string[] =
  BAD_MOON_RISING_CHARACTERS.map((c) => c.id);

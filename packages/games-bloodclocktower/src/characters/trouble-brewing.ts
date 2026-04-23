import type { Character } from "../shared";

/**
 * Trouble Brewing — the base edition's 22 characters.
 *
 * Ability text is reproduced verbatim from the official character cards.
 * Night-order numbers are relative within this edition: lower fires first.
 * `null` means the character is not part of the scheduled night phase
 * (their ability is either passive, triggered by another event like death
 * or nomination, or invoked by the player during the day).
 *
 * "Minion info" (wake all minions, learn each other + the Demon) and
 * "Demon info" (wake Demon, learn Minions + 3 bluffs) are first-night
 * steps the Storyteller runs manually before any individually-numbered
 * character — they aren't tied to a single character's wake order.
 */
export const TROUBLE_BREWING_CHARACTERS: readonly Character[] = [
  // -------------------- Townsfolk (13) --------------------
  {
    id: "washerwoman",
    name: "Washerwoman",
    team: "townsfolk",
    edition: "tb",
    ability:
      "You start knowing that 1 of 2 players is a particular Townsfolk.",
    firstNight: 3,
    otherNights: null,
    reminders: ["Townsfolk", "Wrong"],
    setup: false,
  },
  {
    id: "librarian",
    name: "Librarian",
    team: "townsfolk",
    edition: "tb",
    ability:
      "You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)",
    firstNight: 4,
    otherNights: null,
    reminders: ["Outsider", "Wrong"],
    setup: false,
  },
  {
    id: "investigator",
    name: "Investigator",
    team: "townsfolk",
    edition: "tb",
    ability:
      "You start knowing that 1 of 2 players is a particular Minion.",
    firstNight: 5,
    otherNights: null,
    reminders: ["Minion", "Wrong"],
    setup: false,
  },
  {
    id: "chef",
    name: "Chef",
    team: "townsfolk",
    edition: "tb",
    ability: "You start knowing how many pairs of evil players are neighbours.",
    firstNight: 6,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "empath",
    name: "Empath",
    team: "townsfolk",
    edition: "tb",
    ability:
      "Each night, you learn how many of your 2 alive neighbours are evil.",
    firstNight: 7,
    otherNights: 6,
    reminders: [],
    setup: false,
  },
  {
    id: "fortune_teller",
    name: "Fortune Teller",
    team: "townsfolk",
    edition: "tb",
    ability:
      "Each night, choose 2 players: you learn if either is a Demon. There is a good player that registers as a Demon to you.",
    firstNight: 8,
    otherNights: 7,
    reminders: ["Red Herring"],
    setup: false,
  },
  {
    id: "undertaker",
    name: "Undertaker",
    team: "townsfolk",
    edition: "tb",
    ability:
      "Each night*, you learn which character died by execution today.",
    firstNight: null,
    otherNights: 5,
    reminders: [],
    setup: false,
  },
  {
    id: "monk",
    name: "Monk",
    team: "townsfolk",
    edition: "tb",
    ability:
      "Each night*, choose a player (not yourself): they are safe from the Demon tonight.",
    firstNight: null,
    otherNights: 2,
    reminders: ["Safe"],
    setup: false,
  },
  {
    id: "ravenkeeper",
    name: "Ravenkeeper",
    team: "townsfolk",
    edition: "tb",
    ability:
      "If you die at night, you are woken to choose a player: you learn their character.",
    firstNight: null,
    otherNights: 4,
    reminders: [],
    setup: false,
  },
  {
    id: "virgin",
    name: "Virgin",
    team: "townsfolk",
    edition: "tb",
    ability:
      "The 1st time you are nominated, if the nominator is a Townsfolk, they are executed immediately.",
    firstNight: null,
    otherNights: null,
    reminders: ["No Ability"],
    setup: false,
  },
  {
    id: "slayer",
    name: "Slayer",
    team: "townsfolk",
    edition: "tb",
    ability:
      "Once per game, during the day, publicly choose a player: if they are the Demon, they die.",
    firstNight: null,
    otherNights: null,
    reminders: ["No Ability"],
    setup: false,
  },
  {
    id: "soldier",
    name: "Soldier",
    team: "townsfolk",
    edition: "tb",
    ability: "You are safe from the Demon.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "mayor",
    name: "Mayor",
    team: "townsfolk",
    edition: "tb",
    ability:
      "If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },

  // -------------------- Outsiders (4) --------------------
  {
    id: "butler",
    name: "Butler",
    team: "outsider",
    edition: "tb",
    ability:
      "Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.",
    firstNight: 9,
    otherNights: 8,
    reminders: ["Master"],
    setup: false,
  },
  {
    id: "drunk",
    name: "Drunk",
    team: "outsider",
    edition: "tb",
    ability:
      "You do not know you are the Drunk. You think you are a Townsfolk character, but you are not.",
    firstNight: null,
    otherNights: null,
    reminders: ["Is the Drunk"],
    setup: false,
  },
  {
    id: "recluse",
    name: "Recluse",
    team: "outsider",
    edition: "tb",
    ability:
      "You might register as evil & as a Minion or Demon, even if dead.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "saint",
    name: "Saint",
    team: "outsider",
    edition: "tb",
    ability: "If you die by execution, your team loses.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },

  // -------------------- Minions (4) --------------------
  {
    id: "poisoner",
    name: "Poisoner",
    team: "minion",
    edition: "tb",
    ability:
      "Each night, choose a player: they are poisoned tonight and tomorrow day.",
    firstNight: 1,
    otherNights: 1,
    reminders: ["Poisoned"],
    setup: false,
  },
  {
    id: "spy",
    name: "Spy",
    team: "minion",
    edition: "tb",
    ability:
      "Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.",
    firstNight: 2,
    otherNights: 9,
    reminders: [],
    setup: false,
  },
  {
    id: "scarlet_woman",
    name: "Scarlet Woman",
    team: "minion",
    edition: "tb",
    ability:
      "If there are 5 or more players alive & the Demon dies, you become the Demon. (Travellers don't count.)",
    firstNight: null,
    otherNights: null,
    reminders: ["Is the Demon"],
    setup: false,
  },
  {
    id: "baron",
    name: "Baron",
    team: "minion",
    edition: "tb",
    ability: "There are extra Outsiders in play. [+2 Outsiders]",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: true,
  },

  // -------------------- Demons (1) --------------------
  {
    id: "imp",
    name: "Imp",
    team: "demon",
    edition: "tb",
    ability:
      "Each night*, choose a player: they die. If you choose yourself, you die & a Minion becomes the Imp.",
    firstNight: null,
    otherNights: 3,
    reminders: ["Dead"],
    setup: false,
  },
];

/**
 * Lookup map for O(1) character access by id within the TB script.
 * Built once at module load — there are 22 entries, this is microscopic.
 */
export const TROUBLE_BREWING_BY_ID: Readonly<Record<string, Character>> =
  Object.fromEntries(TROUBLE_BREWING_CHARACTERS.map((c) => [c.id, c]));

/** All character IDs that ship in the TB script (for the default scriptCharacterIds). */
export const TROUBLE_BREWING_IDS: readonly string[] =
  TROUBLE_BREWING_CHARACTERS.map((c) => c.id);

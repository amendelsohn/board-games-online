import type { Character } from "../shared";

/**
 * Sects & Violets — the third base edition's 25 characters.
 *
 * IDs and night-order numbers match the canonical roles.json scale.
 * Travellers (Barista, Harlot, Butcher, Bone Collector, Deviant)
 * ship with Phase 4.
 */
export const SECTS_AND_VIOLETS_CHARACTERS: readonly Character[] = [
  // -------------------- Townsfolk (13) --------------------
  {
    id: "clockmaker",
    name: "Clockmaker",
    team: "townsfolk",
    edition: "snv",
    ability:
      "You start knowing how many steps from the Demon to its nearest Minion.",
    firstNight: 41,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "dreamer",
    name: "Dreamer",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Each night, choose a player (not yourself or Travellers): you learn 1 good and 1 evil character, 1 of which is correct.",
    firstNight: 42,
    otherNights: 56,
    reminders: [],
    setup: false,
  },
  {
    id: "snakecharmer",
    name: "Snake Charmer",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Each night, choose an alive player: a chosen Demon swaps characters & alignments with you & is then poisoned.",
    firstNight: 20,
    otherNights: 11,
    reminders: ["Poisoned"],
    setup: false,
  },
  {
    id: "mathematician",
    name: "Mathematician",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Each night, you learn how many players' abilities worked abnormally (since dawn) due to another character's ability.",
    firstNight: 52,
    otherNights: 71,
    reminders: ["Abnormal"],
    setup: false,
  },
  {
    id: "flowergirl",
    name: "Flowergirl",
    team: "townsfolk",
    edition: "snv",
    ability: "Each night*, you learn if a Demon voted today.",
    firstNight: null,
    otherNights: 57,
    reminders: ["Demon voted", "Demon not voted"],
    setup: false,
  },
  {
    id: "towncrier",
    name: "Town Crier",
    team: "townsfolk",
    edition: "snv",
    ability: "Each night*, you learn if a Minion nominated today.",
    firstNight: null,
    otherNights: 58,
    reminders: ["Minions not nominated", "Minion nominated"],
    setup: false,
  },
  {
    id: "oracle",
    name: "Oracle",
    team: "townsfolk",
    edition: "snv",
    ability: "Each night*, you learn how many dead players are evil.",
    firstNight: null,
    otherNights: 59,
    reminders: [],
    setup: false,
  },
  {
    id: "savant",
    name: "Savant",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Each day, you may visit the Storyteller to learn 2 things in private: 1 is true & 1 is false.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "seamstress",
    name: "Seamstress",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Once per game, at night, choose 2 players (not yourself): you learn if they are the same alignment.",
    firstNight: 43,
    otherNights: 60,
    reminders: ["No ability"],
    setup: false,
  },
  {
    id: "philosopher",
    name: "Philosopher",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Once per game, at night, choose a good character: gain that ability. If this character is in play, they are drunk.",
    firstNight: 2,
    otherNights: 2,
    reminders: ["Drunk", "Is the Philosopher"],
    setup: false,
  },
  {
    id: "artist",
    name: "Artist",
    team: "townsfolk",
    edition: "snv",
    ability:
      "Once per game, during the day, privately ask the Storyteller any yes/no question.",
    firstNight: null,
    otherNights: null,
    reminders: ["No ability"],
    setup: false,
  },
  {
    id: "juggler",
    name: "Juggler",
    team: "townsfolk",
    edition: "snv",
    ability:
      "On your 1st day, publicly guess up to 5 players' characters. That night, you learn how many you got correct.",
    firstNight: null,
    otherNights: 61,
    reminders: ["Correct"],
    setup: false,
  },
  {
    id: "sage",
    name: "Sage",
    team: "townsfolk",
    edition: "snv",
    ability:
      "If the Demon kills you, you learn that it is 1 of 2 players.",
    firstNight: null,
    otherNights: 42,
    reminders: [],
    setup: false,
  },

  // -------------------- Outsiders (4) --------------------
  {
    id: "mutant",
    name: "Mutant",
    team: "outsider",
    edition: "snv",
    ability: 'If you are "mad" about being an Outsider, you might be executed.',
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "sweetheart",
    name: "Sweetheart",
    team: "outsider",
    edition: "snv",
    ability: "When you die, 1 player is drunk from now on.",
    firstNight: null,
    otherNights: 41,
    reminders: ["Drunk"],
    setup: false,
  },
  {
    id: "barber",
    name: "Barber",
    team: "outsider",
    edition: "snv",
    ability:
      "If you died today or tonight, the Demon may choose 2 players (not another Demon) to swap characters.",
    firstNight: null,
    otherNights: 40,
    reminders: ["Haircuts tonight"],
    setup: false,
  },
  {
    id: "klutz",
    name: "Klutz",
    team: "outsider",
    edition: "snv",
    ability:
      "When you learn that you died, publicly choose 1 alive player: if they are evil, your team loses.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },

  // -------------------- Minions (4) --------------------
  {
    id: "eviltwin",
    name: "Evil Twin",
    team: "minion",
    edition: "snv",
    ability:
      "You & an opposing player know each other. If the good player is executed, evil wins. Good can't win if you both live.",
    firstNight: 23,
    otherNights: null,
    reminders: ["Twin"],
    setup: false,
  },
  {
    id: "witch",
    name: "Witch",
    team: "minion",
    edition: "snv",
    ability:
      "Each night, choose a player: if they nominate tomorrow, they die. If just 3 players live, you lose this ability.",
    firstNight: 24,
    otherNights: 14,
    reminders: ["Cursed"],
    setup: false,
  },
  {
    id: "cerenovus",
    name: "Cerenovus",
    team: "minion",
    edition: "snv",
    ability:
      'Each night, choose a player & a good character: they are "mad" they are this character tomorrow, or might be executed.',
    firstNight: 25,
    otherNights: 15,
    reminders: ["Mad"],
    setup: false,
  },
  {
    id: "pithag",
    name: "Pit-Hag",
    team: "minion",
    edition: "snv",
    ability:
      "Each night*, choose a player & a character they become (if not-in-play). If a Demon is made, deaths tonight are arbitrary.",
    firstNight: null,
    otherNights: 16,
    reminders: [],
    setup: false,
  },

  // -------------------- Demons (4) --------------------
  {
    id: "fanggu",
    name: "Fang Gu",
    team: "demon",
    edition: "snv",
    ability:
      "Each night*, choose a player: they die. The 1st Outsider this kills becomes an evil Fang Gu & you die instead. [+1 Outsider]",
    firstNight: null,
    otherNights: 29,
    reminders: ["Dead", "Once"],
    setup: true,
  },
  {
    id: "vigormortis",
    name: "Vigormortis",
    team: "demon",
    edition: "snv",
    ability:
      "Each night*, choose a player: they die. Minions you kill keep their ability & poison 1 Townsfolk neighbour. [-1 Outsider]",
    firstNight: null,
    otherNights: 32,
    reminders: ["Dead", "Has ability", "Poisoned"],
    setup: true,
  },
  {
    id: "nodashii",
    name: "No Dashii",
    team: "demon",
    edition: "snv",
    ability:
      "Each night*, choose a player: they die. Your 2 Townsfolk neighbours are poisoned.",
    firstNight: null,
    otherNights: 30,
    reminders: ["Dead", "Poisoned"],
    setup: false,
  },
  {
    id: "vortox",
    name: "Vortox",
    team: "demon",
    edition: "snv",
    ability:
      "Each night*, choose a player: they die. Townsfolk abilities yield false info. Each day, if no-one is executed, evil wins.",
    firstNight: null,
    otherNights: 31,
    reminders: ["Dead"],
    setup: false,
  },
];

export const SECTS_AND_VIOLETS_BY_ID: Readonly<Record<string, Character>> =
  Object.fromEntries(SECTS_AND_VIOLETS_CHARACTERS.map((c) => [c.id, c]));

export const SECTS_AND_VIOLETS_IDS: readonly string[] =
  SECTS_AND_VIOLETS_CHARACTERS.map((c) => c.id);

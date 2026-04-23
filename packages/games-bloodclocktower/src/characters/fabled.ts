import type { Character } from "../shared";

/**
 * Fabled — global Storyteller-only "modifier" characters that change
 * the rules at the table (Storm Catcher, Doomsayer, etc.). Not seated:
 * the ST adds them to a persistent "active fabled" list visible to
 * everyone, but no one is "the Fabled" — they're just rules notes.
 *
 * Ability text reproduced verbatim from the official cards.
 */
export const FABLED_CHARACTERS: readonly Character[] = [
  {
    id: "doomsayer",
    name: "Doomsayer",
    team: "fabled",
    edition: "custom",
    ability:
      "If 4 or more players live, each living player may publicly choose (once per game) that a player of their own alignment dies.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "angel",
    name: "Angel",
    team: "fabled",
    edition: "custom",
    ability:
      "Something bad might happen to whoever is most responsible for the death of a new player.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "buddhist",
    name: "Buddhist",
    team: "fabled",
    edition: "custom",
    ability:
      "For the first 2 minutes of each day, veteran players may not talk.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "hellslibrarian",
    name: "Hell's Librarian",
    team: "fabled",
    edition: "custom",
    ability:
      "Something bad might happen to whoever talks when the Storyteller has asked for silence.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "revolutionary",
    name: "Revolutionary",
    team: "fabled",
    edition: "custom",
    ability:
      "2 neighboring players are known to be the same alignment. Once per game, one of them registers falsely.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "fiddler",
    name: "Fiddler",
    team: "fabled",
    edition: "custom",
    ability:
      "Once per game, the Demon secretly chooses an opposing player: all players choose which of these 2 players win.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "toymaker",
    name: "Toymaker",
    team: "fabled",
    edition: "custom",
    ability:
      "The Demon may choose not to attack & must do this at least once per game. Evil players get normal starting info.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "fibbin",
    name: "Fibbin",
    team: "fabled",
    edition: "custom",
    ability:
      "Once per game, 1 good player might get false information.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "duchess",
    name: "Duchess",
    team: "fabled",
    edition: "custom",
    ability:
      "Each day, 3 players may choose to visit you. At night*, each visitor learns how many visitors are evil, but 1 gets false info.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "sentinel",
    name: "Sentinel",
    team: "fabled",
    edition: "custom",
    ability: "There might be 1 extra or 1 fewer Outsider in play.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "spiritofivory",
    name: "Spirit of Ivory",
    team: "fabled",
    edition: "custom",
    ability: "There can't be more than 1 extra evil player.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "djinn",
    name: "Djinn",
    team: "fabled",
    edition: "custom",
    ability:
      "Use the Djinn's special rule. All players know what it is.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
  {
    id: "stormcatcher",
    name: "Storm Catcher",
    team: "fabled",
    edition: "custom",
    ability:
      "Name a good character. If in play, they can only die by execution, but evil players learn which player it is.",
    firstNight: null,
    otherNights: null,
    reminders: [],
    setup: false,
  },
];

export const FABLED_BY_ID: Readonly<Record<string, Character>> =
  Object.fromEntries(FABLED_CHARACTERS.map((c) => [c.id, c]));

export const FABLED_IDS: readonly string[] = FABLED_CHARACTERS.map((c) => c.id);

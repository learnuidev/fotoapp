/**
 * The values the product ships with.
 *
 * Kept beside the types rather than in the API or the app because three places
 * have to agree on them: the API writes defaults into a new event, the console's
 * settings form shows what will happen if nothing is changed, and the guest
 * screen reads a code it was handed. A default that lived in only one of the
 * three would be a difference between what the console promises and what the
 * camera does.
 */
import type { EventKind, EventSettings, RollReveal } from './event';
import type { ReactionEmoji } from './photo';

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  cameraMode: 'open',
  shotsPerRoll: 24,
  rollReveal: 'shots',
  rollRevealMinutes: 120,
  galleryVisibility: 'everyone',
  photoApproval: false,
  allowComments: true,
  allowReactions: true,
  allowDownloads: true,
  challengesEnabled: true,
  slideshowEnabled: true,
  wallOrder: 'newest',
  wallSeconds: 6,
  wallFit: 'contain',
  wallCaptions: true,
};

/** The dwell times the wall's settings form offers, in seconds. */
export const WALL_SECONDS = [3, 5, 8, 12, 20] as const;

/** How a wall can order an evening, with the sentence the settings form shows for each. */
export const WALL_ORDER_OPTIONS: { value: string; label: string; hint: string }[] = [
  {
    value: 'newest',
    label: 'Newest first',
    hint: 'Live: starts on the most recent photo and works backwards.',
  },
  {
    value: 'chronological',
    label: 'In the order they were taken',
    hint: 'Plays from the first photo forwards, by capture time.',
  },
];

/** The shots-per-roll choices the settings form offers. */
export const ROLL_SIZES = [12, 24, 36] as const;

/** How a roll can reveal, with the sentence the settings form shows for each. */
export const ROLL_REVEAL_OPTIONS: { value: RollReveal; label: string; hint: string }[] = [
  { value: 'shots', label: 'When the roll is full', hint: 'The final photo develops the roll.' },
  { value: 'timer', label: 'After a delay', hint: 'Rolls develop automatically.' },
  { value: 'host', label: 'When the host develops it', hint: 'Rolls develop when you press develop.' },
];

/** What kind of gathering, and the prompts a new event of that kind starts with. */
export const EVENT_KINDS: {
  value: EventKind;
  label: string;
  emoji: string;
  prompts: string[];
}[] = [
  {
    value: 'wedding',
    label: 'Wedding',
    emoji: '💍',
    prompts: ['The first dance', 'The tables', 'The shoes', 'The speeches'],
  },
  {
    value: 'party',
    label: 'Party',
    emoji: '🎉',
    prompts: ['Best dressed', 'The dance floor', 'The last guests standing'],
  },
  {
    value: 'trip',
    label: 'Trip',
    emoji: '🧭',
    prompts: ['The view', 'Breakfast', 'Getting there'],
  },
  {
    value: 'work',
    label: 'Work event',
    emoji: '💼',
    prompts: ['The whiteboard', 'Coffee', 'The team'],
  },
  {
    value: 'other',
    label: 'Other',
    emoji: '📸',
    prompts: ['Highlights'],
  },
];

/** The reactions a guest can leave, in the order the picker shows them. */
export const REACTIONS: ReactionEmoji[] = ['❤️', '🔥', '😂', '😮', '🥹', '🎉'];

/** The avatars a guest can pick from on the join screen. */
export const GUEST_EMOJI = ['🐣', '🦋', '🐙', '🌵', '🍋', '🎈', '🧸', '🦩', '🌙', '🍄', '🐝', '🪩'];

/**
 * The alphabet a join code is drawn from: no vowels, so no code spells a word,
 * and no `0`/`O` or `1`/`I`, because a code is read off a table card by somebody
 * who has had a drink.
 */
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 6;

/** Page sizes. The gallery asks for its own; the API clamps whatever it is given. */
export const DEFAULT_PAGE_SIZE = 60;
export const MAX_PAGE_SIZE = 200;

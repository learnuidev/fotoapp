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
import type { EventKind, EventSettings, ReactionEmoji, RollReveal } from './api';

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
  filmLook: true,
};

/** The shots-per-roll choices the settings form offers. */
export const ROLL_SIZES = [12, 24, 36] as const;

/** How a roll can reveal, with the sentence the settings form shows for each. */
export const ROLL_REVEAL_OPTIONS: { value: RollReveal; label: string; hint: string }[] = [
  { value: 'shots', label: 'When the roll is finished', hint: 'The last shot develops it for everyone.' },
  { value: 'timer', label: 'After a delay', hint: 'It develops by itself, however many shots are left.' },
  { value: 'host', label: 'When the host develops it', hint: 'You press develop, and the rolls come back.' },
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
    prompts: ['The first dance', 'Your table, mid-laugh', 'The shoes', 'Somebody crying (kindly)'],
  },
  {
    value: 'party',
    label: 'Party',
    emoji: '🎉',
    prompts: ['The best-dressed guest', 'Caught mid-move on the dance floor', 'The last three people standing'],
  },
  {
    value: 'trip',
    label: 'Trip',
    emoji: '🧭',
    prompts: ['The view nobody expected', 'Breakfast', 'The worst navigator'],
  },
  {
    value: 'work',
    label: 'Work thing',
    emoji: '💼',
    prompts: ['The whiteboard that made sense at the time', 'Somebody’s fifth coffee', 'The team, all of it'],
  },
  {
    value: 'other',
    label: 'Something else',
    emoji: '📸',
    prompts: ['The shot nobody else would take'],
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

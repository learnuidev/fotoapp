/**
 * Join codes, and event ids.
 *
 * A code is six characters from an alphabet with no vowels (`@foto/types`
 * `CODE_ALPHABET`) — short enough to type from a card on the table, and unable to
 * spell anything a wedding guest might be embarrassed to say out loud. Collisions
 * are checked against the events table rather than trusted to probability,
 * because the cost of being wrong is two events sharing a gallery.
 */
import { CODE_ALPHABET, CODE_LENGTH } from '@foto/types';
import { randomInt } from 'node:crypto';
import { events } from '../types/collections';
import { getStore } from './store';

export function randomCode(length = CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

/** A code no event is using. Tries a handful of times, then gives up loudly. */
export async function uniqueCode(): Promise<string> {
  const store = getStore();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode();
    const taken = await store.query(events, 'code', code);
    if (taken.length === 0) return code;
  }
  throw new Error('Could not allocate a join code');
}

/**
 * What a guest types, normalised.
 *
 * Upper-cased, with the punctuation somebody adds when reading a code off a card
 * taken out. Characters the alphabet does not contain are *not* corrected: the
 * alphabet has no `0`, `1`, `I` or `O`, so a code containing one was typed or
 * read wrong, and answering "no such event" is more honest than guessing which
 * letter was meant.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

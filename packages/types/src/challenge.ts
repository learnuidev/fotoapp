/**
 * A challenge — a prompt the host pins for the evening.
 *
 * Kululu's contribution to this product: a guest holding a camera with no idea
 * what to shoot takes better photos when asked for something specific, and a
 * host reading the gallery afterwards can see which prompt produced the good
 * ones. "The first dance", "your table, mid-laugh", "the shoes".
 */
export interface Challenge {
  challengeId: string;
  eventId: string;
  title: string;
  emoji: string;
  active: boolean;
  photoCount: number;
  createdAt: number;
}

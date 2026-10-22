/**
 * An event — the thing a join code opens, and the unit everything else belongs
 * to.
 *
 * It is deliberately called an *event* rather than an album: the product is
 * built around one evening (a wedding, a party, a trip), and every idea it takes
 * from the apps it combines — a QR code on the tables, a live wall, a
 * disposable roll that develops the next morning — is a statement about an
 * evening, not about a folder of files.
 */

/** What kind of gathering this is. Only ever used for copy and the starter prompts. */
export type EventKind = 'wedding' | 'party' | 'trip' | 'work' | 'other';

/**
 * Who may see the gallery.
 *
 * - `everyone` — anybody holding the link, which is what makes the live wall
 *   work on a projector nobody has signed in to.
 * - `guests` — only people who have joined with the code. The wall refuses.
 * - `host` — only the host, until they share the album. Photos still arrive;
 *   nobody else watches them arrive.
 */
export type GalleryVisibility = 'everyone' | 'guests' | 'host';

/**
 * How the camera behaves for guests.
 *
 * - `open` — the modern thing these apps all do: shoot, see it in the gallery
 *   immediately, shoot again.
 * - `roll` — GuestCam's idea: a guest is handed a roll of film with a fixed
 *   number of shots, cannot see anybody's photos (including their own) until the
 *   roll is developed, and the reveal is the event's second act.
 */
export type CameraMode = 'open' | 'roll';

/** When a finished roll develops. */
export type RollReveal = 'shots' | 'host' | 'timer';

/**
 * Everything a host can change about how their event collects photos.
 *
 * Stored as one object on the event rather than as columns, because it is read
 * as a whole by every screen that asks "what is this event like" and written as
 * a whole by the settings form.
 */
export interface EventSettings {
  cameraMode: CameraMode;
  /** Shots on one roll, when `cameraMode` is `roll`. */
  shotsPerRoll: number;
  rollReveal: RollReveal;
  /** Minutes after a roll starts that it develops, when `rollReveal` is `timer`. */
  rollRevealMinutes: number;
  galleryVisibility: GalleryVisibility;
  /** New photos wait for the host before anybody sees them. */
  photoApproval: boolean;
  allowComments: boolean;
  allowReactions: boolean;
  allowDownloads: boolean;
  challengesEnabled: boolean;
  slideshowEnabled: boolean;
}

/** The event as its host sees it: every setting, plus the counts a console shows. */
export interface Event {
  eventId: string;
  /** The six characters a guest types, and what a QR code carries. */
  code: string;
  name: string;
  kind: EventKind;
  /** Epoch ms of the gathering itself, which is not when the event row was made. */
  date: number | null;
  location: string;
  /** The line a guest reads on the join screen. */
  welcome: string;
  hostId: string;
  hostName: string;
  coverPhotoId: string | null;
  coverUrl: string | null;
  settings: EventSettings;
  createdAt: number;
  updatedAt: number;
  /** Set when a host closes the event: guests can read the album, nobody can post. */
  closedAt: number | null;
  counts: EventCounts;
}

/** The numbers drawn on the console cards and in the guest header. */
export interface EventCounts {
  /** Photos in the gallery — the number a guest is told. */
  photos: number;
  guests: number;
  reactions: number;
  comments: number;
  rolls: number;
  /** Waiting for the host's yes. */
  pending: number;
  /** Taken out of the gallery, still in the album. */
  hidden: number;
}

/**
 * The subset of an event a guest is allowed to know.
 *
 * `galleryVisibility: 'host'` is not sent as a visibility at all — it is sent as
 * `galleryOpen: false`, because the guest screen has no business rendering a
 * setting it cannot act on, and a value it might accidentally read as "open".
 */
export interface PublicEvent {
  eventId: string;
  code: string;
  name: string;
  kind: EventKind;
  date: number | null;
  location: string;
  welcome: string;
  hostName: string;
  coverUrl: string | null;
  closed: boolean;
  galleryOpen: boolean;
  settings: PublicEventSettings;
  counts: EventCounts;
}

/** The settings a guest screen acts on, and nothing else. */
export interface PublicEventSettings {
  cameraMode: CameraMode;
  shotsPerRoll: number;
  rollReveal: RollReveal;
  rollRevealMinutes: number;
  allowComments: boolean;
  allowReactions: boolean;
  allowDownloads: boolean;
  challengesEnabled: boolean;
  slideshowEnabled: boolean;
  photoApproval: boolean;
}

/** One card in a console's analytics — an hour of uploads, a top guest, a prompt. */
export interface StatBar {
  label: string;
  value: number;
  /** The emoji an avatar or a prompt is drawn with, when there is one. */
  emoji?: string;
}

/**
 * What the host console's analytics tab is made of.
 *
 * Computed by the API rather than by the page: it is a read over every photo of
 * an event, and the console has no business downloading a thousand rows to count
 * them.
 */
export interface EventStats {
  photoCount: number;
  pendingCount: number;
  hiddenCount: number;
  guestCount: number;
  rollCount: number;
  reactionCount: number;
  commentCount: number;
  favoriteCount: number;
  totalBytes: number;
  /** Hourly upload counts since the event's first photo. */
  uploadsByHour: StatBar[];
  topGuests: StatBar[];
  topChallenges: StatBar[];
  reactionBreakdown: StatBar[];
}

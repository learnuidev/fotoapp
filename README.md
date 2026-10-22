# foto

Event photo sharing, assembled from the four ideas that each got one thing right:

| from | the idea |
| --- | --- |
| [Fotify](https://fotify.app/) · [GuestPix](https://guestpix.com/) | a QR code on the table, and guests upload without installing anything |
| [Kululu](https://www.kululu.com/) | a live wall that fills up while the party happens, and prompts that give a room something to shoot |
| [GuestCam](https://guestcam.co/) | the disposable camera: twelve shots, no previews, developed later |

What this repository adds to that list is the part all four make you pay for: one
code per evening, one album, a host who can moderate it, prompts that report what
they produced, film rolls that develop on the host's word, a projector screen that
needs no sign-in, and the whole album as a zip the next morning.

---

## What it is

**A host** makes an event and gets a six-character code and a QR. They choose one of
two cameras:

- **open camera** — every photo is in the album the moment it is taken, and on the
  wall a few seconds later;
- **film rolls** — each guest is handed a roll of 12 shots, nothing on it is visible
  to anybody (including the person who shot it) until the roll is developed, and
  developing is either the last shot, a timer, or the host pressing a button with the
  room watching.

**A guest** scans the card, types a name, picks an emoji, and is in. No account, no
app, no email. They shoot against the prompts if they feel like it, react to
everybody else's photos, and can take the album home as a zip if the host allows it.

**The wall** is `/e/<code>/wall`: a projector screen with no sign-in, polling every
five seconds, cycling through the evening with the guest's name and the caption under
each frame. Space pauses it.

---

## Stack

The same stack as the `play` repository, because it is the one this product was
sketched against:

- **TypeScript** everywhere, strict, one program across the app and its packages.
- **Next.js 14** (App Router, React 18), **Tailwind CSS v4**, Radix primitives in a
  small in-repo design system, `sonner` for toasts, `lucide-react` for icons.
- **TanStack Query** for every read and write — a mutation owns its invalidation.
- **AWS**: API Gateway (HTTP API) + **Lambda** + **DynamoDB** + **S3** +
  **CloudFront** + **Cognito**, deployed by **CDK** (`infra/`).
- `fflate` builds the zip **in the browser**, `qrcode` draws the card in the browser,
  and nothing else is a dependency of the product.

```
apps/console        the control room — deploy a stage, start the app against one
apps/web            the app — landing, host console, guest album, camera, wall
packages/types      the shapes the API and the app agree on, plus the defaults
packages/api        the typed API client, the upload pipeline, the query hooks
packages/auth       Cognito sign-in for hosts, the account-less guest session
packages/ui         buttons, cards, dialogs, tabs, toasts, the emoji avatar
services/api        the Lambda handlers, one module per domain, and the route table
infra               the four CDK stacks that deploy all of it
```

---

## Running it

The app talks to a **deployed** API. There is no local server to start and no
database to run: `npm run deploy` builds the backend in AWS, and the web app is
pointed at it.

The quickest way through that is the console:

```bash
AWS_PROFILE=<your-profile> npm run console   # http://localhost:3102
```

- **Backends** — every stage, its four stacks and their statuses, the values it hands
  the app, what a deploy would run into, and Deploy / Diff / Synth / Destroy with the
  `cdk` transcript streaming underneath;
- **Frontend** — pick a stage and press start: the console writes
  `apps/web/.env.local` from that stage's stacks and parameters and runs the app on
  3100 against it;
- **AWS** — which account and profile the console is acting as, because that is the
  first thing a failed deploy makes you ask.

The console writes nothing to AWS itself. It runs `cdk` in `infra/` and reports on
it, so there is one implementation of the deployment and the console is a window
onto it.

```bash
npm install

# 1. deploy the backend (dev stage) — or press Deploy in the console
AWS_PROFILE=<your-profile> npm run deploy

# 2. read the stack outputs and put them in apps/web/.env.local
aws cloudformation describe-stacks --stack-name FotoApiStack-dev \
  --query "Stacks[0].Outputs" --output table
aws ssm get-parameter --name /foto/dev/cognito/client-id --query Parameter.Value --output text

# 3. run the app
npm run dev            # http://localhost:3100
```

`apps/web/.env.local` — the five values a stage hands the app. The console writes
this file for you; by hand it looks like this:

```bash
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3100
# optional: the code of an event to offer on the front page as a demo
NEXT_PUBLIC_DEMO_CODE=XXXXXX
```

Other commands:

```bash
npm run console        # the control room, on 3102
npm run synth          # the CloudFormation this repository would deploy
npm run deploy         # deploy all four stacks to dev
```

The tables, the bucket and the CDN are `FotoDataStack-dev`, `FotoMediaStack-dev`,
`FotoAuthStack-dev` and `FotoApiStack-dev`. A `dev` stage deletes its tables and
bucket on `destroy` and expires photos after 90 days; a `prod` stage keeps both.

---

## Who is who

Two kinds of identity, and the split is the product:

- **hosts** are Cognito users. They sign in through Amplify, API Gateway verifies the
  token on every host route, and the handlers read the claims out of the authorizer
  context. There is no password anywhere in this repository.
- **guests** have no account and never will. Joining an event makes the API sign a
  small token of its own — guest, event, expiry, HMAC'd with a key from Secrets
  Manager — and that token is what a guest route accepts. Guest routes carry no
  authorizer, because a guest has nothing for Cognito to verify.

A request may carry both: a host who joined their own event from their phone is both,
which is what puts moderation controls over the photos on their own gallery screen.

The pool's pre-sign-up trigger confirms and verifies an address without sending an
email, because this is a product where somebody makes one account to run one evening.
A production stage would delete that trigger.

---

## The API

`services/api/src/routes.ts` is the API: every route, its domain, whether it sits
behind the Cognito authorizer, and the handler that answers it. The local code and
`infra/` both read it — the stack creates one Lambda per domain and one API Gateway
route per line — so a route cannot exist in one and not the other.

| domain | what it answers |
| --- | --- |
| `auth` | `/health`, `/me` |
| `events` | creating, editing, closing and deleting an event; its guests, prompts and analytics |
| `photos` | reserving an upload, recording a shot, the gallery, moderation, reactions, comments, downloads |
| `join` | what a code opens, joining, the public gallery, the wall |
| `rolls` | starting a roll, developing one, developing all of them |
| `challenges` | the prompts and what they produced |

Rules worth knowing, all enforced in the handlers rather than in a screen:

- a photo row can only be attached to a storage key **this API reserved for that
  event**, so a client cannot point a photo at somebody else's object;
- a frame on an undeveloped roll is readable by **nobody** — the camera is disposable,
  and that is the whole idea;
- a photo waiting for approval is readable by its author and the host, and nobody
  else;
- an album set to `host` visibility refuses the gallery route itself, so knowing an
  event id is not a way in.

## Data

One DynamoDB table per collection, described once in
`services/api/src/types/collections.ts` and created from that description by
`infra/src/stacks/data-stack.ts`. Each collection names its primary key and the
indexes it is read by, so a query the API can make is a query the table can serve.

| collection | key | read by |
| --- | --- | --- |
| `events` | `eventId` | `code`, `hostId` |
| `guests` | `guestId` | `eventId`, `deviceKey` |
| `photos` | `photoId` | `eventId`, `rollId` |
| `reactions` | `reactionId` | `eventId`, `photoId` |
| `comments` | `commentId` | `eventId`, `photoId` |
| `challenges` | `challengeId` | `eventId` |
| `rolls` | `rollId` | `eventId`, `guestId` |

Nothing is counted on a counter. Every number a screen shows is read from rows —
`services/api/src/lib/counts.ts` — because a counter is a bug waiting for the one
delete path that forgets to decrement it.

## Photos

Uploads never pass through a Lambda:

1. the client asks the API for a place to put a photo (`POST /events/{id}/uploads`);
2. the API reserves a key under that event and answers with a presigned S3 PUT;
3. the browser uploads straight to S3, with progress;
4. the client tells the API the key (`POST /events/{id}/photos`) and gets the photo back.

Reading goes through CloudFront in front of a private bucket, and every photo the API
returns carries its own `url` — a client never learns a storage key it could build a
URL from.

# Blood on the Clocktower — manual test checklist

A single-browser end-to-end pass to confirm the digital grimoire still works
after touching this package. Uses dev-only seat-fill + the `🐞 seat`
switcher — nothing here needs a deployed environment or real second
player.

## Prep
1. `pnpm --filter @bgo/games-bloodclocktower build` (the web app reads
   the compiled `dist/`, not the TSX source).
2. From the repo root: `pnpm dev` (boots the API on `:8080` and Next on
   `:3000` together).
3. Open `http://localhost:3000`.

## Setup
1. On the home page, click the `🐞 debug` button on the Blood on the
   Clocktower card. It creates a 15-seat table, seats you as the
   non-playing Storyteller, and routes you straight to `/play/...`.
2. Confirm the **Storyteller setup screen** is visible:
   - "Distribute characters" header
   - 15 dropdowns, one per Debug seat
   - Distribution counter shows `T 0/9, O 0/2, M 0/3, D 0/1` (the
     official 15-player breakdown)
   - "Start the first night →" disabled until 15 are picked.
3. Click **Auto-assign balanced**.
   - All 15 dropdowns fill in.
   - Distribution counter reaches the target — and if Baron was
     picked, you should see `T 7/9, O 4/2`, the +2 outsiders bump.
4. Click **Start the first night →**.

## First night
1. Header now reads `Storyteller · first night · 15/15 alive`.
2. **Night Order** panel lists, in canonical TB order:
   - `1. Minion info` (multiple seats)
   - `2. Demon info & bluffs`
   - then each scheduled character in number order (Poisoner, Spy,
     Washerwoman, Librarian, Investigator, Chef, Empath, Fortune
     Teller, Butler — depending on the auto-pick).
3. The first item is auto-opened with a `SendInfoForm`:
   - free-text textarea
   - **structured fields** disclosure: pickable seats, character
     dropdown, yes/no, number
   - `send to all (3)` shortcut on multi-seat steps
4. Type "you are evil" into the textarea, click **send to all (3)**.
   Form clears.
5. Click `wake` on a single-seat step (e.g. Investigator). Open
   structured fields, pick 2 seats + Poisoner, click **send →**.

### Verify private info delivery (two-tab dance)
1. Open a second tab on the same `/play/...` URL.
2. In tab 2, use the `🐞 seat` switcher to become one of the seats you
   just sent info to.
3. In tab 1 (still ST), click `wake` on the Investigator step again,
   pick 2 seats + a Minion character, click **send →**.
4. Tab 2 should pop a modal titled **"A whisper in the night"** with
   the text, the picked Player chips, and the Minion character box.
5. Click **Got it** — modal dismisses.

## Grimoire toggles
1. In tab 1 (ST), find any seat card in the bottom grid.
2. Click **alive** — it flips to **dead**, the card fades, the header
   `15/15 alive` drops to `14/15 alive`, and a `ghost vote` pill
   appears.
3. Click **alive** again to bring them back.
4. Click **poisoned** on another seat — the pill turns red.
5. Click `+ Red Herring` (or whichever quick-add the Fortune Teller
   has). A reminder chip appears with an `×` to remove it.
6. Type "Test" into the `add reminder…` input + press Enter.
   A custom chip appears.

## Day flow
1. Click **Advance to day 1 →**.
2. Header now reads `Storyteller · day 1 · 15/15 alive`.
3. **Today's nominations** panel says "No nominations yet today."
4. **ST nominate**: pick a nominator and a nominee from the dropdowns,
   click **open**.
5. The nomination appears with a tally `voting: 0 yes / 0 no` and a
   `close vote` button.
6. In tab 2 (player seat), the player view shows
   **VOTE ON {nominee}** and Yes/No buttons. Click **Yes** —
   it should change to "You voted yes".
7. In tab 1 (ST), the tally now reads `voting: 1 yes / 0 no`.
8. Click **close vote**. The result stamps:
   `1 yes / 0 no` (no "on the block" since 1 < ⌈15/2⌉ = 8).
9. The nominee is alive, so an **execute** button appears.
   Click it — the nominee's seat flips to dead, header drops to
   `14/15 alive`, the **execute** button disappears.
10. Click **skip execution** (or open another nomination). Repeat as
    many times as you want.

## End match
1. In tab 1 (ST), click **End match…** in the header.
2. Modal asks for a winner (Good / Evil) and a short reason.
3. Pick **Good wins**, type "Imp executed on day 3", click **End match**.
4. Header replaces the "advance" button with a banner: **Match ended —
   Good wins**, with the reason underneath.
5. Tab 2 (player) shows the same banner.
6. Spectator view (visit the `/play` URL in a private window without a
   session, or as another non-player) reveals the **finalGrimoire**
   (each seat + character).

## Rematch
1. Back in the lobby (`/lobby/{joinCode}`), the table state should be
   **finished**.
2. Click **Play again** — the table resets to **waiting**, the same
   players are still seated, and a fresh BotC match can be started by
   the Storyteller.

## Things to watch for that should NOT happen
- Players ever seeing each other's `characterId`, `isPoisoned`, or
  `isDrunk` — these are ST-only.
- Setup-phase advance succeeding with any seat unassigned.
- A second nomination opening while the first is still open.
- A dead player being able to vote a second time (their ghost vote is
  spent on the first cast, yes or no).
- The night-order list including characters whose `firstNight` /
  `otherNights` is `null` for the current night.

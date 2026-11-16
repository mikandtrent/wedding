# RSVP Setup Guide

The website is static (just HTML/CSS/JS), so it has no server of its own to
store RSVPs. Instead it posts each RSVP to a small **Google Apps Script web
app**, which appends rows to a **Google Sheet** you own.

The result works like Microsoft Forms: every submission adds lines to a live
table that you can sort, filter, and download as Excel (`.xlsx`) or `.csv`.

**One row is written per guest.** A party of three produces three rows that
share a Submission ID, so you can read it either as a guest list (one line per
person, good for catering and seating) or collapse it back to parties by
filtering on Submission ID.

| Timestamp | Contact Name | Email / Phone | Guest Name | Attending | Party Size | Dietary Requirements | Song Request | Message | Submission ID |
|---|---|---|---|---|---|---|---|---|---|
| 2027-03-02 19:14 | Trent Rogan | trent@… | Trent Rogan | Yes | 3 | — | Mr Brightside | Can't wait! | a3f91c7e |
| 2027-03-02 19:14 | Trent Rogan | trent@… | Mika Tran | Yes | 3 | — | Mr Brightside | Can't wait! | a3f91c7e |
| 2027-03-02 19:14 | Trent Rogan | trent@… | Sam Patel | Yes | 3 | — | Mr Brightside | Can't wait! | a3f91c7e |

---

## Which Google account?

**Use `mikandtrent@gmail.com`.** Sign into it *before* starting step 1 below —
the Sheet and the script live in whichever Google account is signed in when you
create the Sheet, and moving them later means transferring ownership *and*
redeploying the script.

If you're signed into more than one Google account in the same browser, the
easiest way to avoid a mix-up is to do the whole setup in a private/incognito
window signed into `mikandtrent@gmail.com` only. (Apps Script in particular is
prone to deploying under whichever account Google considers "default".)

A few things worth knowing:

- This has nothing to do with the GitHub account hosting the site — Google and
  GitHub never talk to each other here. The names matching is a coincidence.
- The deployment runs as that account (*Execute as: Me*), so RSVPs always land
  in its Sheet no matter who submits them.
- Guests need no Google account and never see whose account it is.
- **Don't use a work account** (e.g. `@cycliq.com`) — Workspace admins often
  block deploying a web app with access set to `Anyone`, which makes step 3
  fail outright, and the account disappears if you leave the job.

---

## One-time setup (about 10 minutes)

### 1. Create the spreadsheet

1. Go to <https://sheets.new> to create a blank Google Sheet.
2. Name it something like **Wedding RSVPs**.

You don't need to add any headers — the script creates them on the first
submission.

### 2. Add the script

1. In that Sheet, choose **Extensions → Apps Script**.
2. Delete the placeholder `function myFunction() {}` in the editor.
3. Open `rsvp-backend.gs` from this repo, copy **all** of it, and paste it in.
4. Click the save icon (or `Ctrl+S`).

### 3. Deploy it as a web app

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `Wedding RSVP endpoint`
   - **Execute as:** `Me (your@email.com)`
   - **Who has access:** `Anyone` ← this matters; "Anyone with Google account"
     will **not** work, because your guests' browsers post anonymously.
4. Click **Deploy**.
5. Google will ask you to **Authorize access**. Pick your account. You'll hit a
   screen saying "Google hasn't verified this app" — click **Advanced**, then
   **Go to \<project name\> (unsafe)**, then **Allow**. This is expected: it's
   your own script, and Google shows that warning for anything not published to
   their marketplace.
6. Copy the **Web app URL**. It looks like:

   ```
   https://script.google.com/macros/s/AKfycbx…long…string…/exec
   ```

### 4. Point the website at it

1. Open `script.js`.
2. Find this line near the top of section 4 (around line 140):

   ```js
   const RSVP_ENDPOINT = "REPLACE_WITH_YOUR_WEB_APP_URL"; // TODO
   ```

3. Replace the placeholder with the URL you copied, keeping the quotes:

   ```js
   const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbx…/exec";
   ```

4. Save, commit, and push. If the site is on GitHub Pages it'll be live within
   a minute or two.

### 5. Test it

1. Open the live site, scroll to the RSVP section, and submit a test entry with
   two or three guests.
2. You should see **"Thank you! Your RSVP has been recorded."** in green.
3. Check the Sheet — there should be an `RSVPs` tab with a bold header row and
   one row per guest you entered.
4. Delete the test rows (select them → right-click → Delete rows). Don't delete
   the header row.

---

## Getting the data out

- **Excel:** in the Sheet, **File → Download → Microsoft Excel (.xlsx)**
- **CSV:** **File → Download → Comma-separated values (.csv)** — exports the
  currently-selected tab only
- **Live count of attendees:** put this in any empty cell:

  ```
  =COUNTIF(E:E,"Yes")
  ```

- **Number of distinct parties replying:**

  ```
  =COUNTA(UNIQUE(FILTER(J2:J,J2:J<>"")))
  ```

- **Everyone with dietary requirements:**

  ```
  =FILTER({D:D,G:G}, G:G<>"", ROW(G:G)>1)
  ```

- **Email alerts on new RSVPs:** in the Sheet, **Tools → Notification settings
  → Edit notifications → Notify me when: Any changes are made → Email - right
  away.**

---

## Making changes later

**If you edit `rsvp-backend.gs`,** you must redeploy for the change to take
effect: **Deploy → Manage deployments → pencil icon → Version: New version →
Deploy.** The URL stays the same, so you don't need to touch `script.js`.

**If you add a question to the form:**

1. Add the input to the RSVP form in `index.html`.
2. Add it to the `payload` object in `script.js`.
3. Add it to `HEADERS` **and** to the row array in `rsvp-backend.gs`.
4. Redeploy as above. Existing rows keep their old shape; new rows get the new
   column — you may want to add the header to the existing sheet by hand, or
   just rename the `RSVPs` tab so the script creates a fresh one.

---

## Troubleshooting

**"RSVP form isn't connected yet"**
`RSVP_ENDPOINT` in `script.js` still has the placeholder. Redo step 4.

**"Something went wrong sending your RSVP"**
Open the browser console (F12) for the real error.

- *CORS / "Failed to fetch"* — the deployment's **Who has access** is not set to
  `Anyone`. Fix it under **Deploy → Manage deployments → pencil icon**.
- *401 / 403, or an HTML login page in the response* — same cause as above.
- *"Missing required fields"* — the browser sent an incomplete payload; check
  that the `id`s in `index.html` still match the ones read in `script.js`.

**Nothing appears in the Sheet, but the site says success**
Check **Executions** in the Apps Script editor (clock icon in the left sidebar)
for a failed run and its error message.

**Rows stopped appearing after I edited the script**
You almost certainly forgot to redeploy a **new version**. See "Making changes
later".

---

## Notes and limits

- **Quota:** Apps Script allows around 20,000 web app requests per day on a free
  account — vastly more than a wedding needs.
- **Spam:** the endpoint is public, so anyone who finds the URL could post to
  it. In practice this is a non-issue for a wedding site; if junk rows ever do
  appear, just delete them. (If it became a real problem, the fix is adding a
  shared secret to the payload and checking it in `doPost`.)
- **Privacy:** guest data lives in your own Google account. Nobody else can read
  the Sheet unless you share it.
- **Backups:** the Sheet keeps full version history (**File → Version history**),
  so accidental deletions are recoverable.

/**
 * Wedding RSVP backend — Google Apps Script
 * ------------------------------------------------------------------
 * Receives RSVP submissions from the wedding site and appends ONE ROW
 * PER GUEST to the "RSVPs" sheet of the spreadsheet this script is
 * bound to.
 *
 * See SETUP-GUIDE.md for deployment instructions.
 * ------------------------------------------------------------------
 */

/** Name of the tab rows are written to. Created automatically if missing. */
var SHEET_NAME = "RSVPs";

/** Column order. Changing this changes the header row on a fresh sheet. */
var HEADERS = [
  "Timestamp",
  "Contact Name",
  "Email / Phone",
  "Guest Name",
  "Attending",
  "Party Size",
  "Dietary Requirements",
  "Song Request",
  "Message",
  "Submission ID"
];

/**
 * Entry point for POSTs from the website.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Serialise writes so two simultaneous RSVPs can't clobber each other.
    lock.waitLock(30000);

    var data = JSON.parse(e.postData.contents);

    var contactName = sanitise(data.contactName);
    var email       = sanitise(data.email);
    var attending   = sanitise(data.attending);
    var dietary     = sanitise(data.dietary);
    var song        = sanitise(data.song);
    var message     = sanitise(data.message);

    var guests = Array.isArray(data.guests) ? data.guests : [];
    guests = guests.map(sanitise).filter(function (g) { return g !== ""; });

    if (!contactName || !email || !attending || guests.length === 0) {
      return jsonResponse({
        ok: false,
        error: "Missing required fields (contact name, email, attending, at least one guest)."
      });
    }

    var sheet        = getSheet();
    var timestamp    = new Date();
    var partySize    = guests.length;
    var submissionId = Utilities.getUuid().slice(0, 8);

    // One row per guest. Party-level answers repeat on each row so the
    // sheet can be filtered or pivoted on any column.
    var rows = guests.map(function (guestName) {
      return [
        timestamp,
        contactName,
        email,
        guestName,
        attending,
        partySize,
        dietary,
        song,
        message,
        submissionId
      ];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);

    return jsonResponse({ ok: true, rows: rows.length, submissionId: submissionId });

  } catch (err) {
    // Log so failures are visible in the Apps Script execution log.
    console.error(err);
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/**
 * Lets you open the deployed URL in a browser to confirm it's live.
 */
function doGet() {
  return jsonResponse({ ok: true, status: "RSVP endpoint is live." });
}

/** Returns the RSVPs sheet, creating and formatting it on first use. */
function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight("bold")
      .setBackground("#f0ece6");
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1)
      .setNumberFormat("yyyy-mm-dd hh:mm:ss");
    for (var c = 1; c <= HEADERS.length; c++) {
      sheet.setColumnWidth(c, 160);
    }
  }

  return sheet;
}

/** Trims input and caps length so a bad actor can't bloat the sheet. */
function sanitise(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, 1000);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

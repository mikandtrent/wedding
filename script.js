/* ==========================================================================
   Site interactivity
   ========================================================================== */

/* ---------------------------------------------------------------------
   1. Smooth-scroll nav + active link highlighting
   --------------------------------------------------------------------- */
const navLinks = document.querySelectorAll("#site-nav a");

navLinks.forEach(link => {
    link.addEventListener("click", e => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
    });
});

const navSections = Array.from(navLinks)
    .map(link => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

const highlightNav = () => {
    const scrollPos = window.scrollY + 140;
    let currentId = null;
    navSections.forEach(sec => {
        if (sec.offsetTop <= scrollPos) currentId = sec.id;
    });
    navLinks.forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
    });
};
document.addEventListener("scroll", highlightNav, { passive: true });
highlightNav();

/* ---------------------------------------------------------------------
   2. Scroll-reveal for sections (respects prefers-reduced-motion)
   --------------------------------------------------------------------- */
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));
} else {
    document.querySelectorAll(".reveal").forEach(el => el.classList.add("is-visible"));
}

/* ---------------------------------------------------------------------
   3. RSVP form — dynamic guest rows
   --------------------------------------------------------------------- */
const guestRows = document.getElementById("guest-rows");
const addGuestBtn = document.getElementById("add-guest");
const MAX_GUESTS = 8;

function makeGuestRow() {
    const row = document.createElement("div");
    row.className = "guest-row";
    row.innerHTML = `
        <input type="text" class="guest-name" placeholder="Full name">
        <button type="button" class="remove-guest" aria-label="Remove guest">&times;</button>
    `;
    row.querySelector(".remove-guest").addEventListener("click", () => {
        row.remove();
        updateAddGuestVisibility();
    });
    return row;
}

function updateAddGuestVisibility() {
    const count = guestRows.querySelectorAll(".guest-row").length;
    addGuestBtn.style.display = count >= MAX_GUESTS ? "none" : "inline-block";
}

addGuestBtn.addEventListener("click", () => {
    if (guestRows.querySelectorAll(".guest-row").length >= MAX_GUESTS) return;
    guestRows.appendChild(makeGuestRow());
    updateAddGuestVisibility();
});

/* ---------------------------------------------------------------------
   4. RSVP form — submission
   --------------------------------------------------------------------- */
/*
   This site is static, so there's no server of its own to write to a
   database. The recommended free setup is:

     1. Create a Google Form with matching questions (see SETUP-GUIDE.md).
     2. Point GOOGLE_FORM_ACTION_URL and FIELD_MAP below at that form's
        real action URL and entry IDs.
     3. Every submission below lands as a new row in the Form's linked
        Google Sheet automatically — that Sheet is your always-up-to-date
        guest list, and can be downloaded as a CSV any time.
     4. Add the Apps Script in reminder-emails.gs to that Sheet to send
        automatic reminder emails to anyone who hasn't replied yet.

   Until you fill these in, the form will show a friendly error instead
   of silently failing.
*/
const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/REPLACE_WITH_YOUR_FORM_ID/formResponse"; // TODO
const FIELD_MAP = {
    contactName: "entry.111111111", // TODO: replace with your real entry IDs
    guests:      "entry.222222222",
    attending:   "entry.333333333",
    partySize:   "entry.444444444",
    dietary:     "entry.555555555",
    song:        "entry.666666666",
    email:       "entry.777777777",
    message:     "entry.888888888"
};

const rsvpForm = document.getElementById("rsvp-form");
const formStatus = document.getElementById("form-status");

rsvpForm.addEventListener("submit", async e => {
    e.preventDefault();
    formStatus.textContent = "";
    formStatus.className = "form-status";

    const contactName = document.getElementById("contact-name").value.trim();
    const attendingInput = rsvpForm.querySelector('input[name="attending"]:checked');
    const guestNames = Array.from(document.querySelectorAll(".guest-name"))
        .map(input => input.value.trim())
        .filter(Boolean);
    const email = document.getElementById("rsvp-email").value.trim();

    if (!contactName || !attendingInput || guestNames.length === 0 || !email) {
        formStatus.textContent = "Please fill in your name, at least one guest, whether you're attending, and your email.";
        formStatus.classList.add("error");
        return;
    }

    if (GOOGLE_FORM_ACTION_URL.includes("REPLACE_WITH_YOUR_FORM_ID")) {
        formStatus.textContent = "RSVP form isn't connected yet — see SETUP-GUIDE.md to finish wiring it up.";
        formStatus.classList.add("error");
        return;
    }

    const payload = new FormData();
    payload.append(FIELD_MAP.contactName, contactName);
    payload.append(FIELD_MAP.guests, guestNames.join("; "));
    payload.append(FIELD_MAP.attending, attendingInput.value);
    payload.append(FIELD_MAP.partySize, String(guestNames.length));
    payload.append(FIELD_MAP.dietary, document.getElementById("dietary").value.trim());
    payload.append(FIELD_MAP.song, document.getElementById("song").value.trim());
    payload.append(FIELD_MAP.email, email);
    payload.append(FIELD_MAP.message, document.getElementById("message").value.trim());

    const submitBtn = rsvpForm.querySelector(".rsvp-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
        // Google Forms doesn't allow reading the response from the browser
        // (that's what "no-cors" means below), so we can't confirm success
        // directly — but the submission does go through. See SETUP-GUIDE.md.
        await fetch(GOOGLE_FORM_ACTION_URL, {
            method: "POST",
            mode: "no-cors",
            body: payload
        });

        formStatus.textContent = "Thank you! Your RSVP has been recorded.";
        formStatus.classList.add("success");
        rsvpForm.reset();
        guestRows.querySelectorAll(".guest-row").forEach((row, i) => { if (i > 0) row.remove(); });
        updateAddGuestVisibility();
    } catch (err) {
        formStatus.textContent = "Something went wrong sending your RSVP — please try again, or email us directly.";
        formStatus.classList.add("error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send RSVP";
    }
});

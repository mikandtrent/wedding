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
   2b. Gallery lightbox
   --------------------------------------------------------------------- */
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");
const galleryGrid = document.getElementById("gallery-grid");

function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
}

function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
}

if (galleryGrid) {
    galleryGrid.querySelectorAll("button[data-full]").forEach(btn => {
        btn.addEventListener("click", () => {
            const img = btn.querySelector("img");
            openLightbox(btn.dataset.full, img ? img.alt : "");
        });
    });
}

lightboxClose?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", e => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && lightbox && !lightbox.hidden) closeLightbox();
});

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
   This site is static, so it has no server of its own. RSVPs are POSTed
   to a Google Apps Script web app which appends ONE ROW PER GUEST to a
   Google Sheet — that Sheet is the always-current guest list, and can be
   downloaded as .xlsx or .csv at any time (File → Download).

   To connect it:
     1. Create a new Google Sheet.
     2. Extensions → Apps Script, paste in rsvp-backend.gs, save.
     3. Deploy → New deployment → Web app
          Execute as:      Me
          Who has access:  Anyone
     4. Copy the /exec URL it gives you into RSVP_ENDPOINT below.

   Full walkthrough with screenshots-worth of detail: SETUP-GUIDE.md
*/
const RSVP_ENDPOINT = "REPLACE_WITH_YOUR_WEB_APP_URL"; // TODO

const rsvpForm = document.getElementById("rsvp-form");
const formStatus = document.getElementById("form-status");

function setStatus(text, kind) {
    formStatus.textContent = text;
    formStatus.className = "form-status" + (kind ? " " + kind : "");
}

rsvpForm.addEventListener("submit", async e => {
    e.preventDefault();
    setStatus("");

    const contactName = document.getElementById("contact-name").value.trim();
    const attendingInput = rsvpForm.querySelector('input[name="attending"]:checked');
    const guestNames = Array.from(document.querySelectorAll(".guest-name"))
        .map(input => input.value.trim())
        .filter(Boolean);
    const email = document.getElementById("rsvp-email").value.trim();

    if (!contactName || !attendingInput || guestNames.length === 0 || !email) {
        setStatus("Please fill in your name, at least one guest, whether you're attending, and your email.", "error");
        return;
    }

    if (RSVP_ENDPOINT.startsWith("REPLACE_WITH")) {
        setStatus("RSVP form isn't connected yet — see SETUP-GUIDE.md to finish wiring it up.", "error");
        return;
    }

    const payload = {
        contactName,
        email,
        attending: attendingInput.value,
        guests: guestNames,
        dietary: document.getElementById("dietary").value.trim(),
        song: document.getElementById("song").value.trim(),
        message: document.getElementById("message").value.trim()
    };

    const submitBtn = rsvpForm.querySelector(".rsvp-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
        // text/plain keeps this a "simple" CORS request, so the browser
        // skips the preflight OPTIONS call that Apps Script can't answer.
        const res = await fetch(RSVP_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!result.ok) throw new Error(result.error || "Unknown error");

        setStatus("Thank you! Your RSVP has been recorded.", "success");
        rsvpForm.reset();
        guestRows.querySelectorAll(".guest-row").forEach((row, i) => { if (i > 0) row.remove(); });
        updateAddGuestVisibility();
    } catch (err) {
        console.error("RSVP submission failed:", err);
        setStatus("Something went wrong sending your RSVP — please try again, or email us directly.", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send RSVP";
    }
});

/* ---------------------------------------------------------------------
   5. Gifts — PayID panel
   --------------------------------------------------------------------- */
/*
   A PayID isn't a web address, so there's nothing to link to — the button
   reveals the details instead, with a one-tap copy so nobody has to
   retype an email address into their banking app.

   Put your real details in the panel in index.html (search for
   REPLACE_WITH_YOUR_PAYID).
*/
const payidToggle = document.getElementById("payid-toggle");
const payidPanel = document.getElementById("payid-panel");

if (payidToggle && payidPanel) {
    payidToggle.addEventListener("click", () => {
        const open = payidPanel.hasAttribute("hidden");
        if (open) {
            payidPanel.removeAttribute("hidden");
        } else {
            payidPanel.setAttribute("hidden", "");
        }
        payidToggle.setAttribute("aria-expanded", String(open));
    });
}

document.querySelectorAll(".payid-copy").forEach(btn => {
    btn.addEventListener("click", async () => {
        const source = document.getElementById(btn.dataset.copy);
        if (!source) return;
        // Copy the unformatted value when one is given, so it pastes cleanly
        // into a banking app (digits only, no spaces).
        const text = (source.dataset.copyText || source.textContent).trim();

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older mobile browsers and non-HTTPS contexts.
                const scratch = document.createElement("textarea");
                scratch.value = text;
                scratch.setAttribute("readonly", "");
                scratch.style.position = "absolute";
                scratch.style.left = "-9999px";
                document.body.appendChild(scratch);
                scratch.select();
                document.execCommand("copy");
                scratch.remove();
            }

            const original = btn.textContent;
            btn.textContent = "Copied";
            btn.classList.add("copied");
            setTimeout(() => {
                btn.textContent = original;
                btn.classList.remove("copied");
            }, 2000);
        } catch (err) {
            console.error("Copy failed:", err);
            // Leave the text on screen — the guest can still select it manually.
        }
    });
});

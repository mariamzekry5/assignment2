/* =========================================================
   Portfolio - script.js
   Shared by every page. Features from Assignment 2:
     Option 1 - Contact form with validation
     Option 2 - Show / hide sections
     Option 3 - Dark / light mode toggle
     Option 5 - Welcome message on page load
   Added in Assignment 3:
     Mobile navigation menu for the multi-page layout
   (The API features are in api.js.)
   ========================================================= */


/* ---------------------------------------------------------
   Option 3 - Dark / light mode (part 1)
   This runs immediately (the script is in the <head>) so the
   saved theme is applied before the page is drawn, avoiding
   a flash of the wrong colors.
   --------------------------------------------------------- */

const THEME_KEY = "cv-theme";

// Read the saved theme. localStorage can throw in private
// browsing, so any error just means "nothing saved".
function getSavedTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch (error) {
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        // Saving is optional; the toggle still works without it.
    }
}

// Use the saved choice, otherwise follow the operating system setting
function getInitialTheme() {
    const saved = getSavedTheme();
    if (saved === "light" || saved === "dark") {
        return saved;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
}

document.documentElement.setAttribute("data-theme", getInitialTheme());


/* ---------------------------------------------------------
   Everything below needs the HTML elements to exist, so it
   waits for the DOMContentLoaded event.
   --------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", function () {
    setupThemeToggle();
    setupNavMenu();
    setupSectionToggles();

    // These elements only exist on some pages
    if (document.getElementById("contact-form")) {
        setupContactForm();
    }
    if (document.getElementById("welcome-banner")) {
        showWelcomeMessage();
    }
});


/* ---------------------------------------------------------
   Mobile navigation menu
   On small screens the links are hidden behind a menu
   button; clicking it opens and closes the list.
   --------------------------------------------------------- */

function setupNavMenu() {
    const button = document.getElementById("menu-toggle");
    const links = document.getElementById("nav-links");

    function setOpen(open) {
        links.classList.toggle("open", open);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    button.addEventListener("click", function () {
        setOpen(!links.classList.contains("open"));
    });

    // Close the menu with the Escape key
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && links.classList.contains("open")) {
            setOpen(false);
            button.focus();
        }
    });
}


/* ---------------------------------------------------------
   Option 3 - Dark / light mode (part 2): the toggle button
   --------------------------------------------------------- */

function setupThemeToggle() {
    const button = document.getElementById("theme-toggle");

    // Update the button text/icon to describe the mode it will switch TO
    function updateButton(theme) {
        const isDark = theme === "dark";
        button.querySelector(".theme-icon").textContent = isDark ? "☀️" : "🌙";
        button.querySelector(".theme-label").textContent = isDark ? "Light" : "Dark";
        button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    }

    updateButton(document.documentElement.getAttribute("data-theme"));

    button.addEventListener("click", function () {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", next);
        saveTheme(next);
        updateButton(next);
    });
}


/* ---------------------------------------------------------
   Option 2 - Show / hide sections
   Every button with class "toggle-btn" has a data-target
   attribute holding the id of the content it controls.
   --------------------------------------------------------- */

function setupSectionToggles() {
    const buttons = document.querySelectorAll(".toggle-btn");

    buttons.forEach(function (button) {
        const content = document.getElementById(button.dataset.target);
        // Section name taken from the button text, e.g. "Skills"
        const sectionName = button.textContent.trim().replace(/^(Hide|Show)\s+/, "");

        button.addEventListener("click", function () {
            const isExpanded = button.getAttribute("aria-expanded") === "true";

            if (isExpanded) {
                collapse(content);
                button.textContent = "Show " + sectionName;
            } else {
                expand(content);
                button.textContent = "Hide " + sectionName;
            }

            button.setAttribute("aria-expanded", String(!isExpanded));
        });
    });
}

// Animate the content closed by shrinking its max-height to 0
function collapse(element) {
    element.style.maxHeight = element.scrollHeight + "px"; // start from current height
    element.offsetHeight; // force the browser to apply the height before animating
    element.style.maxHeight = "0px";
    element.classList.add("collapsed");
    element.setAttribute("aria-hidden", "true");
}

// Animate the content open, then remove the limit so it can resize freely
function expand(element) {
    element.classList.remove("collapsed");
    element.removeAttribute("aria-hidden");
    element.style.maxHeight = element.scrollHeight + "px";

    element.addEventListener("transitionend", function clearHeight(event) {
        // Ignore the opacity transition; wait for the height one
        if (event.propertyName !== "max-height") {
            return;
        }
        if (!element.classList.contains("collapsed")) {
            element.style.maxHeight = "";
        }
        element.removeEventListener("transitionend", clearHeight);
    });
}


/* ---------------------------------------------------------
   Option 1 - Contact form with validation
   Checks required fields and email format, then shows error
   or success messages on the page (no page reload).
   --------------------------------------------------------- */

// Simple email pattern: text@text.domain (domain ending of 2+ letters)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setupContactForm() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("form-status");

    const fields = {
        name: document.getElementById("name"),
        email: document.getElementById("email"),
        message: document.getElementById("message")
    };

    form.addEventListener("submit", function (event) {
        event.preventDefault(); // stop the browser from reloading the page

        const errors = validate(fields);
        let firstInvalid = null;

        // Show or clear the error message under each field
        Object.keys(fields).forEach(function (key) {
            showFieldError(fields[key], errors[key]);
            if (errors[key] && !firstInvalid) {
                firstInvalid = fields[key];
            }
        });

        if (firstInvalid) {
            status.textContent = "Please fix the highlighted fields and try again.";
            status.className = "form-status error";
            firstInvalid.focus();
            return;
        }

        // All fields are valid
        const firstName = fields.name.value.trim().split(" ")[0];
        status.textContent = "Thank you, " + firstName + "! Your message has been received. I will get back to you soon.";
        status.className = "form-status success";
        form.reset();
    });

    // Clear a field's error as soon as the user starts fixing it
    Object.keys(fields).forEach(function (key) {
        fields[key].addEventListener("input", function () {
            if (fields[key].closest(".form-field").classList.contains("invalid")) {
                showFieldError(fields[key], validate(fields)[key]);
            }
        });
    });
}

// Returns an object with an error message for each invalid field
function validate(fields) {
    const errors = {};
    const name = fields.name.value.trim();
    const email = fields.email.value.trim();
    const message = fields.message.value.trim();

    if (name === "") {
        errors.name = "Please enter your name.";
    }

    if (email === "") {
        errors.email = "Please enter your email address.";
    } else if (!EMAIL_PATTERN.test(email)) {
        errors.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    if (message === "") {
        errors.message = "Please enter a message.";
    } else if (message.length < 10) {
        errors.message = "Your message should be at least 10 characters long.";
    }

    return errors;
}

// Displays (or clears, if message is empty) the error under one input
function showFieldError(input, message) {
    const wrapper = input.closest(".form-field");
    const errorText = document.getElementById(input.id + "-error");

    if (message) {
        wrapper.classList.add("invalid");
        errorText.textContent = message;
        input.setAttribute("aria-invalid", "true");
    } else {
        wrapper.classList.remove("invalid");
        errorText.textContent = "";
        input.removeAttribute("aria-invalid");
    }
}


/* ---------------------------------------------------------
   Option 5 - Welcome message
   Slides in a greeting based on the time of day when the
   page loads, then hides it after a few seconds.
   --------------------------------------------------------- */

function showWelcomeMessage() {
    const banner = document.getElementById("welcome-banner");

    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) {
        greeting = "Good morning";
    } else if (hour < 18) {
        greeting = "Good afternoon";
    }

    const text = document.createElement("span");
    text.textContent = greeting + "! Welcome to my portfolio 👋";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close welcome message");
    closeButton.textContent = "×";

    banner.append(text, closeButton);
    banner.hidden = false;

    // Small delay so the slide-in animation is visible
    setTimeout(function () {
        banner.classList.add("show");
    }, 300);

    function hideBanner() {
        banner.classList.remove("show");
    }

    closeButton.addEventListener("click", hideBanner);
    setTimeout(hideBanner, 6000);
}

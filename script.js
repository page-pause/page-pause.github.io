/* ============================================================
   Page & Pause — script.js
   ------------------------------------------------------------
   ✦ HOW TO ADD A BOOK BY HAND (takes about a minute):
     1. Scroll down to the BOOKS list below.
     2. Copy any whole { ... } block.
     3. Paste it after the last one and make sure there is a
        comma at the end of the block BEFORE your new one.
     4. Change the words inside. That's it — the card, the
        category chips, and the filters all update by themselves.

   (You can also add books from the private shelf manager;
   those are stored in YOUR browser only — use "Copy book code"
   there to publish them for everyone by pasting into this BOOKS
   list.)
   ============================================================ */

const BOOKS = [
  {
    id: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Habits",
    problem: "I can't stop procrastinating",
    blurb: "Tiny changes compound into remarkable results. This one shows you how to build good habits and break bad ones without needing willpower.",
    cover: "covers/atomic-habits.jpg",
    lockerUrl: "#", // ← replace with your content-locker URL
    badge: "Most popular"
  },
  {
    id: "deep-work",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Focus",
    problem: "I get distracted every three minutes",
    blurb: "Focused, uninterrupted work is becoming rare and therefore valuable. Learn rules for training your attention like a muscle.",
    cover: "covers/deep-work.jpg",
    lockerUrl: "#",
    badge: ""
  },
  {
    id: "psychology-of-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    category: "Money",
    problem: "I never feel like I'm good with money",
    blurb: "Doing well with money has little to do with IQ and a lot to do with behaviour. Fourteen short stories about the habits that build wealth.",
    cover: "covers/psychology-of-money.jpg",
    lockerUrl: "#",
    badge: ""
  },
  {
    id: "why-we-sleep",
    title: "Why We Sleep",
    author: "Matthew Walker",
    category: "Rest",
    problem: "I'm exhausted but can't switch off at night",
    blurb: "Sleep is the single most effective thing you can do for your brain and body. A science-backed case for protecting your nights.",
    cover: "covers/why-we-sleep.jpg",
    lockerUrl: "#",
    badge: "New"
  },
  {
    id: "essentialism",
    title: "Essentialism",
    author: "Greg McKeown",
    category: "Focus",
    problem: "My to-do list never, ever ends",
    blurb: "Less, but better. This is about doing fewer things but doing them far better, instead of wandering through busywork.",
    cover: "covers/essentialism.jpg",
    lockerUrl: "#",
    badge: ""
  },
  {
    id: "how-to-fail",
    title: "How to Fail at Everything and Still Win Big",
    author: "Scott Adams",
    category: "Mindset",
    problem: "I'm scared of failing again",
    blurb: "Forget goals; build systems. A slightly contrarian toolkit for stacking skills and forgiving your own stumbles.",
    cover: "covers/how-to-fail.jpg",
    lockerUrl: "#",
    badge: ""
  }
  /* → Paste your next { ... } book block right here */
];

/* ============================================================
   Below here is the engine — you normally never need to edit it.
   ============================================================ */

const ADMIN_KEY = "pp-admin-books"; // localStorage key for shelf-manager books

/* Books added via the shelf manager (this browser only) + the list above */
function allBooks() {
  let extra = [];
  try { extra = JSON.parse(localStorage.getItem(ADMIN_KEY)) || []; }
  catch (e) { extra = []; }
  return [...BOOKS, ...extra];
}

/* Escape user text before inserting into HTML */
function esc(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Fade-up observer (declared early so render() can use it) */
let revealObserver;

/* ---- Cover image with graceful styled fallback ---- */
function coverHTML(book) {
  const badge = book.badge ? `<span class="badge">${esc(book.badge)}</span>` : "";
  return `
    <div class="cover">
      <img src="${esc(book.cover)}" alt="Cover of ${esc(book.title)} by ${esc(book.author)}"
           loading="lazy" decoding="async">
      <div class="cover-fallback">
        <span class="fb-title">${esc(book.title)}</span>
        <span class="fb-author">${esc(book.author)}</span>
      </div>
      ${badge}
    </div>`;
}

/* Fallback swap-in for ANY cover image on the page */
function watchCover(img) {
  img.addEventListener("error", () => img.closest(".cover").classList.add("is-missing"));
  // If the image already failed before this line ran:
  if (img.complete && img.naturalWidth === 0) img.closest(".cover").classList.add("is-missing");
}

/* "Solves:" fill-in field (hidden when a book has no problem line) */
function solvesHTML(book) {
  if (!book.problem) return "";
  return `
    <p class="solves">
      <span class="solves-label">Solves:</span>
      <span class="solves-text">“${esc(book.problem)}”</span>
    </p>`;
}

/* ============================================================
   Landing page (index.html)
   ============================================================ */

const grid = document.getElementById("bookGrid");

if (grid) {
  const chipsBox = document.getElementById("chips");
  const searchInput = document.getElementById("searchInput");
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");
  const state = { category: "All", query: "" };

  /* Cards now go to the book page first; the locker button lives there */
  function cardHTML(book) {
    return `
      <article class="card reveal" data-category="${esc(book.category)}">
        <span class="card-tab">${esc(book.category)}</span>
        ${coverHTML(book)}
        <div class="card-body">
          <h3 class="card-title">${esc(book.title)}</h3>
          <p class="card-author">${esc(book.author)}</p>
          ${solvesHTML(book)}
          <p class="blurb">${esc(book.blurb)}</p>
          <a class="btn btn-primary" href="book.html?id=${encodeURIComponent(book.id)}">See the summary</a>
        </div>
      </article>`;
  }

  function renderChips() {
    const categories = ["All", ...new Set(allBooks().map(b => b.category || "General"))];
    chipsBox.innerHTML = categories.map(cat => `
      <button class="chip" type="button" data-category="${esc(cat)}"
              aria-pressed="${cat === state.category}">${esc(cat)}</button>
    `).join("");
  }

  function render() {
    const books = allBooks();
    const q = state.query.trim().toLowerCase();

    const visible = books.filter(b => {
      const cat = b.category || "General";
      const inCat = state.category === "All" || cat === state.category;
      const inQuery = !q || [b.title, b.author, b.problem, b.blurb, cat]
        .join(" ").toLowerCase().includes(q);
      return inCat && inQuery;
    });

    grid.innerHTML = visible.map(cardHTML).join("");
    emptyState.hidden = visible.length > 0;
    resultCount.textContent = visible.length === books.length
      ? `${visible.length} books on the shelf`
      : `${visible.length} of ${books.length} books`;

    grid.querySelectorAll(".cover img").forEach(watchCover);

    if (!reduceMotion) {
      grid.querySelectorAll(".card").forEach((el, i) => {
        el.classList.add("entering");
        el.style.animationDelay = `${Math.min(i * 50, 300)}ms`;
        el.addEventListener("animationend", () => {
          el.classList.remove("entering");
          el.style.animationDelay = "";
        }, { once: true });
      });
    }

    observeReveals();
  }

  chipsBox.addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    chipsBox.querySelectorAll(".chip").forEach(c =>
      c.setAttribute("aria-pressed", String(c === chip)));
    render();
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render();
  });

  renderChips();
  render();
}

/* ============================================================
   Book page (book.html) — renders the book from ?id=...
   ============================================================ */

const detail = document.getElementById("bookDetail");

if (detail) {
  const id = new URLSearchParams(location.search).get("id");
  const book = allBooks().find(b => b.id === id);

  if (!book) {
    detail.innerHTML = `
      <div class="not-found">
        <h1>That book isn't on the shelf</h1>
        <p>It may have been moved or the link is off.</p>
        <a class="btn btn-soft" href="index.html#books">Back to the books</a>
      </div>`;
  } else {
    document.title = `${book.title} — Page & Pause`;
    const cat = book.category || "General";
    detail.innerHTML = `
      <a class="back-link" href="index.html#books">← All books</a>
      <article class="detail-card">
        <span class="card-tab">${esc(cat)}</span>
        ${coverHTML(book)}
        <div class="detail-body">
          <h1 class="card-title">${esc(book.title)}</h1>
          <p class="card-author">${esc(book.author)}</p>
          ${solvesHTML(book)}
          <p class="blurb detail-blurb">${esc(book.blurb)}</p>
          <a class="btn btn-primary" href="${esc(book.lockerUrl)}"
             target="_blank" rel="noopener noreferrer">Get the free summary</a>
          <p class="detail-note">Opens in a new tab. Some links lead to sponsored offers.</p>
        </div>
      </article>`;
    detail.querySelectorAll(".cover img").forEach(watchCover);
  }
}

/* ============================================================
   Fade-up on scroll (IntersectionObserver)
   ============================================================ */

function observeReveals() {
  const targets = document.querySelectorAll(".reveal:not(.visible)");
  if (reduceMotion) {
    targets.forEach(el => el.classList.add("visible"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  targets.forEach(el => revealObserver.observe(el));
}

/* ============================================================
   Evening (dark) mode toggle — simple sun/moon, remembered
   ============================================================ */

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  themeToggle.setAttribute("aria-label",
    dark ? "Switch to daytime (light) mode" : "Switch to evening (dark) mode");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("pp-theme", next);
    applyTheme(next);
  });
  applyTheme(document.documentElement.dataset.theme);
}

/* ---- Footer year ---- */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---- Reveal anything already on the page (hero, steps, detail) ---- */
observeReveals();

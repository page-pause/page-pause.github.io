/* ============================================================
   Page & Pause — admin.js
   Shelf manager: login + add books to this browser's shelf.

   ⚠ HONEST WARNING: this is a static site, so this login is
   *obfuscation, not real security*. The password is stored as
   a hash, but anyone who can read the page source and knows
   a little JS can get in. Fine for keeping visitors out;
   do not store anything sensitive here.
   ============================================================ */

const ADMIN_STORE_KEY = "pp-admin-books";
const SESSION_KEY = "pp-admin-session";

/* ---- Credentials (stored as hashes, never in plain text) ---- */
const VALID_USER = "saadouch66";
const VALID_SHA256 = "5654d31e38b0616407a09852195de530a2f2e6d8f625236dc951df9e016e9715";
const VALID_FALLBACK = 1835970457; // used when crypto.subtle is unavailable (file://)

/* Hash a string: SHA-256 when available, simple 32-bit hash otherwise */
async function hashPassword(str) {
  if (window.crypto && crypto.subtle && crypto.subtle.digest) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (const ch of str) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0;
  return h;
}

/* esc() comes from script.js, which loads before this file */

/* ============================================================
   Views
   ============================================================ */

const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const bookForm = document.getElementById("bookForm");
const formError = document.getElementById("formError");
const formOk = document.getElementById("formOk");
const adminList = document.getElementById("adminList");
const adminEmpty = document.getElementById("adminEmpty");

function showAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
  renderList();
}

function showLogin() {
  adminView.hidden = true;
  loginView.hidden = false;
}

/* ---- Login ---- */
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value;
  const hashed = await hashPassword(pass);
  const ok = user === VALID_USER &&
    (hashed === VALID_SHA256 || hashed === VALID_FALLBACK);
  if (ok) {
    sessionStorage.setItem(SESSION_KEY, "1");
    loginError.hidden = true;
    loginForm.reset();
    showAdmin();
  } else {
    loginError.hidden = false;
    document.getElementById("password").value = "";
    document.getElementById("password").focus();
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

/* ============================================================
   Books stored in this browser
   ============================================================ */

function getStored() {
  try { return JSON.parse(localStorage.getItem(ADMIN_STORE_KEY)) || []; }
  catch (e) { return []; }
}

function saveStored(list) {
  localStorage.setItem(ADMIN_STORE_KEY, JSON.stringify(list));
}

/* ---- Add a book ---- */
bookForm.addEventListener("submit", e => {
  e.preventDefault();
  formOk.hidden = true;
  formError.hidden = true;

  const title = document.getElementById("fTitle").value.trim();
  const blurb = document.getElementById("fBlurb").value.trim();
  const author = document.getElementById("fAuthor").value.trim();
  const cover = document.getElementById("fCover").value.trim();
  const lockerUrl = document.getElementById("fLocker").value.trim();
  const category = document.getElementById("fCategory").value.trim() || "General";
  const problem = document.getElementById("fProblem").value.trim();

  if (!title || !blurb || !author || !cover || !lockerUrl) {
    formError.textContent = "Please fill in all required fields.";
    formError.hidden = false;
    return;
  }

  const list = getStored();
  const id = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book")
    + "-" + Date.now().toString(36);

  list.push({
    id, title, author, category, problem,
    blurb,
    cover,
    lockerUrl,
    badge: "",
    addedAt: new Date().toISOString()
  });
  saveStored(list);

  bookForm.reset();
  formOk.hidden = false;
  renderList();
});

/* ---- List / delete / copy ---- */
function snippetFor(b) {
  return `  {
    id: "${b.id}",
    title: ${JSON.stringify(b.title)},
    author: ${JSON.stringify(b.author)},
    category: ${JSON.stringify(b.category)},
    problem: ${JSON.stringify(b.problem)},
    blurb: ${JSON.stringify(b.blurb)},
    cover: ${JSON.stringify(b.cover)},
    lockerUrl: ${JSON.stringify(b.lockerUrl)},
    badge: ""
  }`;
}

function renderList() {
  const list = getStored();
  adminEmpty.hidden = list.length > 0;
  adminList.innerHTML = "";

  list.forEach((b, i) => {
    const li = document.createElement("li");
    li.className = "admin-item";
    li.innerHTML = `
      <div class="admin-item-info">
        <strong>${esc(b.title)}</strong>
        <span>${esc(b.author)} · ${esc(b.category)}</span>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-soft btn-small" data-act="copy">Copy book code</button>
        <button class="btn btn-soft btn-small" data-act="delete">Delete</button>
      </div>`;

    li.querySelector('[data-act="copy"]').addEventListener("click", async () => {
      const text = snippetFor(b);
      const btn = li.querySelector('[data-act="copy"]');
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied!";
      } catch (e) {
        // Fallback for browsers without clipboard permission
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        btn.textContent = "Copied!";
      }
      setTimeout(() => { btn.textContent = "Copy book code"; }, 1800);
    });

    li.querySelector('[data-act="delete"]').addEventListener("click", () => {
      const next = getStored();
      next.splice(i, 1);
      saveStored(next);
      renderList();
    });

    adminList.appendChild(li);
  });
}

/* ---- Session restore ---- */
if (sessionStorage.getItem(SESSION_KEY) === "1") showAdmin();
else showLogin();

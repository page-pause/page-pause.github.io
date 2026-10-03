/* ============================================================
   Page & Pause — admin.js
   Shelf manager: login + add, edit, hide and delete books.
   Edits to built-in books are stored as overrides in this
   browser — use "Copy book code" to publish them.

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
const formTitle = document.getElementById("formTitle");
const formSubmit = document.getElementById("formSubmit");
const cancelEdit = document.getElementById("cancelEdit");
const formError = document.getElementById("formError");
const formOk = document.getElementById("formOk");
const adminList = document.getElementById("adminList");
const adminEmpty = document.getElementById("adminEmpty");
const saveDownloadBtn = document.getElementById("saveDownloadBtn");
const exportStatus = document.getElementById("exportStatus");

let editingId = null; // id of the book being edited, or null while adding

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

/* Built-in books hidden from the shelf in this browser (ids only).
   Key name differs from script.js's HIDDEN_KEY on purpose. */
const HIDDEN_STORE_KEY = "pp-hidden-books";

function getHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_STORE_KEY)) || []; }
  catch (e) { return []; }
}

function saveHidden(list) {
  localStorage.setItem(HIDDEN_STORE_KEY, JSON.stringify(list));
}

/* Does this id ship in script.js? */
function isBuiltin(id) {
  return BOOKS.some(b => b.id === id);
}

/* Built-ins first (edits and hides applied), then books added here.
   Each row carries a state: "builtin" | "edited" | "hidden" | "added". */
function shelfBooks() {
  const stored = getStored();
  const hidden = getHidden();
  const storedById = new Map(stored.map(b => [b.id, b]));

  const rows = BOOKS.map(b => {
    const edited = storedById.get(b.id);
    return {
      ...(edited || b),
      state: hidden.includes(b.id) ? "hidden" : edited ? "edited" : "builtin"
    };
  });
  stored.filter(b => !isBuiltin(b.id))
       .forEach(b => rows.push({ ...b, state: "added" }));
  return rows;
}

/* Form input id per book field — used to read and fill the form */
const FIELDS = {
  title: "fTitle", blurb: "fBlurb", author: "fAuthor", cover: "fCover",
  lockerUrl: "fLocker", category: "fCategory", problem: "fProblem"
};

/* Read the form (null if a required field is empty) */
function readForm() {
  const data = {};
  for (const key in FIELDS) data[key] = document.getElementById(FIELDS[key]).value.trim();
  data.category = data.category || "General";
  if (!data.title || !data.blurb || !data.author || !data.cover || !data.lockerUrl) return null;
  return data;
}

/* ---- Add mode vs edit mode ---- */
function setFormMode(editId) {
  editingId = editId || null;
  const editing = !!editingId;
  formTitle.textContent = editing ? "Edit book" : "Add a book";
  formSubmit.textContent = editing ? "Save changes" : "Add book";
  cancelEdit.hidden = !editing;
}

function startEdit(id) {
  const book = shelfBooks().find(b => b.id === id);
  if (!book) return;
  for (const key in FIELDS) {
    const v = key === "category" && book.category === "General" ? "" : book[key];
    document.getElementById(FIELDS[key]).value = v || "";
  }
  formOk.hidden = true;
  formError.hidden = true;
  setFormMode(id);
  bookForm.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  document.getElementById("fTitle").focus({ preventScroll: true });
}

cancelEdit.addEventListener("click", () => {
  bookForm.reset();
  setFormMode(null);
  formOk.hidden = true;
  formError.hidden = true;
});

/* ---- Add a book / save edits ---- */
bookForm.addEventListener("submit", e => {
  e.preventDefault();
  formOk.hidden = true;
  formError.hidden = true;

  const data = readForm();
  if (!data) {
    formError.textContent = "Please fill in all required fields.";
    formError.hidden = false;
    return;
  }

  const list = getStored();

  if (editingId) {
    const i = list.findIndex(b => b.id === editingId);
    if (i >= 0) {
      // Added in this browser — update in place, same id so links keep working
      list[i] = { ...list[i], ...data };
    } else {
      // Built-in book — save an override with the same id
      const original = BOOKS.find(b => b.id === editingId);
      list.push({
        ...data,
        id: editingId,
        badge: original ? original.badge : "",
        addedAt: new Date().toISOString()
      });
    }
    saveStored(list);
    formOk.textContent = "Changes saved — it's on the shelf below.";
  } else {
    const id = (data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book")
      + "-" + Date.now().toString(36);
    list.push({ ...data, id, badge: "", addedAt: new Date().toISOString() });
    saveStored(list);
    formOk.textContent = "Saved — it's on the shelf below.";
  }

  bookForm.reset();
  setFormMode(null);
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
    badge: ${JSON.stringify(b.badge || "")}
  }`;
}

/* Delete needs two clicks — a stray click shouldn't lose a book */
let pendingDelete = null;

function armDelete(btn) {
  disarmDelete();
  btn.classList.add("btn-danger");
  btn.textContent = "Sure? Delete";
  pendingDelete = { btn, timer: setTimeout(disarmDelete, 3000) };
}

function disarmDelete() {
  if (!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  pendingDelete.btn.classList.remove("btn-danger");
  pendingDelete.btn.textContent = "Delete";
  pendingDelete = null;
}

function renderList() {
  disarmDelete();
  const rows = shelfBooks();
  adminEmpty.hidden = rows.length > 0;
  adminList.innerHTML = "";

  const TAGS = {
    builtin: "Built-in",
    edited: "Built-in · Edited",
    hidden: "Hidden",
    added: "This browser"
  };

  rows.forEach(b => {
    const li = document.createElement("li");
    li.className = "admin-item";
    li.dataset.state = b.state;
    li.innerHTML = `
      <div class="admin-item-info">
        <strong>${esc(b.title)}<span class="admin-tag">${TAGS[b.state]}</span></strong>
        <span>${esc(b.author)} · ${esc(b.category || "General")}</span>
      </div>
      <div class="admin-item-actions"></div>`;

    const actions = li.querySelector(".admin-item-actions");
    const addBtn = (label, cls, fn) => {
      const btn = document.createElement("button");
      btn.className = "btn " + cls;
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", fn);
      actions.appendChild(btn);
      return btn;
    };

    if (b.state === "hidden") {
      // Hidden built-in — only offer bringing it back
      addBtn("Restore", "btn-soft btn-small", () => {
        saveHidden(getHidden().filter(id => id !== b.id));
        renderList();
      });
    } else {
      addBtn("Edit", "btn-soft btn-small", () => startEdit(b.id));

      const copyBtn = addBtn("Copy book code", "btn-soft btn-small", async () => {
        const text = snippetFor(b);
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "Copied!";
        } catch (e) {
          // Fallback for browsers without clipboard permission
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          copyBtn.textContent = "Copied!";
        }
        setTimeout(() => { copyBtn.textContent = "Copy book code"; }, 1800);
      });

      if (b.state === "added") {
        addBtn("Delete", "btn-soft btn-small", function () {
          if (pendingDelete && pendingDelete.btn === this) {
            disarmDelete();
            saveStored(getStored().filter(x => x.id !== b.id));
            renderList();
          } else {
            armDelete(this);
          }
        });
      } else {
        if (b.state === "edited") {
          addBtn("Revert", "btn-soft btn-small", () => {
            saveStored(getStored().filter(x => x.id !== b.id));
            renderList();
          });
        }
        // Built-ins can't be removed from script.js here — hide them instead
        addBtn("Hide", "btn-soft btn-small", () => {
          const hidden = getHidden();
          if (!hidden.includes(b.id)) hidden.push(b.id);
          saveHidden(hidden);
          renderList();
        });
      }
    }

    adminList.appendChild(li);
  });
}

/* ---- Export the current public shelf as books.json ---- */
function exportBooksJson() {
  const cleanBooks = shelfBooks()
    .filter(b => b.state !== "hidden")
    .map(({ state, addedAt, ...book }) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      category: book.category || "General",
      problem: book.problem || "",
      blurb: book.blurb,
      cover: book.cover,
      lockerUrl: book.lockerUrl,
      badge: book.badge || ""
    }));

  const json = JSON.stringify(cleanBooks, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "books.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  exportStatus.textContent = `Downloaded books.json with ${cleanBooks.length} book${cleanBooks.length === 1 ? "" : "s"}.`;
  exportStatus.hidden = false;
}

saveDownloadBtn.addEventListener("click", exportBooksJson);

/* ---- Session restore ---- */
if (sessionStorage.getItem(SESSION_KEY) === "1") showAdmin();
else showLogin();

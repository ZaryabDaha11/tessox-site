// Mobile nav
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

document.getElementById("year").textContent = new Date().getFullYear();

// Leak-guard demo. Rules are checked in order; earlier rules win on overlap.
const RULES = [
  { label: "Private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { label: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { label: "OpenAI API key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { label: "AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { label: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { label: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { label: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { label: "Connection string", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'"]+/g },
  { label: "Password", re: /\b(?:password|passwd|pwd|secret)\s*[:=]\s*\S+/gi },
  { label: "Card number", re: /\b(?:\d[ -]?){13,16}\b/g },
  { label: "Email address", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
];

const EXAMPLE = `Hey, can you fix this script? It keeps failing.

OPENAI_API_KEY=sk-proj-Xk29fLq8Zt0iWm4Rv1Nc7yBa0YdEey5Hg3Jk
AWS_KEY=AKIAZ427QX4M92N8P45R1T3W
DATABASE_URL=postgres://admin:hunter2@db.internal:5432/prod
password: Summer2026!

Send any questions to sarah.jones@acme-corp.com`;

const input = document.getElementById("demoInput");
const output = document.getElementById("demoOutput");
const status = document.getElementById("demoStatus");
const findingsEl = document.getElementById("demoFindings");

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function scan(text) {
  const hits = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      const start = m.index, end = start + m[0].length;
      if (!hits.some((h) => start < h.end && end > h.start)) hits.push({ start, end, label: rule.label });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function render() {
  const text = input.value;
  const hits = scan(text);
  let html = "", pos = 0;
  for (const h of hits) {
    html += escapeHtml(text.slice(pos, h.start));
    html += `<span class="redacted">[${escapeHtml(h.label.toUpperCase())} REDACTED]</span>`;
    pos = h.end;
  }
  html += escapeHtml(text.slice(pos));
  output.innerHTML = html || '<span style="color:var(--muted)">Nothing to send.</span>';

  if (hits.length) {
    status.textContent = `${hits.length} leak${hits.length > 1 ? "s" : ""} blocked`;
    status.className = "status warn";
  } else {
    status.textContent = "Clean";
    status.className = "status ok";
  }

  const counts = {};
  hits.forEach((h) => (counts[h.label] = (counts[h.label] || 0) + 1));
  findingsEl.innerHTML = Object.entries(counts)
    .map(([label, n]) => `<li>${escapeHtml(label)}${n > 1 ? ` ×${n}` : ""}</li>`)
    .join("");
}

input.value = EXAMPLE;
input.addEventListener("input", render);
document.getElementById("demoReset").addEventListener("click", () => {
  input.value = EXAMPLE;
  render();
});
render();

// Contact form → n8n webhook. Falls back to mailto if no webhook is set or it can't be reached.
const CONTACT_WEBHOOK = "https://n8n-smartmarketer.duckdns.org/webhook/tessox-enquiry";
const CONTACT_EMAIL = "zaryabdaha111@gmail.com";

const contactForm = document.getElementById("contactForm");
const contactSubmit = document.getElementById("contactSubmit");
const formStatus = document.getElementById("formStatus");

function mailtoFor(f) {
  const company = f.get("company") ? `, ${f.get("company")}` : "";
  const subject = `${f.get("topic")} enquiry — ${f.get("name")}${company}`;
  const body = `${f.get("message")}\n\n${f.get("name")}${company} (${f.get("email")})`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function setStatus(state, html) {
  formStatus.classList.remove("is-error", "is-success");
  if (state) formStatus.classList.add(state);
  formStatus.innerHTML = html;
}

// Clear the form but keep it on screen, with a confirmation under the button.
function showSuccess() {
  contactForm.reset();
  setStatus("is-success", "✓ Thanks, your enquiry has been received. We'll reply within one business day.");
}

contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(contactForm);

  // Bots fill the hidden field; pretend it worked and drop it.
  if (f.get("website")) { showSuccess(); return; }

  if (!CONTACT_WEBHOOK) { window.location.href = mailtoFor(f); return; }

  // Form-encoded keeps this a "simple" request, so the browser skips the CORS preflight.
  const payload = new URLSearchParams({
    name: f.get("name"),
    email: f.get("email"),
    company: f.get("company") || "",
    topic: f.get("topic"),
    message: f.get("message"),
    page: location.href,
    submittedAt: new Date().toISOString(),
  });

  contactSubmit.disabled = true;
  contactSubmit.firstChild.textContent = "Sending… ";
  setStatus(null, "Sending your enquiry…");

  try {
    const res = await fetch(CONTACT_WEBHOOK, { method: "POST", body: payload });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showSuccess();
  } catch {
    setStatus("is-error", `Couldn't send that. Please try again, or <a href="${mailtoFor(f)}">email us directly</a>.`);
  } finally {
    contactSubmit.disabled = false;
    contactSubmit.firstChild.textContent = "Send enquiry ";
  }
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Sticky nav background, scroll progress bar and active nav link
const nav = document.getElementById("nav");
const progress = document.getElementById("progress");
const navAnchors = [...navLinks.querySelectorAll('a[href^="#"]:not(.btn)')];
const sections = navAnchors.map((a) => document.querySelector(a.getAttribute("href")));

function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle("scrolled", y > 10);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  let current = -1;
  sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) current = i; });
  navAnchors.forEach((a, i) => a.classList.toggle("active", i === current));
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Cursor spotlight on cards
document.querySelectorAll(".spot").forEach((el) => {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});

// Hero console: types out a looping log of automation runs
const consoleBody = document.getElementById("consoleBody");
const LOG = [
  ["t", "09:00:00 ", "info", "▶ lead-routing · scanning forums"],
  ["t", "09:00:41 ", "in", "brand mentions found → scoring intent"],
  ["t", "09:00:44 ", "ok", "✓ qualified leads pushed to CRM"],
  ["t", "09:15:00 ", "info", "▶ weekly-report · Shopify + GA4 + CRM"],
  ["t", "09:15:12 ", "ok", "✓ synced to Postgres · report sent to Slack"],
  ["t", "09:30:00 ", "info", "▶ seo-audit · crawling client URLs"],
  ["t", "09:31:02 ", "ok", "✓ missing H1 / schema flagged · report ready"],
  ["t", "09:45:00 ", "info", "▶ research-agent · drafting summary"],
  ["t", "09:45:01 ", "warn", "✕ API key found in prompt context"],
  ["t", "09:45:01 ", "ok", "✓ redacted before sending to LLM"],
  ["t", "09:45:30 ", "ok", "✓ executive report delivered · 0 secrets leaked"],
];

function lineEl(parts) {
  const span = document.createElement("span");
  span.className = "ln";
  for (let i = 0; i < parts.length; i += 2) {
    const s = document.createElement("span");
    s.className = parts[i];
    s.textContent = parts[i + 1];
    span.appendChild(s);
  }
  return span;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runConsole() {
  if (reduceMotion) {
    LOG.forEach((l) => consoleBody.appendChild(lineEl(l)));
    return;
  }
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  for (;;) {
    consoleBody.textContent = "";
    for (const parts of LOG) {
      const el = lineEl([parts[0], parts[1], parts[2], ""]);
      consoleBody.appendChild(el);
      const target = el.lastChild;
      el.appendChild(cursor);
      for (const ch of parts[3]) {
        target.textContent += ch;
        await sleep(parts[2] === "in" ? 22 : 12);
      }
      await sleep(parts[2] === "info" ? 500 : 280);
    }
    await sleep(4000);
  }
}
runConsole();

// Count-up stats
function countUp(el) {
  const end = +el.dataset.count, suffix = el.dataset.suffix || "";
  if (reduceMotion) { el.textContent = end + suffix; return; }
  const dur = 1400, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Reveal on scroll, staggered within each group
const revealGroups = [
  ".sec-head", ".cards > *", ".projects > *", ".cases > *", ".steps > *",
  ".stack > *", ".team > *", ".stat", ".promise", ".demo", ".contact-panel",
];
const revealEls = [];
revealGroups.forEach((sel) => {
  document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add("reveal");
    el.style.setProperty("--d", `${(i % 4) * 0.08}s`);
    revealEls.push(el);
  });
});

const io = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add("in");
    en.target.querySelectorAll?.("[data-count]").forEach(countUp);
    io.unobserve(en.target);
  }),
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
revealEls.forEach((el) => io.observe(el));


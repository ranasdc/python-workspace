/**
 * Assembles a student's HTML, CSS and JS files into one self-contained
 * document for the preview iframe.
 *
 * The preview has no server and no origin of its own, so `<link>` and
 * `<script src>` pointing at sibling files would simply 404. Instead their
 * contents are inlined here, which is what makes a three-file project behave
 * the way the student expects when they press Run.
 */

export type PreviewFile = {
  name: string
  content: string
}

const HTML_EXTENSIONS = [".html", ".htm"]

function extOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot <= 0 ? "" : name.slice(dot).toLowerCase()
}

function isHtml(name: string) {
  return HTML_EXTENSIONS.includes(extOf(name))
}

type RefResolution =
  /** Points outside the workspace (CDN, site root); leave it for the browser. */
  | { kind: "external" }
  | { kind: "found"; file: PreviewFile }
  /** Names a sibling file that does not exist, so it can never load. */
  | { kind: "missing"; name: string }

/**
 * Resolve a reference like "./style.css" or "style.css" against the flat file
 * list.
 *
 * The distinction between "external" and "missing" matters: the frame has no
 * origin of its own, so a relative URL resolves against the parent app and a
 * typo like `style.cs` would quietly fetch a 404 page from mycodepad itself.
 * Those references are reported to the student instead of being left in.
 */
function resolveRef(files: PreviewFile[], ref: string): RefResolution {
  const cleaned = ref.trim().replace(/^\.\//, "")
  if (!cleaned || /^[a-z][a-z0-9+.-]*:/i.test(cleaned) || cleaned.startsWith("//")) {
    return { kind: "external" }
  }
  if (cleaned.startsWith("/") || cleaned.includes("..")) return { kind: "external" }

  const target = cleaned.split(/[?#]/)[0]
  const file = files.find((f) => f.name.toLowerCase() === target.toLowerCase())
  return file ? { kind: "found", file } : { kind: "missing", name: target }
}

/**
 * `</script>` inside student JS would close the tag we are writing it into and
 * break the rest of the document, so the sequence is split harmlessly.
 */
function escapeClosingTags(code: string) {
  return code.replace(/<\/(script|style)/gi, "<\\/$1")
}

/** Which HTML file the preview should render. */
export function pickEntryFile(
  files: PreviewFile[],
  activeFileName?: string | null,
): PreviewFile | null {
  const htmlFiles = files.filter((f) => isHtml(f.name))
  if (htmlFiles.length === 0) return null

  // Looking at an HTML file means previewing that page.
  if (activeFileName && isHtml(activeFileName)) {
    const active = htmlFiles.find(
      (f) => f.name.toLowerCase() === activeFileName.toLowerCase(),
    )
    if (active) return active
  }

  // Otherwise the conventional entry point, so editing style.css previews the
  // page that uses it rather than nothing at all.
  const index = htmlFiles.find((f) => f.name.toLowerCase() === "index.html")
  return index ?? htmlFiles[0]
}

/** Every sibling file an HTML page points at through a stylesheet or script. */
function referencedNames(html: string): string[] {
  const names: string[] = []

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*["']?stylesheet["']?/i.test(tag)) continue
    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]
    if (href) names.push(href)
  }

  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
    names.push(match[1])
  }

  return names
}

/**
 * The files that belong with `entryName` when it leaves the workspace: the
 * file itself, plus every sibling it references.
 *
 * References are resolved exactly the way the preview resolves them, so a
 * downloaded page behaves like the one the pupil just ran — a lone `.py` comes
 * out on its own, while `index.html` brings its stylesheet and script along.
 */
export function collectAssociatedFiles(
  files: PreviewFile[],
  entryName: string,
): PreviewFile[] {
  const entry = files.find((f) => f.name.toLowerCase() === entryName.toLowerCase())
  if (!entry) return []
  if (!isHtml(entry.name)) return [entry]

  const collected = [entry]
  const seen = new Set([entry.name.toLowerCase()])

  for (const ref of referencedNames(entry.content)) {
    const resolved = resolveRef(files, ref)
    // "external" points at a CDN and "missing" at nothing at all; neither is a
    // file this workspace can hand over.
    if (resolved.kind !== "found") continue
    const key = resolved.file.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    collected.push(resolved.file)
  }

  return collected
}

function inlineStylesheets(html: string, files: PreviewFile[], missing: string[]) {
  // Matches <link ... rel="stylesheet" ... href="...">, attributes in any order.
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel\s*=\s*["']?stylesheet["']?/i.test(tag)) return tag

    const href = tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]
    if (!href) return tag

    const ref = resolveRef(files, href)
    if (ref.kind === "external") return tag
    if (ref.kind === "missing") {
      missing.push(ref.name)
      return ""
    }

    return `<style data-source="${ref.file.name}">\n${escapeClosingTags(ref.file.content)}\n</style>`
  })
}

function inlineScripts(html: string, files: PreviewFile[], missing: string[]) {
  return html.replace(
    /<script\b([^>]*)\bsrc\s*=\s*["']([^"']*)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const ref = resolveRef(files, src)
      if (ref.kind === "external") return tag
      if (ref.kind === "missing") {
        missing.push(ref.name)
        return ""
      }

      // Preserve type/defer/module attributes the student wrote.
      const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim()
      return `<script${attrs ? ` ${attrs}` : ""} data-source="${ref.file.name}">\n${escapeClosingTags(
        ref.file.content,
      )}\n</script>`
    },
  )
}

/**
 * The frame's line back to the app around it.
 *
 * Forwards runtime errors to the parent so the preview can surface them.
 * Without this a syntax error in student JS fails silently inside the iframe
 * and the page just looks broken for no visible reason.
 *
 * It also answers the parent's request for a screenshot. The frame is sandboxed
 * to an origin of its own, so the parent cannot look inside it; the page has to
 * describe itself. It replies with its current DOM — after any scripts have
 * changed it — with the scripts themselves removed, canvases frozen to images
 * and, where the host allows it, pictures inlined, since the renderer on the
 * other side fetches nothing.
 */
const PREVIEW_BRIDGE = `<script>
(function () {
  function post(message) {
    try {
      parent.postMessage({ source: "mycodepad-preview", message: String(message) }, "*");
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    post(e.message + (e.lineno ? " (line " + e.lineno + ")" : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    post("Unhandled promise rejection: " + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  function solid(element) {
    if (!element) return "";
    var colour = getComputedStyle(element).backgroundColor;
    return colour && colour !== "transparent" && colour !== "rgba(0, 0, 0, 0)" ? colour : "";
  }

  function inlinePicture(picture) {
    var address = picture.src;
    if (!/^https?:/i.test(address)) return null;
    return fetch(address)
      .then(function (response) {
        if (!response.ok) throw new Error("unavailable");
        return response.blob();
      })
      .then(function (blob) {
        if (blob.type.indexOf("image/") !== 0) return;
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onloadend = function () {
            if (typeof reader.result === "string") {
              picture.removeAttribute("srcset");
              picture.src = reader.result;
            }
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () {});
  }

  window.addEventListener("message", function (e) {
    var request = e.data;
    if (e.source !== parent || !request || request.source !== "mycodepad-host" || request.type !== "capture") return;

    function reply(payload) {
      payload.source = "mycodepad-preview";
      payload.type = "capture";
      payload.id = request.id;
      try {
        parent.postMessage(payload, "*");
      } catch (err) {}
    }

    try {
      var root = document.documentElement;
      var body = document.body;
      var copy = root.cloneNode(true);
      var i;

      var live = root.querySelectorAll("canvas");
      var drawn = copy.querySelectorAll("canvas");
      for (i = 0; i < live.length; i++) {
        try {
          var still = document.createElement("img");
          still.src = live[i].toDataURL();
          still.width = live[i].width;
          still.height = live[i].height;
          if (live[i].id) still.id = live[i].id;
          still.className = live[i].className;
          still.style.cssText = live[i].style.cssText;
          drawn[i].parentNode.replaceChild(still, drawn[i]);
        } catch (err) {}
      }

      var inert = copy.querySelectorAll("script, noscript, iframe");
      for (i = 0; i < inert.length; i++) inert[i].parentNode.removeChild(inert[i]);

      var jobs = [];
      var pictures = copy.querySelectorAll("img");
      for (i = 0; i < pictures.length; i++) {
        var job = inlinePicture(pictures[i]);
        if (job) jobs.push(job);
      }

      var sent = false;
      var send = function () {
        if (sent) return;
        sent = true;
        try {
          reply({
            markup: new XMLSerializer().serializeToString(copy),
            width: Math.max(root.scrollWidth, root.clientWidth),
            height: Math.max(root.scrollHeight, body ? body.scrollHeight : 0),
            viewportHeight: window.innerHeight,
            background: solid(root) || solid(body) || "#ffffff"
          });
        } catch (err) {
          reply({ error: String(err && err.message ? err.message : err) });
        }
      };

      Promise.all(jobs).then(send, send);
      // A picture on a slow host must not hold the screenshot up indefinitely.
      setTimeout(send, 4000);
    } catch (err) {
      reply({ error: String(err && err.message ? err.message : err) });
    }
  });
})();
</script>`

export type PreviewBuild = {
  /** The assembled document for the iframe's `srcdoc`. */
  document: string
  /** Sibling files the page links to that the student has not created. */
  missing: string[]
}

/**
 * Build the document to hand to the iframe's `srcdoc`.
 *
 * Returns null when there is no HTML file to render, which the preview panel
 * turns into an explanatory empty state rather than a blank frame.
 */
export function buildPreviewDocument(
  files: PreviewFile[],
  activeFileName?: string | null,
): PreviewBuild | null {
  const entry = pickEntryFile(files, activeFileName)
  if (!entry) return null

  const missing: string[] = []
  let html = entry.content
  html = inlineStylesheets(html, files, missing)
  html = inlineScripts(html, files, missing)

  // Inject the bridge first so it catches errors thrown by student scripts.
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${PREVIEW_BRIDGE}`)
  } else {
    html = `${PREVIEW_BRIDGE}\n${html}`
  }

  return { document: html, missing: [...new Set(missing)] }
}

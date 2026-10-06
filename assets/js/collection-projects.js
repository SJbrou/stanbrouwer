(() => {
  "use strict";

  const config = window.COLLECTION_PROJECTS_CONFIG;
  let request;
  let callbackCount = 0;
  const text = cell => String(cell?.f ?? cell?.v ?? "").trim();
  const slug = title => title.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  const safeUrl = value => {
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  };
  const href = key => `${config.detailUrl}?project=${encodeURIComponent(key)}`;
  const fromCells = cells => ({
    date: text(cells[0]), title: text(cells[1]), category: text(cells[2]),
    image: safeUrl(text(cells[3])), externalUrl: safeUrl(text(cells[4])),
    description: text(cells[5]), slug: slug(text(cells[1]))
  });
  const normalise = response => {
    if (response?.status !== "ok" || !response.table) throw new Error("Projects could not be read.");
    const projects = (response.table.rows || []).map(row => fromCells(row.c || [])).filter(project => project.title);
    const keys = new Set();
    projects.forEach(project => {
      if (!project.slug || keys.has(project.slug)) throw new Error("Project titles need unique names.");
      keys.add(project.slug);
    });
    return projects;
  };

  const loadResponse = () => {
    if (request) return request;
    request = new Promise((resolve, reject) => {
      const callback = `collectionProjectsCallback${++callbackCount}`;
      const script = document.createElement("script");
      let settled = false;
      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        delete window[callback];
        script.remove();
        handler(value);
      };
      const timeout = window.setTimeout(() => finish(reject, new Error("Projects took too long to load.")), 10000);
      window[callback] = response => {
        try { normalise(response); finish(resolve, response); }
        catch (error) { finish(reject, error); }
      };
      script.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.sheetId)}/gviz/tq?sheet=PROJECTS&tqx=${encodeURIComponent(`out:json;responseHandler:${callback}`)}`;
      script.async = true;
      script.onerror = () => finish(reject, new Error("Projects are unavailable right now."));
      document.head.append(script);
    }).catch(error => { request = null; throw error; });
    return request;
  };
  const load = () => loadResponse().then(normalise);

  const element = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  };

  // Construct Markdown as DOM nodes so sheet content can never introduce raw HTML.
  const inline = (value, parent, depth = 0) => {
    if (depth > 6) { parent.append(document.createTextNode(value)); return; }
    const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
    let cursor = 0;
    for (const match of value.matchAll(pattern)) {
      parent.append(document.createTextNode(value.slice(cursor, match.index)));
      const destination = match[1] ? safeUrl(match[2]) : null;
      if (match[1] && !destination) parent.append(document.createTextNode(match[0]));
      else {
        const node = element(match[1] ? "a" : match[3] || match[4] ? "strong" : "em");
        if (destination) { node.href = destination; node.rel = "noreferrer"; }
        inline(match[1] || match[3] || match[4] || match[5] || match[6], node, depth + 1);
        parent.append(node);
      }
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(value.slice(cursor)));
  };

  const markdownSections = source => {
    const sections = [];
    let section = element("section", "project-detail__section");
    let paragraph = [];
    let list;
    const flush = () => {
      if (paragraph.length) {
        const node = element("p");
        paragraph.forEach((line, index) => {
          if (index) node.append(element("br"));
          inline(line, node);
        });
        section.append(node);
        paragraph = [];
      }
      list = null;
    };
    const finishSection = () => {
      flush();
      if (section.childNodes.length) sections.push(section);
      section = element("section", "project-detail__section");
    };
    source.split(/\r?\n/).forEach(line => {
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const item = line.match(/^\s*(?:([-*])|\d+[.)])\s+(.+)$/);
      if (!line.trim()) { flush(); return; }
      if (heading) {
        if (heading[1].length <= 2) finishSection();
        else flush();
        const node = element(`h${Math.max(2, heading[1].length)}`);
        inline(heading[2], node);
        section.append(node);
      } else if (item) {
        if (paragraph.length) flush();
        const kind = item[1] ? "ul" : "ol";
        if (!list || list.localName !== kind) { list = element(kind); section.append(list); }
        const node = element("li");
        inline(item[2], node);
        list.append(node);
      } else {
        list = null;
        paragraph.push(line);
      }
    });
    finishSection();
    return sections;
  };

  const frame = (host, title, variant = "modular") => {
    const surface = element("article", `collection-poster project-detail project-detail--${variant}`);
    surface.dataset.projectSurface = "";
    const nav = element("nav", "project-detail__nav");
    nav.setAttribute("aria-label", "Project navigation");
    const back = element("a", "project-detail__back", "← PROJECTS");
    back.href = `${config.homeUrl}#projects-title`;
    back.dataset.collectionHome = "";
    nav.append(back, element("span", "project-detail__signature", "PERSPECTIVE"));
    const header = element("header", "project-detail__header");
    const heading = element("h1", "project-detail__title", title);
    heading.tabIndex = -1;
    header.append(heading);
    surface.append(nav, header);
    host.replaceChildren(surface);
    return { surface, nav, header };
  };

  const render = (host, project, variant = "modular") => {
    const { surface, nav, header } = frame(host, project.title, variant);
    surface.dataset.projectSlug = project.slug;
    const headingRow = variant === "modular" ? element("div", "project-detail__heading-row") : null;
    if (headingRow) {
      headingRow.append(header.querySelector("h1"));
      header.append(headingRow);
    }
    const meta = element("dl", "project-detail__meta");
    [["DATE", project.date], ["CATEGORY", project.category]].forEach(([label, value]) => {
      if (!value) return;
      const item = element("div");
      item.append(element("dt", variant === "modular" ? "project-detail__meta-label" : null, label), element("dd", null, value));
      meta.append(item);
    });
    const body = element("div", "project-detail__body");
    const copy = element("div", "project-detail__copy");
    copy.append(...markdownSections(project.description));
    let aside;
    if (project.image) {
      surface.classList.add("has-image");
      aside = element("aside", "project-detail__aside");
      const figure = element("figure", "project-detail__figure");
      const image = element("img", "project-detail__image");
      image.src = project.image;
      image.alt = `Project image: ${project.title}`;
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => {
        figure.remove();
        surface.classList.remove("has-image");
        if (meta.parentNode === aside) header.append(meta);
        aside.remove();
      }, { once: true });
      figure.append(image);
      aside.append(figure);
      if (variant === "split" && meta.childNodes.length) aside.append(meta);
      if (variant === "modular") {
        headingRow.append(aside);
      } else body.append(aside);
    }
    const info = variant === "modular" ? element("div", "project-detail__meta-row") : header;
    if (meta.childNodes.length && meta.parentNode !== aside) info.append(meta);
    body.append(copy);
    if (project.externalUrl) {
      const link = element("a", "project-detail__external", "Open project ↗");
      link.href = project.externalUrl;
      link.rel = "noreferrer";
      if (variant === "modular") info.append(link);
      else {
        const footer = element("footer", "project-detail__footer");
        footer.append(link);
        surface.append(footer);
      }
    }
    if (variant === "modular") {
      surface.classList.add("has-ground");
      const ground = element("footer", "collection-outro project-detail__ground");
      ground.setAttribute("aria-hidden", "true");
      const groundImage = element("img", "collection-outro__image project-detail__ground-image");
      groundImage.src = config.transitionGridImage;
      groundImage.alt = "";
      groundImage.draggable = false;
      groundImage.decoding = "async";
      ground.append(groundImage);
      if (info.childNodes.length) nav.insertBefore(info, nav.querySelector(".project-detail__signature"));
      const content = element("div", "project-detail__content");
      content.append(header, body);
      surface.append(content);
      host.append(ground);
    } else surface.insertBefore(body, surface.querySelector(".project-detail__footer"));
    surface.setAttribute("aria-busy", "false");
  };

  const status = (host, title, message, retry) => {
    const { surface } = frame(host, title);
    const body = element("div", "project-detail__body project-detail__notice");
    const paragraph = element("p", null, message);
    paragraph.setAttribute("role", retry ? "alert" : "status");
    body.append(paragraph);
    if (retry) {
      const button = element("button", "project-detail__retry", "Try again ↗");
      button.type = "button";
      button.addEventListener("click", retry);
      body.append(button);
    }
    surface.append(body);
    surface.setAttribute("aria-busy", String(title.startsWith("Loading ")));
  };

  const renderIndex = (host, projects) => {
    const { surface } = frame(host, "PROJECTS");
    const list = element("ul", "project-detail__index");
    projects.filter(project => project.description).forEach(project => {
      const item = element("li");
      const link = element("a", null, project.title);
      link.href = href(project.slug);
      link.dataset.collectionProject = project.slug;
      item.append(link);
      list.append(item);
    });
    if (!list.childNodes.length) list.append(element("li", null, "No project details available yet."));
    surface.append(list);
    surface.setAttribute("aria-busy", "false");
  };

  const examples = {
    image: { title: "A place to gather", date: "August", category: "Space / DIY", image: config.exampleImage, externalUrl: "https://example.com/",
      description: "A room becomes a place through the things we do together.\n\nThis project starts with a simple question: what does a space need to feel welcoming? A long table, a little light, and enough room for an idea to grow.\n\n## Small interventions\nA few carefully chosen materials give the room its rhythm. Nothing complicated; each element has a purpose.", slug: "example-image" },
    text: { title: "Notes on making", date: "September", category: "Observation", image: null,
      description: "Some projects begin with a picture. This one begins with a thought.\n\nMaking something by hand changes how you look at everyday objects. A joint, a surface, the way light meets an edge: small details become the whole project.\n\n## An ongoing collection\nThese are notes from that process, gathered slowly and left open for the next experiment.", slug: "example-text" },
    long: { title: "An experiment in everyday perspective", date: "September", category: "Design / research", image: config.exampleImage, externalUrl: "https://example.com/",
      description: "A longer project description, with room for the idea, the process, and what happened along the way. This example uses the same layout as a short description.\n\n## Starting with a question\nWhat happens when we look at familiar things for a little longer? A room, an object, or a small routine can become an invitation to make something new.\n\nThe work began with **observation**, followed by a set of simple experiments. Each experiment changed one thing at a time, making it easier to understand what mattered.\n\n## Working with constraints\n- Use materials already at hand.\n- Keep the structure clear and practical.\n- Leave room for adjustments and unexpected discoveries.\n\nThese constraints became part of the design. Rather than adding more elements, the process focused on the relationship between the existing ones.\n\n### Light and proportion\nThe first studies explored how a square opening changes the feeling of a surface. Adjusting its position affected the balance of the whole composition.\n\n## From study to object\n1. Record the initial observations.\n2. Build a small prototype.\n3. Test it in the space where it will be used.\n4. Refine the details after living with it.\n\nA prototype is useful because it makes the question tangible. It can be moved, handled, and seen from another angle.\n\n## What remains\nThe result is deliberately simple. The interesting part lives in the details and in the way the object becomes part of everyday life.\n\nThis is an ongoing project, with more observations to come.", slug: "example-long" }
  };

  window.CollectionProjects = { fromCells, normalise, loadResponse, load, href, slug, render, status, renderIndex, examples };
})();

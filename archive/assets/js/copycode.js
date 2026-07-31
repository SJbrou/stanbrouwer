document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("pre").forEach((block) => {
      // prefer the surrounding <figure class="highlight"> if present
      const container = block.closest("figure.highlight") || block;

      // Create actions container
      const actions = document.createElement("div");
      actions.className = "code-actions";

      // Create copy button
      let copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.type = "button";
      copyBtn.innerText = "Copy";
      copyBtn.setAttribute("aria-label", "Copy code");

      // Create hide/show button
      let hideBtn = document.createElement("button");
      hideBtn.className = "hide-btn";
      hideBtn.type = "button";
      hideBtn.innerText = "Hide";
      hideBtn.setAttribute("aria-label", "Hide code");

      actions.appendChild(copyBtn);
      actions.appendChild(hideBtn);

      // Ensure container is positioned (figure or pre)
      if (container === block) block.style.position = "relative";
      container.appendChild(actions);

      // Copy to clipboard on click
      copyBtn.addEventListener("click", function () {
        let code = block.querySelector("code");
        if (!code) return;

        navigator.clipboard.writeText(code.innerText).then(() => {
          const prev = copyBtn.innerText;
          copyBtn.innerText = "Copied!";
          setTimeout(() => (copyBtn.innerText = prev), 2000);
        });
      });

      // Hide/show toggle
      hideBtn.addEventListener("click", function () {
        const fig = block.closest("figure.highlight");
        const target = fig || block;
        const isHidden = block.style.display === "none" || window.getComputedStyle(block).display === "none";
        if (!isHidden) {
          // hide the code block area
          block.style.display = "none";
          if (fig) fig.classList.add("figure-collapsed");
          hideBtn.innerText = "Show";
        } else {
          block.style.display = "block";
          if (fig) fig.classList.remove("figure-collapsed");
          hideBtn.innerText = "Hide";
        }
      });
    });
  });
  
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("figure.highlight").forEach((block) => {
    // Create the copy button
    let button = document.createElement("button");
    button.className = "copy-btn";
    button.innerText = "Copy";

    // Append the button inside the <pre> but before <code>
    block.style.position = "relative"; // Ensure pre is positioned
    block.insertBefore(button, block.firstChild);

    // Copy to clipboard on click
    button.addEventListener("click", function () {
      let code = block.querySelector("code");
      if (!code) return;

      // Remove trailing whitespaces from each line
      let cleanedCode = code.innerText.split('\n').map(line => line.trimEnd()).join('\n');

      navigator.clipboard.writeText(cleanedCode).then(() => {
        button.innerText = "Copied!";
        setTimeout(() => (button.innerText = "Copy"), 2000);
      });
    });
  });
});


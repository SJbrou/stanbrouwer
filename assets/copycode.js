document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("pre").forEach((block) => {
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
  
        navigator.clipboard.writeText(code.innerText).then(() => {
          button.innerText = "Copied!";
          setTimeout(() => (button.innerText = "Copy"), 2000);
        });
      });
    });
  });
  
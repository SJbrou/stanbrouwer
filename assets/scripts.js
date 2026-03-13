if (window.jQuery) {
  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  })
}

document.addEventListener("DOMContentLoaded", function () {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  root.setAttribute("data-theme", initialTheme);

  if (toggle) {
    toggle.innerText = initialTheme === "dark" ? "☀" : "◐";
    toggle.setAttribute("aria-label", initialTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    toggle.addEventListener("click", function () {
      const currentTheme = root.getAttribute("data-theme") || "light";
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      root.setAttribute("data-theme", nextTheme);
      localStorage.setItem("theme", nextTheme);
      toggle.innerText = nextTheme === "dark" ? "☀" : "◐";
      toggle.setAttribute("aria-label", nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }
});

(function () {
  var STORAGE_KEY = "ccp-theme";
  var saved = localStorage.getItem(STORAGE_KEY);
  var dark =
    saved === "dark" ||
    (!saved &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  updateToggleIcon(dark);
  // 防御：若按钮晚于本脚本解析（如放在 body 底部），解析完成后再同步一次图标
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      updateToggleIcon(
        document.documentElement.getAttribute("data-theme") === "dark",
      );
    });
  }

  function updateToggleIcon(isDark) {
    var btn = document.querySelector(".theme-toggle");
    if (btn) btn.textContent = isDark ? "☀️" : "🌓";
  }

  window.toggleTheme = function () {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    updateToggleIcon(next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  };
})();

export default function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = window.localStorage.getItem("artales-theme");
    var cookieMatch = document.cookie.match(/(?:^|; )artales_theme=([^;]+)/);
    var cookieTheme = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    var preferred = stored || cookieTheme;
    var theme = preferred === "dark" || preferred === "light"
      ? preferred
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.artalesTheme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.dataset.artalesTheme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

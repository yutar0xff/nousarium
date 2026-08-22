export const THEME_STORAGE_KEY = "nousarium-theme";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // ignore
  }
  return "system";
}

export function applyThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore
  }
  if (preference === "light" || preference === "dark") {
    document.documentElement.setAttribute("data-theme", preference);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

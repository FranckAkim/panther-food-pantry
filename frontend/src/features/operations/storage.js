import { defaultPickup } from "./data.js";

export function readActivePickup() {
  try {
    return JSON.parse(localStorage.getItem("panther-active-pickup")) || defaultPickup;
  } catch {
    return defaultPickup;
  }
}

export function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

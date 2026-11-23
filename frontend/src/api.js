import axios from "axios";

/** Kunci localStorage tempat token login disimpan. */
export const TOKEN_KEY = "studytrack_token";

/**
 * Instance axios untuk seluruh pemanggilan API backend.
 * Pada mode development, request `/api/*` di-proxy ke backend oleh Vite
 * (lihat `vite.config.js`).
 */
const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "")
});

// Menyisipkan token login dan offset zona waktu pengguna ke setiap request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Timezone-Offset"] = String(new Date().getTimezoneOffset());
  return config;
});

export default api;

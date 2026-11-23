/**
 * Entry point backend StudyTrack.
 *
 * Menyiapkan Express, mendaftarkan route tiap modul (auth, courses, tasks),
 * lalu menjalankan server.
 */
import express from "express";
import cors from "cors";

import { PORT, CORS_ORIGIN } from "./config.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import taskRoutes from "./routes/tasks.js";
import { resetDB } from "./db.js";

const app = express();

const corsOrigins =
  CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((origin) => origin.trim());

app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// GET /api/health - cek apakah server sedang berjalan
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "StudyTrack backend is running." });
});

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/tasks", taskRoutes);

/*
 * POST /api/dev/reset - mengembalikan data ke kondisi seed awal.
 *
 * Endpoint ini tidak memerlukan login, jadi hanya didaftarkan di luar mode
 * production supaya data tidak bisa direset oleh siapa pun setelah di-deploy.
 */
if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/reset", (req, res) => {
    resetDB();
    res.json({ success: true, message: "Database direset ke data seed awal." });
  });
}

// Fallback untuk endpoint yang tidak terdaftar
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan." });
});

app.listen(PORT, () => {
  console.log(`StudyTrack backend berjalan di http://localhost:${PORT}`);
});

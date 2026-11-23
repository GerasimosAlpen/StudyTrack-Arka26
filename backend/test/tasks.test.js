import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Socket } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import taskRoutes from "../routes/tasks.js";
import {
  getDeadlineStatus,
  parseDeadlineTimestamp,
  parseTimezoneOffset,
  sortTasksByUrgency
} from "../utils/deadline.js";

const WIB_OFFSET = -420;  // UTC+7
const WITA_OFFSET = -480; // UTC+8
const WIT_OFFSET = -540;  // UTC+9

function makeSeedTasks() {
  return [
    {
      id: 1,
      user_id: 1,
      mata_kuliah_id: 1,
      mata_kuliah: "Database Systems",
      judul: "Lab 4: Query Optimization Report",
      deadline: "2026-07-03T23:59:00",
      status: "belum",
      created_at: "2026-06-15T09:00:00"
    },
    {
      id: 2,
      user_id: 1,
      mata_kuliah_id: 2,
      mata_kuliah: "Data Structures",
      judul: "Project 3: BSTMap Implementation",
      deadline: "2026-07-02T10:00:00",
      status: "belum",
      created_at: "2026-06-16T14:00:00"
    },
    {
      id: 3,
      user_id: 1,
      mata_kuliah_id: 3,
      mata_kuliah: "Software Engineering",
      judul: "Sprint 2: Backend API Integration",
      deadline: "2026-07-06T23:59:00",
      status: "belum",
      created_at: "2026-06-17T11:00:00"
    }
  ];
}

function evaluateTasks(tasks, currentTimeStr, tzOffset = WIB_OFFSET) {
  const nowMs = parseDeadlineTimestamp(currentTimeStr, tzOffset);
  const classified = tasks.map((t) => ({
    ...t,
    deadline_status: getDeadlineStatus(t, nowMs, tzOffset)
  }));
  return sortTasksByUrgency(classified, tzOffset);
}

/**
 * Menjalankan request ke Express app secara in-memory tanpa membuka TCP socket.
 */
function dispatchExpress(app, { method = "GET", url, headers = {} }) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    const res = new http.ServerResponse(req);
    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      return origWrite(chunk, encoding, cb);
    };

    res.end = (chunk, encoding, cb) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const bodyStr = raw.includes("\r\n\r\n") ? raw.split("\r\n\r\n").slice(1).join("\r\n\r\n") : raw;
      try {
        resolve({
          status: res.statusCode,
          body: bodyStr ? JSON.parse(bodyStr) : null
        });
      } catch (err) {
        reject(err);
      }
      return origEnd(chunk, encoding, cb);
    };

    app.handle(req, res, reject);
  });
}

test("Skenario 1 (Positif): tugas mendekati deadline (< 24 jam) berada paling atas", () => {
  const result = evaluateTasks(makeSeedTasks(), "2026-07-02T08:00:00");
  assert.deepEqual(
    result.map((t) => [t.id, t.deadline_status]),
    [
      [2, "approaching"],
      [1, "normal"],
      [3, "normal"]
    ]
  );
});

test("Skenario 2 (Positif): tugas overdue tetap tampil dan diurutkan paling baru terlewati lebih dulu", () => {
  const result = evaluateTasks(makeSeedTasks(), "2026-07-04T00:00:00");
  assert.deepEqual(
    result.map((t) => [t.id, t.deadline_status]),
    [
      [3, "normal"],
      [1, "overdue"],
      [2, "overdue"]
    ]
  );
});

test("Skenario 4 (Edge Case): sisa waktu tepat 24 jam dikategorikan normal", () => {
  const result = evaluateTasks(makeSeedTasks(), "2026-07-02T23:59:00");
  const task1 = result.find((t) => t.id === 1);
  assert.equal(task1.deadline_status, "normal");
});

test("Skenario 5 (Edge Case): sisa waktu tepat 0 jam dikategorikan approaching", () => {
  const result = evaluateTasks(makeSeedTasks(), "2026-07-02T10:00:00");
  const task2 = result.find((t) => t.id === 2);
  assert.equal(task2.deadline_status, "approaching");
});

test("Skenario 6 (Edge Case): tugas berstatus selesai memiliki deadline_status null meski < 24 jam", () => {
  const tasks = makeSeedTasks();
  tasks[1].status = "selesai";
  const result = evaluateTasks(tasks, "2026-07-02T09:00:00");
  const task2 = result.find((t) => t.id === 2);
  assert.equal(task2.deadline_status, null);
  assert.equal(result[result.length - 1].id, 2);
});

test("Kompatibilitas Zona Waktu (WIB, WITA, WIT): deadline lokal dievaluasi sesuai zona waktu user", () => {
  const task = {
    id: 10,
    deadline: "2026-07-02T23:00",
    status: "belum"
  };

  // Momen UTC yang sama: 2026-07-01T15:30:00Z
  const utcInstant = Date.parse("2026-07-01T15:30:00Z");

  // Di WIB (UTC+7): jam 22:30 -> tersisa 24j 30m -> normal
  assert.equal(getDeadlineStatus(task, utcInstant, WIB_OFFSET), "normal");

  // Di WITA (UTC+8): jam 23:30 -> tersisa 23j 30m -> approaching
  assert.equal(getDeadlineStatus(task, utcInstant, WITA_OFFSET), "approaching");

  // Di WIT (UTC+9): jam 00:30 (2 Jul) -> tersisa 22j 30m -> approaching
  assert.equal(getDeadlineStatus(task, utcInstant, WIT_OFFSET), "approaching");

  assert.equal(parseTimezoneOffset("-480"), -480);
  assert.equal(parseTimezoneOffset("invalid"), new Date().getTimezoneOffset());
});

test("Skenario 3 & Integrasi Express GET /api/tasks: validasi 401 dan response terurut", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", taskRoutes);

  // Tanpa token -> 401 Unauthorized
  const unauthRes = await dispatchExpress(app, { url: "/api/tasks" });
  assert.equal(unauthRes.status, 401);

  // Token tidak valid -> 401 Unauthorized
  const invalidTokenRes = await dispatchExpress(app, {
    url: "/api/tasks",
    headers: { Authorization: "Bearer token-palsu" }
  });
  assert.equal(invalidTokenRes.status, 401);

  // Dengan token valid untuk Demo Mahasiswa (user_id: 1) + simulasi waktu WITA
  const token = jwt.sign(
    { sub: 1, nama: "Demo Mahasiswa", email: "demo@studytrack.test" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const okRes = await dispatchExpress(app, {
    url: "/api/tasks?now=2026-07-02T08:00",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Timezone-Offset": String(WITA_OFFSET)
    }
  });
  assert.equal(okRes.status, 200);
  assert.equal(okRes.body.tasks.length >= 3, true);
  assert.equal(okRes.body.tasks[0].id, 2);
  assert.equal(okRes.body.tasks[0].deadline_status, "approaching");
  assert.equal(okRes.body.tasks[0].mata_kuliah, "Data Structures");
});

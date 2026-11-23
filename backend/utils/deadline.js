/**
 * Utilitas klasifikasi urgensi dan pengurutan tugas berdasarkan kedekatan deadline.
 *
 * Mendukung string deadline lokal tanpa zona waktu (mis. output `<input type="datetime-local">`)
 * maupun ISO 8601 dengan zona waktu eksplisit, sehingga konsisten untuk seluruh
 * zona waktu pengguna (WIB/UTC+7, WITA/UTC+8, WIT/UTC+9, dsb.).
 */

export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const URGENCY_PRIORITY = {
  approaching: 1,
  normal: 2,
  overdue: 3
};

/**
 * Membaca offset zona waktu (dalam menit di belakang UTC, sesuai `Date.getTimezoneOffset()`)
 * dari header request, dengan fallback ke zona waktu lokal server.
 *
 * Contoh: WIB (UTC+7) = -420, WITA (UTC+8) = -480, WIT (UTC+9) = -540.
 *
 * @param {string | number | undefined} headerValue
 * @returns {number}
 */
export function parseTimezoneOffset(headerValue) {
  if (headerValue !== undefined && headerValue !== null && headerValue !== "") {
    const parsed = Number(headerValue);
    if (Number.isFinite(parsed) && parsed >= -840 && parsed <= 840) {
      return parsed;
    }
  }
  return new Date().getTimezoneOffset();
}

/**
 * Mengonversi string datetime menjadi epoch milliseconds (UTC).
 * String lokal tanpa zona waktu ditafsirkan menggunakan `tzOffsetMinutes`.
 *
 * @param {string} dateStr
 * @param {number} [tzOffsetMinutes]
 * @returns {number} Epoch ms atau NaN jika tidak valid.
 */
export function parseDeadlineTimestamp(dateStr, tzOffsetMinutes = new Date().getTimezoneOffset()) {
  if (!dateStr || typeof dateStr !== "string") {
    return NaN;
  }

  const trimmed = dateStr.trim();

  // Jika sudah menyertakan zona waktu eksplisit (Z atau ±HH:MM / ±HHMM), parse langsung.
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    return Date.parse(trimmed);
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    const wallUtcMs = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second || 0)
    );
    return wallUtcMs + tzOffsetMinutes * 60 * 1000;
  }

  return Date.parse(trimmed);
}

/**
 * Menentukan kategori urgensi deadline (`approaching`, `normal`, `overdue`, atau `null` jika selesai).
 *
 * @param {{ status: string, deadline: string }} task
 * @param {number | Date} [currentTime]
 * @param {number} [tzOffsetMinutes]
 * @returns {"approaching" | "normal" | "overdue" | null}
 */
export function getDeadlineStatus(
  task,
  currentTime = Date.now(),
  tzOffsetMinutes = new Date().getTimezoneOffset()
) {
  if (task.status === "selesai") {
    return null;
  }

  const deadlineMs = parseDeadlineTimestamp(task.deadline, tzOffsetMinutes);
  const nowMs = currentTime instanceof Date ? currentTime.getTime() : Number(currentTime);

  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) {
    return "normal";
  }

  const remainingMs = deadlineMs - nowMs;

  if (remainingMs < 0) {
    return "overdue";
  }
  if (remainingMs < TWENTY_FOUR_HOURS_MS) {
    return "approaching";
  }
  return "normal";
}

/**
 * Mengurutkan daftar tugas berdasarkan prioritas urgensi:
 * 1. `approaching` -> `normal` -> `overdue` -> selesai (`null`)
 * 2. Di dalam `approaching` dan `normal`: deadline terdekat lebih dulu (ascending)
 * 3. Di dalam `overdue`: deadline yang paling baru terlewati lebih dulu (descending)
 * 4. Tie-breaker: `created_at` terbaru lebih dulu
 *
 * @param {Array<object>} tasks
 * @param {number} [tzOffsetMinutes]
 * @returns {Array<object>}
 */
export function sortTasksByUrgency(tasks, tzOffsetMinutes = new Date().getTimezoneOffset()) {
  return [...tasks].sort((a, b) => {
    const priorityA = URGENCY_PRIORITY[a.deadline_status] ?? 4;
    const priorityB = URGENCY_PRIORITY[b.deadline_status] ?? 4;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (priorityA <= 3) {
      const deadlineA = parseDeadlineTimestamp(a.deadline, tzOffsetMinutes);
      const deadlineB = parseDeadlineTimestamp(b.deadline, tzOffsetMinutes);

      if (Number.isFinite(deadlineA) && Number.isFinite(deadlineB) && deadlineA !== deadlineB) {
        return priorityA === 3 ? deadlineB - deadlineA : deadlineA - deadlineB;
      }
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

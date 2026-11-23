import React from "react";

/**
 * Memformat deadline ke tampilan lokal Indonesia, contoh: "03 Jul 2026, 23.59".
 *
 * @param {string} deadline Tanggal dan jam deadline dari API.
 * @returns {string}
 */
function formatDeadline(deadline) {
  const d = new Date(deadline);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Card satu tugas pada halaman Daftar Tugas.
 *
 * @param {object} props
 * @param {object} props.task Data tugas dari API (termasuk `mata_kuliah` dan `deadline_status`).
 * @param {(task: object) => void} props.onToggleStatus Dipanggil saat tombol status ditekan.
 * @param {(id: number) => void} props.onDelete Dipanggil saat tombol hapus ditekan.
 */
export default function TaskCard({ task, onToggleStatus, onDelete }) {
  const isCompleted = task.status === "selesai";
  const urgencyStatus =
    !isCompleted && (task.deadline_status === "approaching" || task.deadline_status === "overdue")
      ? task.deadline_status
      : "";

  return (
    <div className={`card task-card ${urgencyStatus}`.trim()}>
      <div>
        <strong>{task.judul}</strong>
        <div className="meta">{task.mata_kuliah}</div>
        <div className="meta">Deadline: {formatDeadline(task.deadline)}</div>
        {task.deskripsi && <div className="meta">{task.deskripsi}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="task-badges">
          {urgencyStatus === "approaching" && (
            <span className="badge approaching">Mendekati Deadline</span>
          )}
          {urgencyStatus === "overdue" && <span className="badge overdue">Terlambat</span>}
          <span className={`badge ${task.status}`}>{isCompleted ? "Selesai" : "Belum"}</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => onToggleStatus(task)}>
            {isCompleted ? "Tandai Belum" : "Tandai Selesai"}
          </button>
          <button className="btn" onClick={() => onDelete(task.id)}>
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

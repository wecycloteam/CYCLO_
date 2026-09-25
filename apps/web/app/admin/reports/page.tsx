"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, Report } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";
type ReportWithParties = Report & {
  reporter: { id: string; name: string; username: string | null };
  reportedUser: { id: string; name: string; username: string | null } | null;
};

const STATUS_FILTERS = ["UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "DISMISSED", "ALL"] as const;

const SEVERITY_STYLE: Record<string, string> = {
  LOW: "bg-[#E4F7E2] text-[var(--success)]",
  MEDIUM: "bg-[#FFF3DC] text-[var(--warning)]",
  HIGH: "bg-[#FCE3DE] text-[var(--critical)]",
};

export default function AdminReportsPage() {
  const { state: authState, user } = useCurrentUser();
  const [reports, setReports] = useState<ReportWithParties[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("UNDER_REVIEW");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .adminListReports(filter === "ALL" ? undefined : filter)
      .then((res) => {
        setReports(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load reports.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready" && user?.role === "admin") Promise.resolve().then(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, user, filter]);

  function openReport(r: ReportWithParties) {
    setExpandedId(expandedId === r.id ? null : r.id);
    setNotes(r.investigationNotes ?? "");
    setResolution(r.resolution ?? "");
    setSaveError(null);
  }

  async function handleUpdate(id: string, status?: string) {
    setSaving(true);
    setSaveError(null);
    try {
      await api.adminUpdateReport(id, { status, investigationNotes: notes, resolution });
      load();
      if (status) setExpandedId(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't update this report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Reports" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                  filter === s ? "bg-[var(--cyclo-teal)] text-white" : "border border-[var(--border)] text-[var(--text-on-bg-2)]"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {state === "loading" && <LoadingState label="Loading reports…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

          {state === "ready" && reports.length === 0 && <EmptyState title="No reports here" hint="Nothing matches this filter right now." />}

          {state === "ready" && reports.length > 0 && (
            <div className="flex flex-col gap-2">
              {reports.map((r) => (
                <div key={r.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <button onClick={() => openReport(r)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--cyclo-teal)]">{r.reportNumber}</div>
                      <div className="text-sm font-extrabold text-[var(--text-1)]">{r.category.replace(/_/g, " ")}</div>
                      <div className="mt-0.5 truncate text-xs text-[var(--text-2)]">{r.description}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-3)]">
                        By {r.reporter.name}
                        {r.reportedUser && ` · Against ${r.reportedUser.name}`}
                        {r.reportedUsername && !r.reportedUser && ` · Against @${r.reportedUsername}`}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-[var(--r-pill)] px-2.5 py-1 text-[10px] font-bold ${SEVERITY_STYLE[r.severity]}`}>
                      {r.severity}
                    </span>
                  </button>

                  {expandedId === r.id && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                      <p className="text-xs text-[var(--text-2)]">
                        <span className="font-bold text-[var(--text-1)]">Status:</span> {r.status.replace(/_/g, " ")}
                      </p>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-[var(--text-2)]">Investigation notes</span>
                        <textarea
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-[var(--text-2)]">Resolution</span>
                        <textarea
                          rows={2}
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="w-full rounded-[var(--r-sm)] border border-[var(--border)] px-3 py-2 text-xs"
                        />
                      </label>
                      {saveError && <p className="text-xs font-bold text-[var(--critical)]">{saveError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleUpdate(r.id)}
                          disabled={saving}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-bold text-[var(--text-1)] disabled:opacity-60"
                        >
                          Save notes
                        </button>
                        <button
                          onClick={() => handleUpdate(r.id, "INVESTIGATING")}
                          disabled={saving}
                          className="rounded-full bg-[var(--warning)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Mark Investigating
                        </button>
                        <button
                          onClick={() => handleUpdate(r.id, "RESOLVED")}
                          disabled={saving}
                          className="rounded-full bg-[var(--success)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleUpdate(r.id, "DISMISSED")}
                          disabled={saving}
                          className="rounded-full bg-[var(--critical)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </AdminGate>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}

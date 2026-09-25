"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, AdminDashboard, AuditLogEntry, Report } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="text-lg font-extrabold">{value}</div>
      <div className="text-[11px] text-[var(--text-2)]">{label}</div>
    </div>
  );
}

function CountBreakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return (
    <div className="mb-5">
      <h3 className="text-xs font-extrabold text-[var(--text-on-bg-2)] uppercase tracking-wide mb-2">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, value]) => (
          <span
            key={key}
            className="rounded-[var(--r-pill)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-bold text-[var(--text-1)]"
          >
            {key.replace(/_/g, " ")}: {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { state: authState, user } = useCurrentUser();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [pendingReports, setPendingReports] = useState<Report[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setState("loading");
    Promise.all([api.adminDashboard(), api.adminActivity(), api.adminListReports("UNDER_REVIEW")])
      .then(([d, a, r]) => {
        setDashboard(d);
        setActivity(a);
        setPendingReports(r);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load the dashboard.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready" && user?.role === "admin") Promise.resolve().then(load);
  }, [authState, user]);

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Admin Dashboard" />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          {state === "loading" && <LoadingState label="Loading dashboard…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

          {state === "ready" && dashboard && (
            <>
              <div className="rounded-[var(--r-lg)] bg-[var(--cyclo-teal)] p-5 mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--cyclo-mint)]">
                  Total platform revenue
                </div>
                <div className="text-2xl font-extrabold text-white">
                  TZS {Math.round(dashboard.totalPlatformRevenueTzs).toLocaleString()}
                </div>
                <div className="mt-1 text-[10px] text-[var(--cyclo-mint)]">
                  Real platform fees collected across all transactions — TZS 0 until a fee schedule is set.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <StatTile label="Total Users" value={dashboard.totalUsers} />
                <StatTile label="Pending Listing Reviews" value={dashboard.pendingListingModerationCount} />
              </div>

              {dashboard.pendingListingModerationCount > 0 && (
                <Link
                  href="/admin/listings"
                  className="block rounded-[var(--r-md)] bg-[var(--cyclo-teal)] text-white font-bold text-sm text-center py-3 mb-3"
                >
                  Review {dashboard.pendingListingModerationCount} pending listing
                  {dashboard.pendingListingModerationCount === 1 ? "" : "s"} →
                </Link>
              )}

              {pendingReports.length > 0 && (
                <Link
                  href="/admin/reports"
                  className="block rounded-[var(--r-md)] bg-[var(--critical)] text-white font-bold text-sm text-center py-3 mb-6"
                >
                  {pendingReports.length} suspicious activity report{pendingReports.length === 1 ? "" : "s"} awaiting review →
                </Link>
              )}

              <CountBreakdown title="Users by role" counts={dashboard.usersByRole} />
              <CountBreakdown title="Collectors by verification" counts={dashboard.collectorsByVerificationStatus} />
              <CountBreakdown title="Organizations by verification" counts={dashboard.organizationsByVerificationStatus} />
              <CountBreakdown title="Listings by status" counts={dashboard.listingsByStatus} />
              <CountBreakdown title="Pickups by status" counts={dashboard.pickupsByStatus} />

              <h3 className="text-xs font-extrabold text-[var(--text-on-bg-2)] uppercase tracking-wide mb-2">Recent activity</h3>
              {activity.length === 0 && <p className="text-xs text-[var(--text-on-bg-2)]">No admin actions yet.</p>}
              <div className="flex flex-col gap-2">
                {activity.map((a) => (
                  <div key={a.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="text-xs font-bold">{a.action.replace(/_/g, " ")}</div>
                    <div className="text-[11px] text-[var(--text-2)]">
                      {a.actorName ?? "System"} · {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </AdminGate>
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}

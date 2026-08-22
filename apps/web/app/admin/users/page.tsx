"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, PendingAccount, PendingCollector, PendingOrganization } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { AdminGate } from "@/components/AdminGate";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

export default function AdminUsersPage() {
  const { state: authState, user } = useCurrentUser();
  const [accounts, setAccounts] = useState<PendingAccount[]>([]);
  const [collectors, setCollectors] = useState<PendingCollector[]>([]);
  const [organizations, setOrganizations] = useState<PendingOrganization[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .adminPendingUsers()
      .then((res) => {
        setAccounts(res.pendingAccounts);
        setCollectors(res.pendingCollectors);
        setOrganizations(res.pendingOrganizations);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load pending accounts.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready" && user?.role === "admin") Promise.resolve().then(load);
  }, [authState, user]);

  async function handleAccount(userId: string, action: "verify" | "reject" | "suspend") {
    setActingId(userId);
    setActionError(null);
    try {
      if (action === "verify") await api.adminVerifyUser(userId);
      else if (action === "reject") await api.adminRejectUser(userId);
      else await api.adminSuspendUser(userId);
      setAccounts((prev) => prev.filter((a) => a.id !== userId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That action didn't go through.");
    } finally {
      setActingId(null);
    }
  }

  async function handleCollector(userId: string, action: "verify" | "reject" | "suspend") {
    setActingId(userId);
    setActionError(null);
    try {
      if (action === "verify") await api.adminVerifyCollector(userId);
      else if (action === "reject") await api.adminRejectCollector(userId);
      else await api.adminSuspendCollector(userId);
      setCollectors((prev) => prev.filter((c) => c.userId !== userId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That action didn't go through.");
    } finally {
      setActingId(null);
    }
  }

  async function handleOrganization(orgId: string, action: "verify" | "reject" | "suspend") {
    setActingId(orgId);
    setActionError(null);
    try {
      if (action === "verify") await api.adminVerifyOrganization(orgId);
      else if (action === "reject") await api.adminRejectOrganization(orgId);
      else await api.adminSuspendOrganization(orgId);
      setOrganizations((prev) => prev.filter((o) => o.id !== orgId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That action didn't go through.");
    } finally {
      setActingId(null);
    }
  }

  const nothingPending = accounts.length === 0 && collectors.length === 0 && organizations.length === 0;

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Pending Verifications" />
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-6">
        <AdminGate authState={authState} user={user}>
          {state === "loading" && <LoadingState label="Loading pending accounts…" />}
          {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}
          {actionError && <p className="text-xs text-[var(--critical)] mb-3">{actionError}</p>}

          {state === "ready" && nothingPending && (
            <EmptyState title="Nothing pending" hint="New household, business, and collector accounts will show up here for verification." />
          )}

          {state === "ready" && accounts.length > 0 && (
            <>
              <h3 className="text-xs font-extrabold text-[var(--text-2)] uppercase tracking-wide mb-2">Households &amp; other accounts</h3>
              <div className="flex flex-col gap-2 mb-6">
                {accounts.map((a) => (
                  <div key={a.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-sm font-extrabold">{a.name}</div>
                    <div className="text-xs text-[var(--text-2)] mb-3">
                      {a.phone} · {a.role} · joined {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccount(a.id, "verify")}
                        disabled={actingId === a.id}
                        className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleAccount(a.id, "reject")}
                        disabled={actingId === a.id}
                        className="flex-1 rounded-full border border-[var(--critical)] text-[var(--critical)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAccount(a.id, "suspend")}
                        disabled={actingId === a.id}
                        className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {state === "ready" && collectors.length > 0 && (
            <>
              <h3 className="text-xs font-extrabold text-[var(--text-2)] uppercase tracking-wide mb-2">Collectors</h3>
              <div className="flex flex-col gap-2 mb-6">
                {collectors.map((c) => (
                  <div key={c.userId} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-sm font-extrabold">{c.user.name}</div>
                    <div className="text-xs text-[var(--text-2)] mb-3">
                      {c.user.phone} · joined {new Date(c.user.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCollector(c.userId, "verify")}
                        disabled={actingId === c.userId}
                        className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleCollector(c.userId, "reject")}
                        disabled={actingId === c.userId}
                        className="flex-1 rounded-full border border-[var(--critical)] text-[var(--critical)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleCollector(c.userId, "suspend")}
                        disabled={actingId === c.userId}
                        className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {state === "ready" && organizations.length > 0 && (
            <>
              <h3 className="text-xs font-extrabold text-[var(--text-2)] uppercase tracking-wide mb-2">Businesses &amp; recyclers</h3>
              <div className="flex flex-col gap-2">
                {organizations.map((o) => (
                  <div key={o.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-sm font-extrabold">{o.name}</div>
                    <div className="text-xs text-[var(--text-2)] mb-3">
                      {o.type} · owner {o.owner.name} ({o.owner.phone})
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOrganization(o.id, "verify")}
                        disabled={actingId === o.id}
                        className="flex-1 rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleOrganization(o.id, "reject")}
                        disabled={actingId === o.id}
                        className="flex-1 rounded-full border border-[var(--critical)] text-[var(--critical)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleOrganization(o.id, "suspend")}
                        disabled={actingId === o.id}
                        className="flex-1 rounded-full border border-[var(--border)] text-[var(--text-2)] font-bold text-xs py-2.5 disabled:opacity-60"
                      >
                        Suspend
                      </button>
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

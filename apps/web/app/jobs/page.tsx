"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Scale, User, Clock } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { api, ApiError, PickupRequest } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { LoadingState, ErrorState, EmptyState } from "@/components/AsyncState";

type LoadState = "loading" | "ready" | "error";

export default function OpenJobsPage() {
  const router = useRouter();
  const { state: authState, user } = useCurrentUser();
  const [jobs, setJobs] = useState<PickupRequest[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  function load() {
    setState("loading");
    api
      .openPickupJobs()
      .then((res) => {
        setJobs(res);
        setState("ready");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "We couldn't load open jobs.");
        setState("error");
      });
  }

  useEffect(() => {
    if (authState === "ready") Promise.resolve().then(load);
  }, [authState]);

  async function handleAccept(id: string) {
    setAcceptingId(id);
    setAcceptError(null);
    try {
      await api.acceptPickup(id);
      router.push(`/activity/${id}`);
    } catch (err) {
      setAcceptError(err instanceof ApiError ? err.message : "That job was already taken.");
      load();
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg)]">
      <AppHeader title="Open Jobs" back />
      <div className="flex-1 max-w-md md:max-w-xl lg:max-w-3xl w-full mx-auto px-6 py-6">
        {state === "loading" && <LoadingState label="Loading open jobs…" />}
        {state === "error" && <ErrorState message={error ?? "Something went wrong."} onRetry={load} />}

        {acceptError && <p className="text-xs text-[var(--critical)] mb-3">{acceptError}</p>}

        {state === "ready" && jobs.length === 0 && (
          <EmptyState title="No open jobs right now" hint="Check back soon — new pickup requests appear here as households and businesses list material." />
        )}

        {state === "ready" && jobs.length > 0 && (
          <div className="flex flex-col gap-2">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <span className="text-sm font-extrabold">{job.material.label}</span>
                  {job.estimatedValue != null && (
                    <span className="text-sm font-extrabold text-[var(--cyclo-teal)] whitespace-nowrap">
                      ~TZS {Math.round(job.estimatedValue).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-xs text-[var(--text-2)] mb-1">
                  <MapPin size={12} /> {job.location.region ?? job.location.label} · <Scale size={12} /> {job.estimatedWeightKg} kg
                  {job.producer && (
                    <>
                      · <User size={12} /> {job.producer.name}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--text-2)] mb-3">
                  {job.preferredTime ? (
                    <>
                      <Clock size={12} />{" "}
                      {new Date(job.preferredTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </>
                  ) : (
                    "No preferred time set"
                  )}
                </div>
                <button
                  onClick={() => handleAccept(job.id)}
                  disabled={acceptingId === job.id}
                  className="w-full rounded-full bg-[var(--cyclo-teal)] text-white font-bold text-sm py-2.5 disabled:opacity-60"
                >
                  {acceptingId === job.id ? "Accepting…" : "Accept"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {user && <BottomNav role={user.role} />}
    </main>
  );
}

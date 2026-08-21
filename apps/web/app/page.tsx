"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(tokenStore.getAccess() ? "/home" : "/login");
  }, [router]);

  return null;
}

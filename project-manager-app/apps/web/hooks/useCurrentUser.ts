"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUser, type UserView } from "@/app/semse-api";

let cachedUser: UserView | null = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function useCurrentUser() {
  const [user, setUser] = useState<UserView | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    const now = Date.now();
    if (cachedUser && now - cachedAt < CACHE_TTL) {
      setUser(cachedUser);
      setLoading(false);
      return;
    }
    fetchCurrentUser()
      .then((u) => {
        cachedUser = u;
        cachedAt = Date.now();
        setUser(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

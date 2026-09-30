"use client"

import useSWR from "swr"
import { getPendingStarters } from "@/app/actions/starters"

export const PENDING_STARTERS_KEY = "pending-starters"

export function usePendingStarters(enabled = true) {
  const { data } = useSWR(enabled ? PENDING_STARTERS_KEY : null, () => getPendingStarters(), {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  })
  return data ?? []
}

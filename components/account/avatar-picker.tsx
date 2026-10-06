"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Dices, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { setMyAvatar } from "@/app/actions/avatar"
import {
  AVATAR_CATEGORIES,
  SELECTABLE_AVATARS,
  resolveAvatar,
  type AvatarCategory,
} from "@/lib/avatars"
import { cn } from "@/lib/utils"

type Filter = "all" | "featured" | AvatarCategory

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "featured", label: "Featured" },
  ...AVATAR_CATEGORIES,
]

/**
 * Pick a profile picture from the MyCodePad collection.
 *
 * There is deliberately no upload, camera or URL field: the grid is the whole
 * input surface, and what it submits is a catalogue id that the server checks
 * again before writing. Choosing is kept separate from saving so that browsing
 * never changes the user's picture until they commit.
 */
export function AvatarPicker({
  open,
  onOpenChange,
  userId,
  name,
  currentAvatarId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  name: string
  currentAvatarId: string | null | undefined
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [saving, setSaving] = useState(false)

  // What the user is currently looking at, which starts as the avatar they are
  // already wearing so the dialog opens on their own face rather than nothing.
  const current = resolveAvatar(userId, currentAvatarId)
  const [chosenId, setChosenId] = useState(current.id)

  // Reopening after a cancel should not remember the abandoned choice.
  useEffect(() => {
    if (open) {
      setChosenId(current.id)
      setFilter("all")
    }
  }, [open, current.id])

  const visible = useMemo(() => {
    if (filter === "all") return SELECTABLE_AVATARS
    if (filter === "featured") return SELECTABLE_AVATARS.filter((a) => a.featured)
    return SELECTABLE_AVATARS.filter((a) => a.category === filter)
  }, [filter])

  const chosen = resolveAvatar(userId, chosenId)
  const dirty = chosenId !== current.id

  function surpriseMe() {
    // Picks from the whole collection, not the filtered view, and never
    // re-offers the avatar already on screen.
    const pool = SELECTABLE_AVATARS.filter((a) => a.id !== chosenId)
    const pick = pool[Math.floor(Math.random() * pool.length)]
    setChosenId(pick.id)
    setFilter("all")
  }

  async function handleSave() {
    if (!dirty) {
      onOpenChange(false)
      return
    }

    setSaving(true)
    try {
      const result = await setMyAvatar(chosenId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(`${chosen.name} is now your avatar.`)
      onOpenChange(false)
      // Refreshes the server-rendered surfaces — header, rosters, profile.
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Choose your MyCodePad avatar</DialogTitle>
          <DialogDescription>Pick an avatar that represents you.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5 overflow-x-auto px-6 pt-4 pb-1">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                filter === option.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-7">
            {visible.map((avatar) => {
              const selected = avatar.id === chosenId
              return (
                <li key={avatar.id}>
                  <button
                    type="button"
                    onClick={() => setChosenId(avatar.id)}
                    title={avatar.name}
                    aria-label={`Select ${avatar.name} avatar`}
                    aria-pressed={selected}
                    className={cn(
                      "relative block w-full rounded-full transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none motion-safe:hover:scale-105",
                      selected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:shadow-md",
                    )}
                  >
                    <img
                      src={avatar.src}
                      alt=""
                      width={96}
                      height={96}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full rounded-full bg-muted object-cover"
                    />
                    {selected && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
                        aria-hidden="true"
                      >
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Stacks on phones: the four items do not fit one row at 390px. */}
        <DialogFooter className="flex-col items-stretch gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:mr-auto">
            <img
              src={chosen.src}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full bg-muted object-cover"
            />
            <span className="min-w-0 leading-tight">
              <span className="block text-xs text-muted-foreground">Selected</span>
              <span className="block truncate text-sm font-medium">{chosen.name}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={surpriseMe}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              <Dices data-icon="inline-start" />
              Surprise me
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex-1 sm:flex-none"
            >
              {saving && <Loader2 className="animate-spin" data-icon="inline-start" />}
              Save avatar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState } from "react"
import useSWR from "swr"
import { StudentWorkspace } from "@/components/student-workspace"
import { IdeSwitcher } from "@/components/ide/ide-switcher"
import { SubscriptionModal } from "@/components/subscription-modal"
import { UpgradeButton } from "@/components/upgrade-button"
import { cn } from "@/lib/utils"
import { getUserSubscriptionInfo } from "@/app/actions/onboarding"
import { setLastIde } from "@/app/actions/preferences"
import { subscriptionInfoKey } from "@/lib/swr-keys"
import { DEFAULT_LANGUAGE, getLanguage, type LanguageId } from "@/lib/ide/languages"

type ClassItem = {
  id: number
  name: string
  description: string | null
  joinCode: string
  teacherId: string
}

export function StudentWorkspaceWithFreemium({
  initialClasses,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  initialClasses: ClassItem[]
  initialLanguage?: LanguageId
}) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [limitType, setLimitType] = useState<"file" | "folder">("file")
  const [language, setLanguage] = useState<LanguageId>(initialLanguage)

  // Keyed by IDE, because the free tier is metered per IDE. The workspace
  // revalidates this exact key after every create or delete, so the usage
  // shown here can never drift from what the server will allow.
  const { data: subscriptionInfo, isLoading } = useSWR(
    subscriptionInfoKey(language),
    () => getUserSubscriptionInfo(language),
    { revalidateOnFocus: true, keepPreviousData: true },
  )

  function handleLanguageChange(next: LanguageId) {
    setLanguage(next)
    // Remembering the choice is a convenience, not a correctness requirement,
    // so a failed write must not interrupt the switch.
    void setLastIde(next).catch(() => {})
  }

  if (isLoading && !subscriptionInfo) {
    return <div className="flex flex-1 items-center justify-center">Loading...</div>
  }

  // The entitlement resolved on the server is the only thing consulted here.
  // A school-covered student is Pro, so no upgrade UI can ever render for them.
  const isPro = subscriptionInfo?.isPro ?? false
  const maxFiles = subscriptionInfo?.maxFiles ?? null
  const maxFolders = subscriptionInfo?.maxFolders ?? null
  const usedFiles = subscriptionInfo?.createdFilesCount ?? 0
  const usedFolders = subscriptionInfo?.createdFoldersCount ?? 0

  const showFreeTierBar = !isPro && maxFiles !== null && maxFolders !== null

  const atFolderLimit = maxFolders !== null && usedFolders >= maxFolders
  const atFileLimit = maxFiles !== null && usedFiles >= maxFiles

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* The workspace's top-level navigation. The IDE tabs and the
            allowance share one bar because the allowance is metered per IDE —
            putting them side by side is what makes that obvious. */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-2 sm:px-4">
          <IdeSwitcher variant="bar" value={language} onChange={handleLanguageChange} />
          {showFreeTierBar && (
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden text-xs text-muted-foreground md:inline">
                {/* Named explicitly: each IDE has its own allowance, so an
                    unlabelled count would look like the number was wrong. */}
                Free tier &middot; {getLanguage(language).label}:{" "}
                <span className={cn(atFolderLimit && "font-semibold text-chart-4")}>
                  {usedFolders}/{maxFolders}
                </span>{" "}
                folders,{" "}
                <span className={cn(atFileLimit && "font-semibold text-chart-4")}>
                  {usedFiles}/{maxFiles}
                </span>{" "}
                files
              </span>
              <UpgradeButton onClick={() => setShowUpgradeModal(true)} compact={true} />
            </div>
          )}
        </div>
        <StudentWorkspace
          initialClasses={initialClasses}
          language={language}
          onLimitReached={(type) => {
            setLimitType(type)
            setShowUpgradeModal(true)
          }}
          isFreeUser={!isPro}
          canCreateFile={maxFiles === null || usedFiles < maxFiles}
          canCreateFolder={maxFolders === null || usedFolders < maxFolders}
        />
      </div>

      <SubscriptionModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitType={limitType}
      />
    </>
  )
}

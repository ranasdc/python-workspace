"use client"

import { useState } from "react"
import useSWR from "swr"
import { StudentWorkspace } from "@/components/student-workspace"
import { SubscriptionModal } from "@/components/subscription-modal"
import { UpgradeButton } from "@/components/upgrade-button"
import { getUserSubscriptionInfo } from "@/app/actions/onboarding"
import { SUBSCRIPTION_INFO_KEY } from "@/lib/swr-keys"

type ClassItem = {
  id: number
  name: string
  description: string | null
  joinCode: string
  teacherId: string
}

export function StudentWorkspaceWithFreemium({ initialClasses }: { initialClasses: ClassItem[] }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [limitType, setLimitType] = useState<"file" | "folder">("file")

  // Shared SWR key: the workspace revalidates it after every create or delete,
  // so the usage shown here can never drift from what the server will allow.
  const { data: subscriptionInfo, isLoading } = useSWR(
    SUBSCRIPTION_INFO_KEY,
    getUserSubscriptionInfo,
    { revalidateOnFocus: true },
  )

  if (isLoading) {
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

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {showFreeTierBar && (
          <div className="border-b border-border bg-card px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Free tier: {usedFolders}/{maxFolders} folders, {usedFiles}/{maxFiles} files
            </span>
            <UpgradeButton onClick={() => setShowUpgradeModal(true)} compact={true} />
          </div>
        )}
        <StudentWorkspace
          initialClasses={initialClasses}
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

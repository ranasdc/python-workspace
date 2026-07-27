"use client"

import { useEffect, useState } from "react"
import { StudentWorkspace } from "@/components/student-workspace"
import { SubscriptionModal } from "@/components/subscription-modal"
import { UpgradeButton } from "@/components/upgrade-button"
import { getUserSubscriptionInfo, canCreateFile, canCreateFolder } from "@/app/actions/onboarding"

type ClassItem = {
  id: number
  name: string
  description: string | null
  joinCode: string
  teacherId: string
}

export function StudentWorkspaceWithFreemium({ initialClasses }: { initialClasses: ClassItem[] }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    accountType: string | null | undefined
    subscriptionStatus: string | null | undefined
    createdFilesCount: number
    createdFoldersCount: number
  } | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [limitType, setLimitType] = useState<"file" | "folder">("file")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSubscriptionInfo = async () => {
      try {
        const info = await getUserSubscriptionInfo()
        setSubscriptionInfo(info)
      } catch (error) {
        console.error("Failed to load subscription info:", error)
        // Fallback for when database schema isn't migrated yet
        setSubscriptionInfo({
          accountType: null,
          subscriptionStatus: null,
          createdFilesCount: 0,
          createdFoldersCount: 0,
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadSubscriptionInfo()
  }, [])

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center">Loading...</div>
  }

  // Check if user is on free tier (individual account without subscription)
  const isFreeUser =
    subscriptionInfo?.accountType === "individual" &&
    subscriptionInfo?.subscriptionStatus === "free"

  // For individual users with no classes, treat as free tier
  const shouldShowFreeTier = isFreeUser || (initialClasses.length === 0 && subscriptionInfo?.accountType === "individual")

  const handleUpgradeClick = () => {
    setShowUpgradeModal(true)
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {shouldShowFreeTier && (
          <div className="border-b border-border bg-card px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Free tier: {subscriptionInfo?.createdFoldersCount || 0}/1 folders, {subscriptionInfo?.createdFilesCount || 0}/2 files
            </span>
            <UpgradeButton onClick={handleUpgradeClick} compact={true} />
          </div>
        )}
        <StudentWorkspace 
          initialClasses={initialClasses}
          onLimitReached={(type) => {
            setLimitType(type)
            setShowUpgradeModal(true)
          }}
          isFreeUser={shouldShowFreeTier}
          canCreateFile={shouldShowFreeTier ? (subscriptionInfo?.createdFilesCount || 0) < 2 : true}
          canCreateFolder={shouldShowFreeTier ? (subscriptionInfo?.createdFoldersCount || 0) < 1 : true}
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

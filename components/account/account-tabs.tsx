"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AccountProfile } from "@/lib/account"
import { ProfilePanel } from "@/components/account/profile-panel"
import { SecurityPanel } from "@/components/account/security-panel"
import { SubscriptionPanel } from "@/components/account/subscription-panel"
import { MembershipPanel } from "@/components/account/membership-panel"

export type AccountTab = "profile" | "security" | "subscription" | "membership"

/**
 * The account area's four views.
 *
 * The chosen tab is mirrored into the URL so the profile menu can deep-link
 * straight to Security or Membership, and so a reloaded page stays where the
 * user was. It is replaced rather than pushed, which keeps the browser Back
 * button pointing at the workspace the user came from instead of walking them
 * back through each tab they happened to look at.
 */
export function AccountTabs({
  profile,
  initialTab,
}: {
  profile: AccountProfile
  initialTab: AccountTab
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<AccountTab>(initialTab)

  function handleChange(next: string) {
    setTab(next as AccountTab)
    router.replace(next === "profile" ? pathname : `${pathname}?tab=${next}`, {
      scroll: false,
    })
  }

  return (
    <Tabs
      value={tab}
      onValueChange={handleChange}
      className="mt-8 gap-6"
    >
      <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
        <TabsTrigger value="membership">Membership</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfilePanel profile={profile} />
      </TabsContent>
      <TabsContent value="security">
        <SecurityPanel hasPassword={profile.hasPassword} email={profile.user.email} />
      </TabsContent>
      <TabsContent value="subscription">
        <SubscriptionPanel profile={profile} />
      </TabsContent>
      <TabsContent value="membership">
        <MembershipPanel profile={profile} />
      </TabsContent>
    </Tabs>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setAccountType } from "@/app/actions/onboarding"

const ONBOARDING_DISMISSED_KEY = "student_onboarding_dismissed"

export function StudentOnboarding() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<"choice" | "join-class">("choice")
  const [classCode, setClassCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check if onboarding was already dismissed in this session
    const isDismissed = sessionStorage.getItem(ONBOARDING_DISMISSED_KEY)
    if (!isDismissed) {
      setIsOpen(true)
    }
  }, [])

  const handleIndividualUser = async () => {
    setIsLoading(true)
    try {
      // Mark onboarding as dismissed before closing
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "true")
      await setAccountType("individual")
      setIsOpen(false)
      // Refresh page to reload with new account type
      window.location.reload()
    } catch (error) {
      console.error("Failed to set account type:", error)
      // Still close the modal and proceed even if DB update fails
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "true")
      setIsOpen(false)
      window.location.reload()
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classCode.trim()) return

    setIsLoading(true)
    try {
      // Mark onboarding as dismissed before closing
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "true")
      // Call join class action (to be created in next step)
      // For now, we'll just set account type to "class"
      await setAccountType("class")
      setIsOpen(false)
      window.location.reload()
    } catch (error) {
      console.error("Failed to join class:", error)
      // Still close the modal and proceed even if DB update fails
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "true")
      setIsOpen(false)
      window.location.reload()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        {step === "choice" ? (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to MyCodePad!</DialogTitle>
              <DialogDescription>
                Choose how you&apos;d like to start your coding journey
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <Button
                onClick={() => setStep("join-class")}
                variant="outline"
                className="h-auto w-full flex-col items-start gap-2 p-4"
              >
                <span className="text-base font-semibold">Join a Class</span>
                <span className="text-xs text-muted-foreground">
                  Learn with your teacher and classmates (all features included)
                </span>
              </Button>
              <Button
                onClick={handleIndividualUser}
                variant="default"
                className="h-auto w-full flex-col items-start gap-2 p-4"
                disabled={isLoading}
              >
                <span className="text-base font-semibold">Individual User</span>
                <span className="text-xs">
                  Start coding now with limits (1 folder, 2 files). Upgrade anytime.
                </span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join Your Class</DialogTitle>
              <DialogDescription>
                Enter the class code your teacher provided
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleJoinClass} className="space-y-4 py-6">
              <Input
                placeholder="Enter class code"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                maxLength={10}
                autoFocus
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("choice")}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!classCode.trim() || isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Joining..." : "Join"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

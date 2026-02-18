"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FileText, Mail, KeyRound, Loader2 } from "lucide-react"

export default function PortalLoginPage() {
  return (
    <Suspense>
      <PortalLoginContent />
    </Suspense>
  )
}

function PortalLoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const companyId = searchParams.get("company_id") || ""

  const [email, setEmail] = useState("")
  const [token, setToken] = useState("")
  const [step, setStep] = useState<"email" | "token">("email")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const handleSendCode = async () => {
    if (!email) {
      setError("Zadajte emailovú adresu")
      return
    }

    setLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company_id: companyId }),
      })

      const data = await res.json()

      if (res.ok) {
        setStep("token")
        setMessage("Prístupový kód bol odoslaný na váš email.")
      } else {
        setError(data.error || "Nepodarilo sa odoslať kód")
      }
    } catch {
      setError("Chyba pripojenia k serveru")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyToken = async () => {
    if (!token || token.length < 6) {
      setError("Zadajte 6-miestny prístupový kód")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/portal/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      })

      const data = await res.json()

      if (res.ok && data.session_token) {
        // Uložiť session token a údaje do localStorage
        localStorage.setItem("portal_token", data.session_token)
        localStorage.setItem("portal_contact", JSON.stringify(data.contact))
        localStorage.setItem("portal_company", JSON.stringify(data.company))

        router.push("/portal/dashboard")
      } else {
        setError(data.error || "Neplatný prístupový kód")
      }
    } catch {
      setError("Chyba pripojenia k serveru")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Hlavička */}
      <header className="border-b bg-background px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">Klientsky portál</h1>
        </div>
      </header>

      {/* Obsah */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Prihlásenie</CardTitle>
            <CardDescription>
              Prihláste sa pre zobrazenie vašich faktúr a platieb
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Krok 1: Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Emailová adresa</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vas@email.sk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={step === "token" || loading}
                  className="pl-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && step === "email") handleSendCode()
                  }}
                />
              </div>
            </div>

            {step === "email" && (
              <Button
                className="w-full"
                onClick={handleSendCode}
                disabled={loading || !email}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Odoslať prístupový kód
              </Button>
            )}

            {/* Krok 2: Token */}
            {step === "token" && (
              <>
                {message && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3">
                    <p className="text-sm text-green-700">{message}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="token">Prístupový kód</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="token"
                      type="text"
                      placeholder="000000"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      disabled={loading}
                      className="pl-10 text-center text-lg tracking-widest"
                      maxLength={6}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleVerifyToken()
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zadajte 6-miestny kód, ktorý sme odoslali na váš email
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={handleVerifyToken}
                    disabled={loading || token.length < 6}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4 mr-2" />
                    )}
                    Prihlásiť sa
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setStep("email")
                      setToken("")
                      setMessage("")
                      setError("")
                    }}
                    disabled={loading}
                  >
                    Odoslať kód znova
                  </Button>
                </div>
              </>
            )}

            {/* Chyba */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Pätička */}
      <footer className="border-t bg-background px-6 py-3">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Klientsky portál - Bezpečný prístup k vašim faktúram
          </p>
        </div>
      </footer>
    </div>
  )
}

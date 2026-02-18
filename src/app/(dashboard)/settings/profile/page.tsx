"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"

export default function ProfilePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [name, setName] = useState("")
  const [savingName, setSavingName] = useState(false)

  const [passwords, setPasswords] = useState({
    current: "",
    new_password: "",
    confirm: "",
  })
  const [savingPassword, setSavingPassword] = useState(false)

  const [notifications, setNotifications] = useState({
    email: true,
    inApp: true,
  })

  const [language, setLanguage] = useState("sk")
  const [theme, setTheme] = useState("system")

  useEffect(() => {
    if (user) {
      const metadata = user.user_metadata || {}
      setName(metadata.full_name || metadata.name || "")
    }
  }, [user])

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name },
      })
      if (error) {
        toast({ title: "Chyba pri ukladani", description: error.message, variant: "destructive" })
      } else {
        toast({ title: "Meno bolo ulozene" })
      }
    } catch {
      toast({ title: "Chyba pri ukladani", variant: "destructive" })
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwords.new_password !== passwords.confirm) {
      toast({ title: "Hesla sa nezhoduju", variant: "destructive" })
      return
    }

    if (passwords.new_password.length < 8) {
      toast({
        title: "Heslo musi mat aspon 8 znakov",
        variant: "destructive",
      })
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new_password,
      })
      if (error) {
        toast({ title: "Chyba pri zmene hesla", description: error.message, variant: "destructive" })
      } else {
        toast({ title: "Heslo bolo zmenene" })
        setPasswords({ current: "", new_password: "", confirm: "" })
      }
    } catch {
      toast({ title: "Chyba pri zmene hesla", variant: "destructive" })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    if (typeof window !== "undefined") {
      const root = document.documentElement
      root.classList.remove("light", "dark")
      if (newTheme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        root.classList.add(prefersDark ? "dark" : "light")
      } else {
        root.classList.add(newTheme)
      }
    }
    toast({ title: "Tema bola zmenena" })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil</h1>
        <p className="text-muted-foreground">
          Osobne nastavenia a preferencie
        </p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>Osobne udaje</CardTitle>
          <CardDescription>Zakladne informacie o vascom ucte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Meno</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vase meno"
            />
          </div>
          <Button onClick={handleSaveName} disabled={savingName}>
            {savingName ? "Ukladam..." : "Ulozit meno"}
          </Button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>Zmena hesla</CardTitle>
          <CardDescription>Aktualizujte svoje prihlasovacieho heslo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Sucasne heslo</Label>
            <Input
              id="current-password"
              type="password"
              value={passwords.current}
              onChange={(e) =>
                setPasswords((prev) => ({ ...prev, current: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nove heslo</Label>
            <Input
              id="new-password"
              type="password"
              value={passwords.new_password}
              onChange={(e) =>
                setPasswords((prev) => ({
                  ...prev,
                  new_password: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Potvrdenie hesla</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwords.confirm}
              onChange={(e) =>
                setPasswords((prev) => ({ ...prev, confirm: e.target.value }))
              }
            />
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? "Menim heslo..." : "Zmenit heslo"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notifikacie</CardTitle>
          <CardDescription>Nastavte si sposob prijmania notifikacii</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="notif-email"
              checked={notifications.email}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  email: checked === true,
                }))
              }
            />
            <Label htmlFor="notif-email">Emailove notifikacie</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="notif-inapp"
              checked={notifications.inApp}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  inApp: checked === true,
                }))
              }
            />
            <Label htmlFor="notif-inapp">Notifikacie v aplikacii</Label>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle>Jazyk</CardTitle>
          <CardDescription>Preferovany jazyk rozhrania</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sk">Slovencina</SelectItem>
              <SelectItem value="cs" disabled>
                Cestina (pripravujeme)
              </SelectItem>
              <SelectItem value="en" disabled>
                English (pripravujeme)
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Tema</CardTitle>
          <CardDescription>Vyberte si vizualnu temu aplikacie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {[
              { value: "light", label: "Svetla" },
              { value: "dark", label: "Tmava" },
              { value: "system", label: "Systemova" },
            ].map((t) => (
              <Button
                key={t.value}
                variant={theme === t.value ? "default" : "outline"}
                onClick={() => handleThemeChange(t.value)}
                className="w-32"
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Aktivne sedenia</CardTitle>
          <CardDescription>Prehlad vasich aktivnych prihlaseni</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Toto zariadenie</p>
                <p className="text-sm text-muted-foreground">
                  Posledne prihlasenie: {user?.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleString("sk-SK")
                    : "-"}
                </p>
              </div>
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Sign out */}
      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleSignOut}>
          Odhlasit sa
        </Button>
      </div>
    </div>
  )
}

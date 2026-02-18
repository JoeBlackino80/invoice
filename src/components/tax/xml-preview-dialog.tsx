"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Download, Copy, Check } from "lucide-react"

interface XmlPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  xmlContent: string
  title: string
  filename: string
}

export function XmlPreviewDialog({
  open,
  onOpenChange,
  xmlContent,
  title,
  filename,
}: XmlPreviewDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(xmlContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([xmlContent], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{filename}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Skopirovane
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Kopirovat
              </>
            )}
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Stiahnut XML
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0 max-h-[60vh] rounded-md border bg-muted/30">
          <pre className="p-4 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed">
            {xmlContent}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

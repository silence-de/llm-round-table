import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[100px] w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-relaxed transition-[border-color,background-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-border focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_rgb(239_68_68_/_0.20)] dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:shadow-[0_0_0_3px_rgb(239_68_68_/_0.40)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

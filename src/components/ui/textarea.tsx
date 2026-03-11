import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-[16px] leading-5 transition-[border-color,background-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-[var(--rt-hh6-primary)] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--rt-hh6-primary)_20%,transparent)] disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_20%,transparent)] sm:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_40%,transparent)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

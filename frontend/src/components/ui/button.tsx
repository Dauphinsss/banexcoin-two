import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Banexcoin signature: cream → orange → deep red gradient + white text + premium depth
        // (layered shadows: inset top highlight, inset bottom darken, warm outer halo, violet bloom)
        default:
          "text-white font-semibold bg-[linear-gradient(135deg,oklch(0.93_0.06_75)_0%,oklch(0.80_0.15_55)_30%,oklch(0.68_0.20_38)_65%,oklch(0.58_0.19_25)_100%)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),inset_0_-1px_0_0_rgba(0,0,0,0.12),0_2px_8px_-2px_oklch(0.665_0.205_35/0.5),0_12px_32px_-8px_oklch(0.60_0.20_30/0.55),0_18px_50px_-12px_oklch(0.55_0.20_300/0.30)] hover:brightness-110 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55),inset_0_-1px_0_0_rgba(0,0,0,0.15),0_3px_10px_-2px_oklch(0.665_0.205_35/0.6),0_14px_38px_-8px_oklch(0.60_0.20_30/0.65),0_22px_60px_-12px_oklch(0.55_0.20_300/0.40)]",
        destructive:
          "bg-destructive text-white shadow-sm hover:brightness-110 focus-visible:ring-destructive/40",
        // Glassy dark pill — like "Acceso Empresas"
        outline:
          "text-foreground border border-white/[0.08] bg-[linear-gradient(135deg,oklch(0.28_0.015_280/0.6)_0%,oklch(0.20_0.015_280/0.8)_100%)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm hover:border-white/[0.14] hover:bg-[linear-gradient(135deg,oklch(0.32_0.015_280/0.7)_0%,oklch(0.24_0.015_280/0.9)_100%)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:bg-secondary/80",
        ghost:
          "text-foreground hover:bg-white/[0.04] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        default: "h-9 px-5 has-[>svg]:px-4",
        xs: "h-6 gap-1 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-11 px-7 has-[>svg]:px-5 text-[15px]",
        icon: "size-9 rounded-full",
        "icon-xs": "size-6 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

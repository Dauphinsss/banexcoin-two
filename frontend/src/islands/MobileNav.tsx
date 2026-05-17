'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetClose } from '@/components/ui/sheet'

type NavId = 'dashboard' | 'uploads' | 'rebates' | 'tiers' | 'reconciliation' | 'simulator'

interface NavItem {
  id: NavId
  href: string
  label: string
  hint: string
  icon: string
}

interface MobileNavProps {
  navItems: NavItem[]
  activePage?: NavId
}

export default function MobileNav({ navItems, activePage }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="mobile-nav-trigger group relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300 hover:bg-accent/60 hover:text-foreground active:scale-90"
          aria-label="Abrir menú"
        >
          <span className="relative flex size-5 items-center justify-center">
            <Menu
              className={[
                'absolute size-5 transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]',
                open ? 'rotate-180 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
              ].join(' ')}
            />
            <X
              className={[
                'absolute size-5 transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]',
                open ? 'rotate-0 scale-100 opacity-100' : '-rotate-180 scale-0 opacity-0',
              ].join(' ')}
            />
          </span>
          <span className="absolute inset-0 rounded-xl bg-primary/0 transition-all duration-500 group-hover:bg-primary/5"></span>
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="mobile-nav-sheet w-80 max-w-[85vw] p-0 flex flex-col border-l border-sidebar-border/30 bg-gradient-to-br from-sidebar via-background to-sidebar"
        showCloseButton={false}
      >
        {/* Ambient gradient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-primary/20 blur-3xl opacity-50"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-primary/10 blur-3xl opacity-40"
        />

        <SheetHeader className="relative border-b border-sidebar-border/40 bg-gradient-to-b from-sidebar/80 to-sidebar/40 backdrop-blur-sm p-6 flex flex-row items-center justify-between">
          <div className="flex items-center mobile-nav-logo">
            <img
              src="/logo.png"
              alt="Banexcoin · BanexReintegra"
              width="140"
              height="20"
              className="h-5 w-auto object-contain opacity-90"
            />
          </div>
          <SheetClose asChild>
            <button
              className="group relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300 hover:bg-accent/60 hover:text-foreground hover:rotate-90 active:scale-90"
              aria-label="Cerrar menú"
            >
              <X className="size-4 transition-transform duration-300" />
            </button>
          </SheetClose>
        </SheetHeader>

        <nav className="relative flex-1 flex flex-col gap-1 overflow-y-auto p-4" aria-label="Navegación móvil">
          {navItems.map((item, index) => {
            const isActive = item.id === activePage
            return (
              <a
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={[
                  'mobile-nav-item group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-sm transition-all duration-300 ease-out',
                  isActive
                    ? 'bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/30 hover:text-sidebar-foreground hover:translate-x-1',
                ].join(' ')}
                style={{
                  animationDelay: `${index * 60}ms`,
                }}
              >
                {/* Active indicator with pulse */}
                {isActive && (
                  <>
                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-primary via-primary to-primary/60 shadow-[0_0_10px_oklch(0.665_0.205_35/0.6)]" />
                    <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary animate-pulse opacity-60" />
                  </>
                )}

                {/* Hover shimmer effect */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-700 group-hover:translate-x-full"></span>

                <span
                  className={[
                    'mobile-nav-icon relative flex size-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300',
                    isActive
                      ? 'bg-primary/20 text-primary shadow-lg shadow-primary/30 scale-105'
                      : 'bg-sidebar-accent/40 text-muted-foreground group-hover:bg-sidebar-accent/70 group-hover:text-sidebar-foreground group-hover:scale-110 group-hover:rotate-6',
                  ].join(' ')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                    className="transition-transform duration-500 ease-out"
                  />
                  {isActive && (
                    <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/40 animate-pulse"></span>
                  )}
                </span>

                <span className="relative flex-1 min-w-0">
                  <span className={[
                    'block font-medium leading-tight transition-all duration-300',
                    isActive ? 'text-foreground' : 'group-hover:translate-x-0.5'
                  ].join(' ')}>{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground/70 transition-opacity duration-300 group-hover:text-muted-foreground">{item.hint}</span>
                </span>

                {/* Arrow indicator on hover */}
                <span className={[
                  'shrink-0 text-muted-foreground/0 transition-all duration-300',
                  isActive ? 'text-primary opacity-100' : 'group-hover:translate-x-1 group-hover:text-muted-foreground/60'
                ].join(' ')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </span>
              </a>
            )
          })}
        </nav>

        {/* Footer decoration */}
        <div className="relative border-t border-sidebar-border/30 bg-gradient-to-t from-sidebar/50 to-transparent p-4">
          <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
            <span className="h-1 w-1 rounded-full bg-primary/40 animate-pulse"></span>
            <span>BanexReintegra</span>
            <span className="h-1 w-1 rounded-full bg-primary/40 animate-pulse"></span>
          </div>
        </div>

        <style>{`
          .mobile-nav-sheet[data-state="open"] .mobile-nav-logo {
            animation: fadeSlideIn 0.5s ease-out forwards;
          }

          .mobile-nav-sheet[data-state="open"] .mobile-nav-item {
            opacity: 0;
            animation: itemSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes itemSlideIn {
            0% {
              opacity: 0;
              transform: translateX(30px) scale(0.95);
            }
            60% {
              opacity: 1;
            }
            100% {
              opacity: 1;
              transform: translateX(0) scale(1);
            }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  )
}

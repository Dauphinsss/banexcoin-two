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
          className="group flex items-center justify-center rounded-md p-2 text-muted-foreground transition-all duration-200 hover:bg-accent/80 hover:text-foreground active:scale-95"
          aria-label="Abrir menú"
        >
          {open ? (
            <X className="size-5 animate-in fade-in-0 rotate-in-90 duration-200" />
          ) : (
            <Menu className="size-5 animate-in fade-in-0 rotate-in-90 duration-200" />
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col" showCloseButton={false}>
        <SheetHeader className="border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar/50 to-sidebar p-6 flex flex-row items-center justify-between">
          <div className="flex items-center">
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
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </SheetClose>
        </SheetHeader>
        <nav className="flex-1 flex flex-col space-y-0.5 overflow-y-auto p-3" aria-label="Navegación móvil">
          {navItems.map((item, index) => {
            const isActive = item.id === activePage
            return (
              <a
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setOpen(false)}
                style={{
                  animation: open ? `slideInUp 0.3s ease-out forwards` : 'none',
                  animationDelay: `${index * 50}ms`,
                }}
                className={[
                  'nav-link group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-primary/20 via-primary/15 to-transparent text-sidebar-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
                ].join(' ')}
              >
                {isActive && (
                  <span className="absolute inset-y-0 left-0 w-1 rounded-r-md bg-primary" />
                )}
                <span
                  className={[
                    'nav-icon flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary/20 text-primary shadow-md shadow-primary/20'
                      : 'bg-sidebar-accent/50 text-muted-foreground group-hover:bg-sidebar-accent/70 group-hover:text-sidebar-foreground group-hover:shadow-sm',
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
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium leading-tight">{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground/80">{item.hint}</span>
                </span>
              </a>
            )
          })}
        </nav>

        <style>{`
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  )
}

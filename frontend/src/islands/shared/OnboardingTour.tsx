import { useEffect, type JSX } from 'react'
import { HelpCircle } from 'lucide-react'

const TOUR_KEY = 'banex:onboarding-done'

const steps = [
  {
    element: '#nav-dashboard',
    popover: {
      title: 'Dashboard',
      description:
        'Vista ejecutiva del último cierre: reintegros, usuarios beneficiados y conciliación de un vistazo.',
    },
  },
  {
    element: '#nav-uploads',
    popover: {
      title: '1 · Sube tu Excel',
      description:
        'Todo empieza aquí. Carga el reporte mensual de pagos QR; se valida y procesa en segundos.',
    },
  },
  {
    element: '#nav-rebates',
    popover: {
      title: '2 · Revisa reintegros',
      description:
        'Tabla por usuario con el cashback calculado. Filtra, ordena y exporta a CSV. Haz clic en una fila para ver el detalle.',
    },
  },
  {
    element: '#nav-reconciliation',
    popover: {
      title: '3 · Concilia con el banco',
      description:
        'Anomalías entre los pagos QR y el extracto bancario, con explicación generada por IA.',
    },
  },
  {
    element: '#nav-tiers',
    popover: {
      title: '4 · Ajusta los niveles',
      description: 'Define las reglas de cashback por tramo de gasto y publícalas por período.',
    },
  },
  {
    element: '#nav-simulator',
    popover: {
      title: '5 · Simula el impacto',
      description:
        'Mueve los parámetros en vivo y mira cómo cambia el costo total antes de publicar nada.',
    },
  },
]

type DriverFactory = (options: Record<string, unknown>) => { drive: () => void }

async function createTour() {
  try {
    const driverModule = 'driver.js'
    const driverStyles = 'driver.js/dist/driver.css'
    const [{ driver }] = await Promise.all([
      import(/* @vite-ignore */ driverModule) as Promise<{ driver: DriverFactory }>,
      import(/* @vite-ignore */ driverStyles),
    ])

    return driver({
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Empezar',
      overlayColor: 'oklch(0.12 0.015 280)',
      overlayOpacity: 0.72,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: 'banex-tour',
      steps,
    })
  } catch {
    return null
  }
}

function driveTourSafely() {
  void createTour().then((tour) => {
    tour?.drive()
  })
}

/**
 * Tour de onboarding con driver.js. Se lanza una sola vez (primera
 * visita, guardado en localStorage) y queda disponible mediante el
 * botón flotante "¿Cómo funciona?" para relanzarlo cuando se quiera.
 */
export function OnboardingTour(): JSX.Element {
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return
    // Pequeño delay para que el sidebar haya animado su entrada.
    const timer = window.setTimeout(() => {
      driveTourSafely()
      localStorage.setItem(TOUR_KEY, '1')
    }, 700)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <>
      <style>{TOUR_STYLES}</style>
      <button
        type="button"
        onClick={() => driveTourSafely()}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/90 px-4 py-2.5 text-sm font-medium text-foreground shadow-lg shadow-black/30 backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card hover:shadow-xl hover:shadow-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label="Iniciar recorrido guiado de la aplicación"
      >
        <span className="relative flex size-7 items-center justify-center rounded-full bg-primary/14 text-primary ring-1 ring-primary/20">
          <HelpCircle className="size-4" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary shadow-[0_0_0_4px_oklch(0.645_0.21_33/0.18)]" />
        </span>
        ¿Cómo funciona?
      </button>
    </>
  )
}

export default OnboardingTour

/* Tematización de driver.js acorde a la marca Banexcoin (naranja). */
const TOUR_STYLES = `
.driver-popover.banex-tour {
  background: oklch(0.22 0.015 280);
  color: oklch(0.985 0 0);
  border: 1px solid oklch(0.32 0.015 280);
  border-radius: 14px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.85);
  max-width: 320px;
}
.driver-popover.banex-tour .driver-popover-title {
  font-size: 15px;
  font-weight: 700;
  color: oklch(0.985 0 0);
}
.driver-popover.banex-tour .driver-popover-description {
  font-size: 13px;
  line-height: 1.55;
  color: oklch(0.72 0.01 280);
}
.driver-popover.banex-tour .driver-popover-progress-text {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: oklch(0.62 0.01 280);
}
.driver-popover.banex-tour .driver-popover-arrow {
  border-color: oklch(0.22 0.015 280) !important;
}
.driver-popover.banex-tour button {
  text-shadow: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  transition: filter 0.2s, background-color 0.2s;
}
.driver-popover.banex-tour .driver-popover-prev-btn {
  background: oklch(0.30 0.015 280);
  color: oklch(0.985 0 0);
  border: 1px solid oklch(0.36 0.015 280);
}
.driver-popover.banex-tour .driver-popover-next-btn,
.driver-popover.banex-tour .driver-popover-done-btn {
  background: oklch(0.645 0.21 33);
  color: #fff;
  border: 0;
}
.driver-popover.banex-tour .driver-popover-next-btn:hover,
.driver-popover.banex-tour .driver-popover-done-btn:hover {
  filter: brightness(1.1);
}
.driver-popover.banex-tour .driver-popover-close-btn {
  color: oklch(0.72 0.01 280);
}
`

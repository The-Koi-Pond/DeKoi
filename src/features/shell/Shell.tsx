import { KoiSprite } from '../../shared/ui/KoiSprite'
import { Waterline } from './waterline/Waterline'
import { Bank } from './bank/Bank'
import { Shoal } from './shoal/Shoal'
import { Tide } from './tide/Tide'
import { CareDrawer } from './care/CareDrawer'
import { Pond } from '../pond/Pond'
import type { NavContextType } from '../../shared/ui/nav-context'

interface ShellProps {
  nav: NavContextType
}

export function Shell({ nav }: ShellProps) {
  return (
    <div className="app">
      <KoiSprite />
      <div className="caustics" aria-hidden="true" />
      <div className="caustics b" aria-hidden="true" />

      <Waterline />
      <Bank />
      <Shoal />
      <Pond nav={nav} />
      <Tide nav={nav} />
      <CareDrawer nav={nav} />
    </div>
  )
}

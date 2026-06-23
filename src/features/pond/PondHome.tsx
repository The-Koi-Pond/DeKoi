import type { NavContextType } from '../../shared/ui/nav-context'
import { Hero } from './hero/Hero'
import { ModePools } from './pools/ModePools'
import { RecentCurrents } from './currents/RecentCurrents'
import { Depths } from './depths/Depths'

interface PondHomeProps {
  nav: NavContextType
}

export function PondHome({ nav }: PondHomeProps) {
  return (
    <>
      <Hero />
      <ModePools nav={nav} />
      <RecentCurrents />
      <Depths />
    </>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { AvatarsScreen } from '@/screens/avatars/avatars-screen'

export const Route = createFileRoute('/avatars')({
  ssr: false,
  component: function AvatarsRoute() {
    usePageTitle('Avatars')
    return <AvatarsScreen />
  },
})

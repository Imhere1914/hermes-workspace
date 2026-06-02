import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { SocialScreen } from '@/screens/social/social-screen'

export const Route = createFileRoute('/social')({
  ssr: false,
  component: function SocialRoute() {
    usePageTitle('Social')
    return <SocialScreen />
  },
})

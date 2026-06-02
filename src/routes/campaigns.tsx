import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { CampaignsScreen } from '@/screens/campaigns/campaigns-screen'

export const Route = createFileRoute('/campaigns')({
  ssr: false,
  component: function CampaignsRoute() {
    usePageTitle('Campaigns')
    return <CampaignsScreen />
  },
})

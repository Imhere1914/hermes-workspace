import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { PagesScreen } from '@/screens/pages/pages-screen'

export const Route = createFileRoute('/pages')({
  ssr: false,
  component: function PagesRoute() {
    usePageTitle('Pages')
    return <PagesScreen />
  },
})

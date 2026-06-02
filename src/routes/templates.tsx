import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { TemplatesScreen } from '@/screens/templates/templates-screen'

export const Route = createFileRoute('/templates')({
  ssr: false,
  component: function TemplatesRoute() {
    usePageTitle('Templates')
    return <TemplatesScreen />
  },
})

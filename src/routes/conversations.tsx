import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ConversationsScreen } from '@/screens/conversations/conversations-screen'

export const Route = createFileRoute('/conversations')({
  ssr: false,
  component: function ConversationsRoute() {
    usePageTitle('Conversations')
    return <ConversationsScreen />
  },
})

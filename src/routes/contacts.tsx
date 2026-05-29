import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { ContactsScreen } from '@/screens/contacts/contacts-screen'

export const Route = createFileRoute('/contacts')({
  ssr: false,
  component: function ContactsRoute() {
    usePageTitle('Contacts')
    return <ContactsScreen />
  },
})

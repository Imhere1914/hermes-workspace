import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { AppointmentsScreen } from '@/screens/appointments/appointments-screen'

export const Route = createFileRoute('/appointments')({
  ssr: false,
  component: function AppointmentsRoute() {
    usePageTitle('Appointments')
    return <AppointmentsScreen />
  },
})

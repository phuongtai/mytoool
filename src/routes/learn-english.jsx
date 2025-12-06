import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/learn-english')({
  component: () => <Outlet />,
})

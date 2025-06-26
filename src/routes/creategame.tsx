import { createFileRoute } from '@tanstack/react-router'
import CreateGame from '../features/CreateGame.tsx'

export const Route = createFileRoute('/creategame')({
  component: TheRoute,
})

function TheRoute() {
  return <CreateGame/>
}
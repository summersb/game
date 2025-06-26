import { createFileRoute } from '@tanstack/react-router'
import JoinGame from '../../features/JoinGame'

export const Route = createFileRoute('/joingame/$sessionId')({
  component: Join,
})

function Join() {
  const { sessionId } = Route.useParams()
  return <JoinGame sessionId={sessionId}/>
}

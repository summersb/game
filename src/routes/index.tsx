import { createFileRoute } from '@tanstack/react-router'
import App from '../App.tsx'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return <App />
}

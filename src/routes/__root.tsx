import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ThemeProvider } from '../context/ThemeContext'
import ThemeTitle from '../components/ThemeTitle.tsx'
import AppContainer from '../components/AppContainer.tsx'

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider>
      <AppContainer>
        <ThemeTitle>Naval Combat Card Game</ThemeTitle>
        <Outlet />
        <TanStackRouterDevtools />
      </AppContainer>
    </ThemeProvider>
  ),
})

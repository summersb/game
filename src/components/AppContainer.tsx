import React, { ReactNode } from 'react'
import styled from '@emotion/styled'
import { ThemeColors } from '../types/theme'
import { useTheme } from '../context/useTheme'

const Container = styled.div<{ themeColors: ThemeColors }>`
  min-height: 100vh;
  background-color: ${props => props.themeColors.background};
  padding: 20px;
`

type Props = {
  children: ReactNode
}

const AppContainer: React.FC<Props> = ({children}) => {
  const { themeColors } = useTheme()
  return (
    <Container themeColors={themeColors}>{children}</Container>
  )
}

export default AppContainer
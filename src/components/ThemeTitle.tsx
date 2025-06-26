import styled from '@emotion/styled'
import { ThemeColors } from '../types/theme'
import React, { HTMLAttributes } from 'react'
import { useTheme } from '../context/useTheme'

const Title = styled.h1<{ themeColors: ThemeColors }>`
  text-align: center;
  color: ${props => props.themeColors.text};
  margin-bottom: 30px;
`
type ThemeTitleProps = {
  children: React.ReactNode
} & HTMLAttributes<HTMLHeadingElement>;

const ThemeTitle: React.FC<ThemeTitleProps> = ({children, ...rest}) => {
  const { themeColors} = useTheme()
  return (
    <Title themeColors={themeColors} {...rest}>{children}</Title>
  )
}

export default ThemeTitle

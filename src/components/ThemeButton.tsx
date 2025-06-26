import React, { ButtonHTMLAttributes } from 'react'
import { useTheme } from '../context/useTheme'
import styled from '@emotion/styled'
import { ThemeColors } from '../types/theme'

const Button = styled.button<{ themeColors: ThemeColors }>`
  padding: 10px 20px;
  background-color: ${props => props.themeColors.buttonBackground};
  color: ${props => props.themeColors.buttonText};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  text-decoration: none;
  display: inline-block;
  text-align: center;

  &:hover {
    background-color: ${props => props.themeColors.buttonHover};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`

type ThemeButtonProps = {
  children: React.ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

const ThemeButton: React.FC<ThemeButtonProps> = ({ children, ...rest }) => {
  const { themeColors } = useTheme()
  return (
    <Button themeColors={themeColors} {...rest}>
      {children}
    </Button>
  )
}

export default ThemeButton
import { Link, LinkProps } from '@tanstack/react-router'
import styled from '@emotion/styled'
import { useTheme } from '../context/useTheme'
import { ThemeColors } from '../types/theme'
import React from 'react'

// Separate out theme-aware props
type StyledLinkButtonProps = {
} & LinkProps

// Wrap Link in forwardRef to satisfy Emotion
const BaseLink = React.forwardRef<HTMLAnchorElement, StyledLinkButtonProps>(
  ({ ...props }, ref) => (
    <Link {...props} ref={ref} />
  )
)

const StyledLinkButton = styled(BaseLink)<{ themeColors: ThemeColors }>`
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

type ThemeButtonLinkProps = {
  children: React.ReactNode
} & LinkProps

const ThemeButtonLink: React.FC<ThemeButtonLinkProps> = ({ children, to, ...rest }) => {
  const { themeColors } = useTheme()
  return (
    <StyledLinkButton to={to} themeColors={themeColors} {...rest}>
      {children}
    </StyledLinkButton>
  )
}

export default ThemeButtonLink

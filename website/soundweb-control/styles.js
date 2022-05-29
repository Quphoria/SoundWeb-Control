import React from "react"
import styled from "@emotion/styled"

export const Nav = styled("div")`
  & > * {
    margin-left: 1em;
    color: white;
  }
  background: black;
  padding: 0.8em;
  height: 0.2em;
  display: flex;
  align-items: center;
`
export const PageBody = styled("div")`
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
`

export const TabHead = styled("div")`
  display: flex;
`
export const TabBody = styled(PageBody)`
  background-color: transparent;
  padding-left: 3px;
  padding-right: 3px;
  padding-top: 1px;
  border: 1px solid gray;
  box-sizing: border-box;
  display: inline-block;
`

export const ControlWrapper = styled("div")`
  position:relative;
`

export const Padding = styled("div")`
  padding: 1em;
`

export const Rainbow = styled("span")`
  font-weight: bold;
  color: hsl(
    0, 
    90%, 
    65%
  );
  animation: rainbow-colors 2s linear infinite;
  @keyframes rainbow-colors {
    0% { color: hsl(0turn, 90%, 65%); }
    25% { color: hsl(.25turn, 90%, 65%); }
    50% { color: hsl(.5turn, 90%, 65%); }
    75% { color: hsl(.75turn, 90%, 65%); }
    100% { color: hsl(1turn, 90%, 65%); }
  }
`

export const Footer = styled("footer")`
  margin-bottom: 0;
  width: 100%;
  border-top: 1px solid #eaeaea;
  display: flex;
  justify-content: center;
  align-items: center;
`

export const Spacer = styled("div")`
  height: 10rem;
`
declare module 'framer-motion' {
  import type { ComponentType, HTMLAttributes } from 'react'

  export const motion: Record<string, ComponentType<HTMLAttributes<HTMLElement> & Record<string, unknown>>>
}

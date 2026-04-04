"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
})

function Tabs({
  value,
  onValueChange,
  defaultValue,
  children,
  className,
}: {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  children: React.ReactNode
  className?: string
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const actualValue = value ?? internalValue
  const actualOnChange = onValueChange ?? setInternalValue

  return (
    <TabsContext.Provider value={{ value: actualValue, onValueChange: actualOnChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ value: tabValue, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const { value, onValueChange } = React.useContext(TabsContext)
  return (
    <button
      type="button"
      onClick={() => onValueChange(tabValue)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        value === tabValue && "bg-background text-foreground shadow-sm",
        className
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({ value: tabValue, className, children }: { value: string; className?: string; children: React.ReactNode }) {
  const { value } = React.useContext(TabsContext)
  if (value !== tabValue) return null
  return <div className={cn("mt-2", className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupContextValue {
  value: string
  onChange: (value: string) => void
  name?: string
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  value: "",
  onChange: () => {},
})

export function RadioGroup({
  children,
  value,
  onValueChange,
  name,
  className,
}: {
  children: React.ReactNode
  value: string
  onValueChange: (value: string) => void
  name?: string
  className?: string
}) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange: onValueChange, name }}>
      <div className={className} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

export function RadioGroupItem({
  value: itemValue,
  id,
  disabled = false,
  className,
}: {
  value: string
  id: string
  disabled?: boolean
  className?: string
}) {
  const { value, onChange, name } = React.useContext(RadioGroupContext)

  return (
    <input
      type="radio"
      name={name}
      id={id}
      value={itemValue}
      checked={value === itemValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "h-4 w-4 rounded-full border-2 border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  )
}

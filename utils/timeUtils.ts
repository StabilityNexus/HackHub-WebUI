// Time utility functions for UTC handling and formatting

export type TimezoneMode = 'local' | 'utc'

/**
 * Get current UTC timestamp
 */
export const getCurrentUTCTimestamp = (): number => {
  return Math.floor(Date.now() / 1000)
}

/**
 * Convert local date/time to UTC timestamp
 */
export const convertLocalToUTC = (dateStr: string, timeStr: string): number => {
  const localDateTime = new Date(`${dateStr}T${timeStr}`)
  return Math.floor(localDateTime.getTime() / 1000)
}

/**
 * Convert UTC date/time to UTC timestamp (no timezone conversion needed)
 */
export const convertUTCToTimestamp = (dateStr: string, timeStr: string): number => {
  const utcDateTime = new Date(`${dateStr}T${timeStr}:00.000Z`)
  return Math.floor(utcDateTime.getTime() / 1000)
}

/**
 * Format UTC timestamp to 24-hour format date/time string
 */
export const formatUTCTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes} UTC`
}

/**
 * Format UTC timestamp to date only
 */
export const formatUTCDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Format UTC timestamp to time only (24-hour format)
 */
export const formatUTCTime = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * Get current date in YYYY-MM-DD format (UTC)
 */
export const getCurrentUTCDate = (): string => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * Get current time in HH:MM format (UTC)
 */
export const getCurrentUTCTime = (): string => {
  const now = new Date()
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  
  return `${hours}:${minutes}`
}

/**
 * Convert timestamp to date format required by contract (YYYYMMDD)
 */
export const timestampToContractDate = (timestamp: number): number => {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  
  return parseInt(`${year}${month}${day}`)
}

/**
 * Validate that a date/time is in the future (UTC)
 */
export const isInFuture = (dateStr: string, timeStr: string, mode: TimezoneMode = 'utc'): boolean => {
  const inputTimestamp = mode === 'local' 
    ? convertLocalToUTC(dateStr, timeStr)
    : convertUTCToTimestamp(dateStr, timeStr)
  
  const currentTimestamp = getCurrentUTCTimestamp()
  
  return inputTimestamp > currentTimestamp
}

/**
 * Format timestamp for display in different contexts
 */
export const formatTimestampForDisplay = (timestamp: number, format: 'full' | 'date' | 'time' = 'full'): string => {
  switch (format) {
    case 'date':
      return formatUTCDate(timestamp)
    case 'time':
      return formatUTCTime(timestamp)
    case 'full':
    default:
      return formatUTCTimestamp(timestamp)
  }
} 
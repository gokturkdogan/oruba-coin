import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Türkiye formatında sayı formatlama
 * Binlik ayırıcı: nokta (.) | Ondalık ayırıcı: virgül (,)
 * Örnek: 1234.56 -> "1.234,56"
 */
export function formatNumberTR(
  num: number | string,
  options?: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  }
): string {
  const numValue = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(numValue)) return '0,00'
  
  return numValue.toLocaleString('tr-TR', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    ...options,
  })
}

/**
 * toFixed sonucunu Türkiye formatına çevirir
 */
export function toFixedTR(num: number | string, decimals: number): string {
  const numValue = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(numValue)) return '0,' + '0'.repeat(decimals)
  
  const fixed = numValue.toFixed(decimals)
  // Nokta ile virgülü değiştir
  return fixed.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

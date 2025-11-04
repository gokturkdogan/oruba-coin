import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/middleware'
import { sendPriceAlertEmail } from '@/lib/resend'
import { z } from 'zod'

const triggerSchema = z.object({
  symbol: z.string().min(1),
  currentPrice: z.number().positive(),
  alertId: z.string().optional(),
})

// POST - Trigger price alert and send email
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { symbol, currentPrice, alertId } = triggerSchema.parse(body)

    console.log(`[PriceAlert Trigger] Received request for ${symbol}, price: ${currentPrice}, alertId: ${alertId}`)

    // Find specific alert if alertId provided, otherwise find first matching alert
    let alert
    if (alertId) {
      const foundAlert = await prisma.priceAlert.findFirst({
        where: {
          id: alertId,
          userId: user.id,
          symbol: symbol.toUpperCase(),
          isActive: true,
          triggeredAt: null,
        },
      })

      console.log(`[PriceAlert Trigger] Found alert:`, foundAlert ? { id: foundAlert.id, targetPrice: foundAlert.targetPrice } : 'not found')

      // Check if price reached target price based on alert type and tolerance
      if (foundAlert) {
        const priceDiff = Math.abs(currentPrice - foundAlert.targetPrice)
        const tolerance = foundAlert.targetPrice * 0.001
        
        // Check direction and tolerance
        let shouldTrigger = false
        if (foundAlert.type === 'above') {
          // Price should be >= target price (within tolerance)
          shouldTrigger = currentPrice >= (foundAlert.targetPrice - tolerance)
          console.log(`[PriceAlert Trigger] Above check: ${currentPrice} >= ${foundAlert.targetPrice - tolerance} = ${shouldTrigger}`)
        } else {
          // Price should be <= target price (within tolerance)
          shouldTrigger = currentPrice <= (foundAlert.targetPrice + tolerance)
          console.log(`[PriceAlert Trigger] Below check: ${currentPrice} <= ${foundAlert.targetPrice + tolerance} = ${shouldTrigger}`)
        }
        
        console.log(`[PriceAlert Trigger] Price check: type=${foundAlert.type}, target=${foundAlert.targetPrice}, current=${currentPrice}, diff=${priceDiff}, tolerance=${tolerance}, shouldTrigger=${shouldTrigger}`)
        
        if (shouldTrigger) {
          alert = foundAlert
        } else {
          console.log(`[PriceAlert Trigger] Alert not triggered - price condition not met`)
        }
      }
    } else {
      // Find all active alerts for this symbol and check which one should trigger
      const activeAlerts = await prisma.priceAlert.findMany({
        where: {
          userId: user.id,
          symbol: symbol.toUpperCase(),
          isActive: true,
          triggeredAt: null,
        },
      })

      // Find the alert that should be triggered (price reached target based on type)
      for (const a of activeAlerts) {
        const priceDiff = Math.abs(currentPrice - a.targetPrice)
        const tolerance = a.targetPrice * 0.001
        
        // Check direction and tolerance
        let shouldTrigger = false
        if (a.type === 'above') {
          // Price should be >= target price (within tolerance)
          shouldTrigger = currentPrice >= (a.targetPrice - tolerance)
        } else {
          // Price should be <= target price (within tolerance)
          shouldTrigger = currentPrice <= (a.targetPrice + tolerance)
        }
        
        if (shouldTrigger) {
          alert = a
          break
        }
      }
    }

    if (!alert) {
      return NextResponse.json(
        { message: 'Alarm henüz tetiklenmedi', triggered: false },
        { status: 200 }
      )
    }

    console.log(`[PriceAlert Trigger] Triggering alert ${alert.id} for ${alert.symbol}`)

    // Send email
    try {
      // Use alert type (already set when alert was created)
      const type = alert.type as 'above' | 'below'
      console.log(`[PriceAlert Trigger] Sending email to ${user.email}, type: ${type}`)
      console.log(`[PriceAlert Trigger] Email details:`, {
        email: user.email,
        name: user.name,
        symbol: alert.symbol,
        targetPrice: alert.targetPrice,
        currentPrice: currentPrice,
        type: type
      })
      
      const emailResult = await sendPriceAlertEmail(
        user.email,
        user.name,
        alert.symbol,
        alert.targetPrice,
        currentPrice,
        type
      )
      
      console.log(`[PriceAlert Trigger] Email sent successfully:`, emailResult)
    } catch (emailError: any) {
      console.error('[PriceAlert Trigger] Failed to send price alert email:', emailError)
      console.error('[PriceAlert Trigger] Error details:', {
        message: emailError?.message,
        stack: emailError?.stack,
        name: emailError?.name
      })
      // Continue even if email fails - alert was triggered
    }

    // Mark as triggered and deactivate (email was sent or attempted)
    // Alert is triggered, so it should be deactivated regardless of email status
    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: {
        triggeredAt: new Date(),
        isActive: false,
      },
    })
    console.log(`[PriceAlert Trigger] Alert marked as triggered and deactivated in database`)

    return NextResponse.json({
      message: 'Alarm tetiklendi ve email gönderildi',
      triggered: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri formatı', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Price alert trigger error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


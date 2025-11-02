'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function CheckoutCancelPage() {
  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
          <CardDescription>Your payment was cancelled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              No charges were made. You can try again anytime.
            </p>
          </div>
          <div className="flex gap-4 pt-4">
            <Button asChild className="flex-1">
              <Link href="/checkout">Try Again</Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/coins">Back to Coins</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}


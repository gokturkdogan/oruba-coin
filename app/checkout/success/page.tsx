'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      // The webhook should handle the subscription creation
      // Just verify here and redirect
      setTimeout(() => {
        setLoading(false)
        toast.success('Premium subscription activated!')
      }, 2000)
    } else {
      router.push('/checkout')
    }
  }, [sessionId, router])

  if (loading) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 text-muted-foreground">
          Verifying subscription...
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <Check className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>Your premium subscription has been activated</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Thank you for subscribing to Premium. You now have access to all premium features.
            </p>
          </div>
          <div className="flex gap-4 pt-4">
            <Button asChild className="flex-1">
              <Link href="/coins">Explore Coins</Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/profile">View Profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}


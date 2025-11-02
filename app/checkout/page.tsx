'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/login')
          return
        }
        setUser(data.user)
        if (data.user.isPremium) {
          router.push('/profile')
        }
      })
      .catch(() => {
        router.push('/login')
      })
  }, [router])

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to create checkout session')
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('No checkout URL received')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container py-8">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Upgrade to Premium</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-yellow-500" />
            <CardTitle>Premium Plan</CardTitle>
          </div>
          <CardDescription>Unlock advanced features and insights</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Advanced Coin Analytics</div>
                <div className="text-sm text-muted-foreground">
                  Daily charts, extended historical data, and detailed market indicators
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Premium Indicators</div>
                <div className="text-sm text-muted-foreground">
                  Access to advanced technical indicators and market analysis tools
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Export Data</div>
                <div className="text-sm text-muted-foreground">
                  Download coin data and charts in multiple formats
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold">Price Alerts</div>
                <div className="text-sm text-muted-foreground">
                  Set custom price alerts for your favorite coins
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="text-center space-y-4">
              <div>
                <div className="text-4xl font-bold">Premium</div>
                <div className="text-muted-foreground">Subscription-based plan</div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe with Stripe'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Secure payment processing powered by Stripe
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}


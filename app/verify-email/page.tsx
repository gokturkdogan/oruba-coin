'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Doğrulama token\'ı bulunamadı.')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message || 'E-posta adresiniz başarıyla doğrulandı!')
          
          // 3 saniye sonra login sayfasına yönlendir
          setTimeout(() => {
            router.push('/login')
          }, 3000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Doğrulama başarısız oldu.')
        }
      } catch (error) {
        setStatus('error')
        setMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
        console.error('Verification error:', error)
      }
    }

    verifyEmail()
  }, [token, router])

  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <Card className="glass-effect border-white/10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl mb-2">E-posta Doğrulama</CardTitle>
          <CardDescription>
            E-posta adresinizi doğruluyoruz...
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">Lütfen bekleyin...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <p className="text-green-400 font-semibold">{message}</p>
              <p className="text-sm text-muted-foreground">
                3 saniye sonra giriş sayfasına yönlendirileceksiniz...
              </p>
              <Button asChild className="mt-4">
                <Link href="/login">Hemen Giriş Yap</Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 mx-auto text-red-500" />
              <p className="text-red-400 font-semibold">{message}</p>
              <div className="space-y-2">
                <Button asChild variant="outline">
                  <Link href="/login">Giriş Sayfasına Dön</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/register">Yeniden Kayıt Ol</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


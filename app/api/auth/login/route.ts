import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    })

    // Güvenlik: Kullanıcı yoksa veya şifre yanlışsa aynı mesajı döndür
    // Bu sayede kullanıcı enumeration saldırıları önlenir
    if (!user) {
      // Şifre doğrulaması yapmadan önce hata döndür, ama zamanlama farkını önlemek için
      // dummy password hash ile doğrulama yapıyoruz
      await verifyPassword(password, '$2a$10$dummyhashfordummyverification')
      return NextResponse.json(
        { error: 'E-posta adresi veya şifre hatalı' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'E-posta adresi veya şifre hatalı' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.isVerified) {
      return NextResponse.json(
        { error: 'Email adresiniz doğrulanmamış. Lütfen e-posta adresinize gönderilen doğrulama linkine tıklayın.' },
        { status: 403 }
      )
    }

    // Create token
    const token = createToken({ userId: user.id, email: user.email })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPremium: user.subscription?.status === 'active' && 
                   user.subscription.currentPeriodEnd > new Date(),
      },
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue => {
        if (issue.path.includes('email')) {
          return 'Lütfen geçerli bir e-posta adresi girin'
        }
        if (issue.path.includes('password')) {
          return 'Şifre gereklidir'
        }
        return issue.message
      })
      return NextResponse.json(
        { error: errorMessages[0] || 'Lütfen geçerli bilgiler girin' },
        { status: 400 }
      )
    }
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin' },
      { status: 500 }
    )
  }
}


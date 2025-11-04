import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, createToken, generateVerificationToken } from '@/lib/auth'
import { sendVerificationEmail } from '@/lib/resend'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name } = registerSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kullanılıyor. Lütfen farklı bir e-posta adresi deneyin veya giriş yapın' },
        { status: 400 }
      )
    }

    // Create user with verification token
    const passwordHash = await hashPassword(password)
    const verificationToken = generateVerificationToken()
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 saat
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        isVerified: false,
        verificationToken,
        verificationTokenExpiry,
      },
    })

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, name || undefined)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Email gönderilemese bile kullanıcı oluşturuldu, sadece log'layalım
    }

    // Don't create session token - user must verify email first
    return NextResponse.json({
      message: 'Kayıt başarılı! Lütfen e-posta adresinize gönderilen doğrulama linkine tıklayın.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: false,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(issue => {
        if (issue.path.includes('email')) {
          return 'Lütfen geçerli bir e-posta adresi girin'
        }
        if (issue.path.includes('password')) {
          if (issue.code === 'too_small') {
            return 'Şifre en az 8 karakter olmalıdır'
          }
          return 'Şifre gereklidir'
        }
        return issue.message
      })
      return NextResponse.json(
        { error: errorMessages[0] || 'Lütfen geçerli bilgiler girin' },
        { status: 400 }
      )
    }
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin' },
      { status: 500 }
    )
  }
}


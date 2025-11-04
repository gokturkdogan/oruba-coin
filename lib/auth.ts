import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from './prisma'

const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function createToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const payload = jwt.verify(token, secret) as { userId: string; email: string }
    return payload
  } catch {
    return null
  }
}

export async function getCurrentUser(token: string | null) {
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      subscription: true,
    },
  })

  return user
}

export function isPremium(user: { subscription: { status: string; currentPeriodEnd: Date } | null } | null): boolean {
  if (!user || !user.subscription) return false
  return user.subscription.status === 'active' && user.subscription.currentPeriodEnd > new Date()
}

// Generate verification token
export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}


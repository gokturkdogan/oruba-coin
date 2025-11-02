import { NextRequest } from 'next/server'
import { getCurrentUser, isPremium } from './auth'

export async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('token')?.value || null
  return getCurrentUser(token)
}

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requirePremium(request: NextRequest) {
  const user = await requireAuth(request)
  if (!isPremium(user)) {
    throw new Error('Premium subscription required')
  }
  return user
}


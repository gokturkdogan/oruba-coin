import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
})

export const PREMIUM_PLAN_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || ''


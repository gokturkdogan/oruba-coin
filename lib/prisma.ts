import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient()

// Handle connection errors and reconnect
prisma.$on('error' as never, (e: any) => {
  console.error('Prisma error:', e)
  // If connection is closed, try to reconnect
  if (e.message?.includes('Closed') || e.message?.includes('Connection')) {
    console.warn('Prisma connection closed, attempting reconnect...')
    prisma.$connect().catch((err) => {
      console.error('Failed to reconnect Prisma:', err)
    })
  }
})

// Handle disconnections
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

// Helper function to execute queries with retry logic
export async function prismaQuery<T>(
  queryFn: (prisma: PrismaClient) => Promise<T>,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn(prisma)
    } catch (error: any) {
      const isConnectionError = 
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1017' || // Server has closed the connection
        error?.message?.includes('Closed') ||
        error?.message?.includes('Connection')

      if (isConnectionError && i < retries - 1) {
        console.warn(`Prisma connection error, retrying (${i + 1}/${retries})...`)
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        // Try to reconnect
        try {
          await prisma.$connect()
        } catch (connectError) {
          console.error('Failed to reconnect:', connectError)
        }
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}


-- CreateTable
CREATE TABLE IF NOT EXISTS "price_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target_price" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "price_alerts_user_id_market_idx" ON "price_alerts"("user_id", "market");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "price_alerts_symbol_market_is_active_idx" ON "price_alerts"("symbol", "market", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "price_alerts_is_active_market_idx" ON "price_alerts"("is_active", "market");

-- CreateUniqueConstraint
CREATE UNIQUE INDEX IF NOT EXISTS "price_alerts_user_id_symbol_market_type_key" ON "price_alerts"("user_id", "symbol", "market", "type");

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


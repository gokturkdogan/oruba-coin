-- CreateSpotWatchlistTable
CREATE TABLE IF NOT EXISTS "spot_watchlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateFuturesWatchlistTable
CREATE TABLE IF NOT EXISTS "futures_watchlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "futures_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "spot_watchlist_user_id_symbol_key" ON "spot_watchlist"("user_id", "symbol");
CREATE INDEX IF NOT EXISTS "spot_watchlist_user_id_idx" ON "spot_watchlist"("user_id");
CREATE INDEX IF NOT EXISTS "spot_watchlist_symbol_idx" ON "spot_watchlist"("symbol");

CREATE UNIQUE INDEX IF NOT EXISTS "futures_watchlist_user_id_symbol_key" ON "futures_watchlist"("user_id", "symbol");
CREATE INDEX IF NOT EXISTS "futures_watchlist_user_id_idx" ON "futures_watchlist"("user_id");
CREATE INDEX IF NOT EXISTS "futures_watchlist_symbol_idx" ON "futures_watchlist"("symbol");

-- AddForeignKeys
ALTER TABLE "spot_watchlist" ADD CONSTRAINT "spot_watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "futures_watchlist" ADD CONSTRAINT "futures_watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: Old watchlist table will be dropped manually after data migration if needed
-- For now, we keep it for backward compatibility during transition


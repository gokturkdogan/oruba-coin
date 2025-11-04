import { NextResponse } from 'next/server'
import { getAllTickers } from '@/lib/binance'

export async function GET() {
  try {
    // Tüm ticker'ları al (24 saatlik verilerle birlikte)
    const tickers = await getAllTickers()
    
    // Eğer ticker yoksa, fallback olarak normal coins API'yi kullan
    if (!tickers || tickers.length === 0) {
      console.warn('No tickers available from getAllTickers, trying fallback')
      
      // Fallback: Direkt Binance API'den çekmeyi dene
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const spotResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        }).catch(() => null)
        
        clearTimeout(timeoutId)
        
        if (spotResponse && spotResponse.ok) {
          const spotTickers = await spotResponse.json()
          const usdtTickers = spotTickers
            .filter((t: any) => t.symbol.endsWith('USDT'))
            .filter((t: any) => {
              const price = parseFloat(t.lastPrice || t.price || t.closePrice || '0')
              return price > 0 && parseFloat(t.quoteVolume || '0') > 0
            })
            .map((t: any) => ({
              symbol: t.symbol,
              price: t.lastPrice || t.price || t.closePrice || '0',
              priceChangePercent: t.priceChangePercent || '0',
              volume: t.volume || '0',
              quoteVolume: t.quoteVolume || '0',
              futuresVolume: '0',
              futuresQuoteVolume: '0',
              highPrice: t.highPrice || '0',
              lowPrice: t.lowPrice || '0',
              openPrice: t.openPrice || '0',
              prevClosePrice: t.prevClosePrice || '0',
              count: t.count || 0,
            }))
            .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
          
          // Eğer fallback başarılı olduysa, saatlik hacimleri de çek
          const topCoins = usdtTickers.slice(0, 100)
          const hourlyVolumePromises = topCoins.map(async (ticker: any) => {
            const symbol = ticker.symbol
            try {
              const currentTime = Date.now()
              const oneHourAgo = currentTime - (60 * 60 * 1000)
              
              const [spotResponse, futuresResponse] = await Promise.all([
                fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=2`).catch(() => null),
                fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=2`).catch(() => null),
              ])
              
              let spotHourlyVolume = 0
              let spotHourlyBuyVolume = 0
              let spotHourlySellVolume = 0
              let futuresHourlyVolume = 0
              let futuresHourlyBuyVolume = 0
              let futuresHourlySellVolume = 0
              
              if (spotResponse && spotResponse.ok) {
                const spotData = await spotResponse.json()
                for (const kline of spotData) {
                  const openTime = kline[0]
                  const closeTime = kline[6]
                  const quoteVolume = parseFloat(kline[7] || '0')
                  const takerBuyQuoteVolume = parseFloat(kline[10] || '0')
                  const buyVolume = takerBuyQuoteVolume
                  const sellVolume = quoteVolume - buyVolume
                  
                  if (closeTime >= oneHourAgo) {
                    let proportion = 1
                    if (openTime < oneHourAgo) {
                      const totalDuration = closeTime - openTime
                      const relevantDuration = closeTime - oneHourAgo
                      proportion = relevantDuration / totalDuration
                    }
                    
                    spotHourlyVolume += quoteVolume * proportion
                    spotHourlyBuyVolume += buyVolume * proportion
                    spotHourlySellVolume += sellVolume * proportion
                  }
                }
              }
              
              if (futuresResponse && futuresResponse.ok) {
                const futuresData = await futuresResponse.json()
                for (const kline of futuresData) {
                  const openTime = kline[0]
                  const closeTime = kline[6]
                  const quoteVolume = parseFloat(kline[7] || '0')
                  const takerBuyQuoteVolume = parseFloat(kline[10] || '0')
                  const buyVolume = takerBuyQuoteVolume
                  const sellVolume = quoteVolume - buyVolume
                  
                  if (closeTime >= oneHourAgo) {
                    let proportion = 1
                    if (openTime < oneHourAgo) {
                      const totalDuration = closeTime - openTime
                      const relevantDuration = closeTime - oneHourAgo
                      proportion = relevantDuration / totalDuration
                    }
                    
                    futuresHourlyVolume += quoteVolume * proportion
                    futuresHourlyBuyVolume += buyVolume * proportion
                    futuresHourlySellVolume += sellVolume * proportion
                  }
                }
              }
              
              return {
                symbol,
                hourlySpotVolume: spotHourlyVolume.toFixed(2),
                hourlySpotBuyVolume: spotHourlyBuyVolume.toFixed(2),
                hourlySpotSellVolume: spotHourlySellVolume.toFixed(2),
                hourlyFuturesVolume: futuresHourlyVolume.toFixed(2),
                hourlyFuturesBuyVolume: futuresHourlyBuyVolume.toFixed(2),
                hourlyFuturesSellVolume: futuresHourlySellVolume.toFixed(2),
              }
            } catch (error) {
              return {
                symbol,
                hourlySpotVolume: '0',
                hourlySpotBuyVolume: '0',
                hourlySpotSellVolume: '0',
                hourlyFuturesVolume: '0',
                hourlyFuturesBuyVolume: '0',
                hourlyFuturesSellVolume: '0',
              }
            }
          })
          
          const hourlyVolumes = await Promise.all(hourlyVolumePromises)
          
          const coinsWithHourlyVolume = topCoins.map((ticker: any) => {
            const hourlyData = hourlyVolumes.find((v: any) => v.symbol === ticker.symbol)
            return {
              ...ticker,
              hourlySpotVolume: hourlyData?.hourlySpotVolume || '0',
              hourlySpotBuyVolume: hourlyData?.hourlySpotBuyVolume || '0',
              hourlySpotSellVolume: hourlyData?.hourlySpotSellVolume || '0',
              hourlyFuturesVolume: hourlyData?.hourlyFuturesVolume || '0',
              hourlyFuturesBuyVolume: hourlyData?.hourlyFuturesBuyVolume || '0',
              hourlyFuturesSellVolume: hourlyData?.hourlyFuturesSellVolume || '0',
            }
          })
          
          const remainingCoins = usdtTickers.slice(100).map((ticker: any) => ({
            ...ticker,
            hourlySpotVolume: '0',
            hourlySpotBuyVolume: '0',
            hourlySpotSellVolume: '0',
            hourlyFuturesVolume: '0',
            hourlyFuturesBuyVolume: '0',
            hourlyFuturesSellVolume: '0',
          }))
          
          return NextResponse.json({
            coins: [...coinsWithHourlyVolume, ...remainingCoins],
          })
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError)
      }
      
      // Her iki yöntem de başarısız olduysa boş array döndür
      console.error('All methods failed, returning empty array')
      return NextResponse.json({
        coins: [],
      })
    }
    
    // Sadece ilk 100 coin için saatlik hacim çek (rate limit için)
    const topCoins = tickers.slice(0, 100)
    
    // Her coin için spot ve futures saatlik hacim verilerini paralel çek
    const hourlyVolumePromises = topCoins.map(async (ticker) => {
      const symbol = ticker.symbol
      
      try {
        // Dinamik hesaplama: Şu anki zamandan tam 1 saat öncesine kadar olan hacmi hesaplıyoruz
        // Örnek: Eğer şu an 2:55 ise, 1:55-2:55 arası hacmi gösteririz
        const currentTime = Date.now()
        const oneHourAgo = currentTime - (60 * 60 * 1000) // Tam 1 saat önce
        
        // Son 2 saatlik mum çubuklarını al (şu anki saat ve önceki saat)
        const [spotResponse, futuresResponse] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=2`),
          fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=2`).catch(() => null),
        ])
        
        let spotHourlyVolume = 0
        let spotHourlyBuyVolume = 0
        let spotHourlySellVolume = 0
        let futuresHourlyVolume = 0
        let futuresHourlyBuyVolume = 0
        let futuresHourlySellVolume = 0
        
        if (spotResponse.ok) {
          const spotData = await spotResponse.json()
          // Mum çubuklarını işle ve son 1 saat içindeki hacmi topla
          for (const kline of spotData) {
            const openTime = kline[0] // Mum çubuğunun açılış zamanı
            const closeTime = kline[6] // Mum çubuğunun kapanış zamanı
            const quoteVolume = parseFloat(kline[7] || '0')
            const takerBuyQuoteVolume = parseFloat(kline[10] || '0') // USDT cinsinden alış hacmi
            const buyVolume = takerBuyQuoteVolume
            const sellVolume = quoteVolume - buyVolume // Toplam - Alış = Satış
            
            // Eğer bu mum çubuğu son 1 saat içindeyse, hacmini ekle
            if (closeTime >= oneHourAgo) {
              let proportion = 1
              // Mum çubuğu tamamen son 1 saat içindeyse, tamamını ekle
              if (openTime < oneHourAgo) {
                // Mum çubuğu kısmen son 1 saat içindeyse, orantılı olarak ekle
                const totalDuration = closeTime - openTime
                const relevantDuration = closeTime - oneHourAgo
                proportion = relevantDuration / totalDuration
              }
              
              spotHourlyVolume += quoteVolume * proportion
              spotHourlyBuyVolume += buyVolume * proportion
              spotHourlySellVolume += sellVolume * proportion
            }
          }
        }
        
        if (futuresResponse && futuresResponse.ok) {
          const futuresData = await futuresResponse.json()
          for (const kline of futuresData) {
            const openTime = kline[0]
            const closeTime = kline[6]
            const quoteVolume = parseFloat(kline[7] || '0')
            const takerBuyQuoteVolume = parseFloat(kline[10] || '0') // USDT cinsinden alış hacmi
            const buyVolume = takerBuyQuoteVolume
            const sellVolume = quoteVolume - buyVolume // Toplam - Alış = Satış
            
            if (closeTime >= oneHourAgo) {
              let proportion = 1
              if (openTime < oneHourAgo) {
                const totalDuration = closeTime - openTime
                const relevantDuration = closeTime - oneHourAgo
                proportion = relevantDuration / totalDuration
              }
              
              futuresHourlyVolume += quoteVolume * proportion
              futuresHourlyBuyVolume += buyVolume * proportion
              futuresHourlySellVolume += sellVolume * proportion
            }
          }
        }
        
        // String'e çevir
        const spotHourlyVolumeStr = spotHourlyVolume.toFixed(2)
        const spotHourlyBuyVolumeStr = spotHourlyBuyVolume.toFixed(2)
        const spotHourlySellVolumeStr = spotHourlySellVolume.toFixed(2)
        const futuresHourlyVolumeStr = futuresHourlyVolume.toFixed(2)
        const futuresHourlyBuyVolumeStr = futuresHourlyBuyVolume.toFixed(2)
        const futuresHourlySellVolumeStr = futuresHourlySellVolume.toFixed(2)
        
        return {
          symbol,
          hourlySpotVolume: spotHourlyVolumeStr,
          hourlySpotBuyVolume: spotHourlyBuyVolumeStr,
          hourlySpotSellVolume: spotHourlySellVolumeStr,
          hourlyFuturesVolume: futuresHourlyVolumeStr,
          hourlyFuturesBuyVolume: futuresHourlyBuyVolumeStr,
          hourlyFuturesSellVolume: futuresHourlySellVolumeStr,
        }
      } catch (error) {
        console.error(`Error fetching hourly volume for ${symbol}:`, error)
        return {
          symbol,
          hourlySpotVolume: '0',
          hourlyFuturesVolume: '0',
        }
      }
    })
    
    // Tüm saatlik hacim verilerini bekle (paralel çalışıyor)
    const hourlyVolumes = await Promise.all(hourlyVolumePromises)
    
    // Coin verileriyle birleştir
    const coinsWithHourlyVolume = topCoins.map((ticker) => {
      const hourlyData = hourlyVolumes.find((v) => v.symbol === ticker.symbol)
      return {
        ...ticker,
        hourlySpotVolume: hourlyData?.hourlySpotVolume || '0',
        hourlySpotBuyVolume: hourlyData?.hourlySpotBuyVolume || '0',
        hourlySpotSellVolume: hourlyData?.hourlySpotSellVolume || '0',
        hourlyFuturesVolume: hourlyData?.hourlyFuturesVolume || '0',
        hourlyFuturesBuyVolume: hourlyData?.hourlyFuturesBuyVolume || '0',
        hourlyFuturesSellVolume: hourlyData?.hourlyFuturesSellVolume || '0',
      }
    })
    
    // Geri kalan coinler için saatlik hacim 0 olarak ekle
    const remainingCoins = tickers.slice(100).map((ticker) => ({
      ...ticker,
      hourlySpotVolume: '0',
      hourlySpotBuyVolume: '0',
      hourlySpotSellVolume: '0',
      hourlyFuturesVolume: '0',
      hourlyFuturesBuyVolume: '0',
      hourlyFuturesSellVolume: '0',
    }))
    
    return NextResponse.json({
      coins: [...coinsWithHourlyVolume, ...remainingCoins],
    })
  } catch (error) {
    console.error('Hourly volume API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


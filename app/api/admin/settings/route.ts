import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    // Get or create settings (singleton pattern)
    let settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    })

    if (!settings) {
      // Create default settings if they don't exist
      settings = await prisma.settings.create({
        data: {
          id: 'singleton',
          spotVolumeThreshold: 400000,
          futuresVolumeThreshold: 600000,
        },
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Admin settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const { spotVolumeThreshold, futuresVolumeThreshold } = body

    // Validate inputs
    if (spotVolumeThreshold !== undefined && (typeof spotVolumeThreshold !== 'number' || spotVolumeThreshold < 0)) {
      return NextResponse.json(
        { error: 'Spot volume threshold must be a positive number' },
        { status: 400 }
      )
    }

    if (futuresVolumeThreshold !== undefined && (typeof futuresVolumeThreshold !== 'number' || futuresVolumeThreshold < 0)) {
      return NextResponse.json(
        { error: 'Futures volume threshold must be a positive number' },
        { status: 400 }
      )
    }

    // Update or create settings
    const settings = await prisma.settings.upsert({
      where: { id: 'singleton' },
      update: {
        ...(spotVolumeThreshold !== undefined && { spotVolumeThreshold }),
        ...(futuresVolumeThreshold !== undefined && { futuresVolumeThreshold }),
      },
      create: {
        id: 'singleton',
        spotVolumeThreshold: spotVolumeThreshold ?? 400000,
        futuresVolumeThreshold: futuresVolumeThreshold ?? 600000,
      },
    })

    // Trigger worker to refresh settings (with timeout to ensure logs are written)
    const workerUrl = process.env.WORKER_URL || 'https://oruba-coin-worker.fly.dev';
    const workerApiToken = process.env.WORKER_API_TOKEN;
    const pushTriggerToken = process.env.ALERT_TRIGGER_TOKEN;
    
    console.log('🔔 Triggering worker settings refresh', { 
      workerUrl, 
      hasToken: !!workerApiToken,
      newSpotThreshold: spotVolumeThreshold,
      newFuturesThreshold: futuresVolumeThreshold,
    });
    
    // Trigger worker refresh - wait for it to complete (with timeout)
    if (workerApiToken && workerUrl) {
      const fullUrl = `${workerUrl}/refresh-settings`;
      console.log('📤 Sending fetch request to worker...', { fullUrl });
      
      const fetchStartTime = Date.now();
      
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Worker refresh timeout after 2s, continuing anyway...');
        controller.abort();
      }, 2000);
      
      try {
        // Wait for fetch to complete (with timeout)
        const response = await Promise.race([
          fetch(fullUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${workerApiToken}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 2000)
          ),
        ]) as Response;
        
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;
        console.log('📡 Worker response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          duration: `${fetchDuration}ms`,
          url: fullUrl,
        });
        
        if (response.ok) {
          const result = await response.json().catch(() => ({}));
          console.log('✅ Worker settings refresh triggered successfully', result);
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn('⚠️ Worker settings refresh returned non-OK status', { 
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            url: fullUrl,
          });
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;
        if (error.message === 'Timeout' || error.name === 'AbortError') {
          console.log('⏰ Worker refresh request sent (timeout, but request may have reached worker)');
        } else {
          console.error('❌ Failed to trigger worker settings refresh:', {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error.code,
            duration: `${fetchDuration}ms`,
            url: fullUrl,
          });
        }
      }
    } else {
      if (!workerApiToken) {
        console.warn('⚠️ WORKER_API_TOKEN not configured, worker settings refresh skipped');
      }
      if (!workerUrl) {
        console.warn('⚠️ WORKER_URL not configured, worker settings refresh skipped');
      }
    }

    // Send push notification to all users about the update
    if (pushTriggerToken) {
      const baseUrl = process.env.VERCEL_BASE_URL || 'https://orubacoin.com';
      
      fetch(`${baseUrl}/api/push/admin-settings-update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pushTriggerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spotThreshold: settings.spotVolumeThreshold,
          futuresThreshold: settings.futuresVolumeThreshold,
        }),
      })
        .then(async (response) => {
          if (response.ok) {
            const result = await response.json().catch(() => ({}));
            console.log('✅ Settings update notification sent successfully', {
              sentTo: result.successful || 0,
              total: result.total || 0,
            });
          } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.warn('⚠️ Settings update notification failed', { 
              status: response.status,
              error: errorText,
            });
          }
        })
        .catch((error) => {
          console.error('❌ Failed to send settings update notification:', error.message);
        });
    } else {
      console.warn('⚠️ ALERT_TRIGGER_TOKEN not configured, settings update notification skipped');
    }

    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.error('Admin settings PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Supabase Edge Function: Gumroad Webhook Handler
// Receives purchase notifications from Gumroad and saves valid licenses

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GumroadWebhookPayload {
  seller_id: string
  product_id: string
  product_name: string
  permalink: string
  product_permalink: string
  short_product_id: string
  email: string
  price: string
  gumroad_fee: string
  currency: string
  quantity: string
  discover_fee_charged: string
  can_contact: string
  referrer: string
  card: {
    visual: string | null
    type: string | null
    bin: string | null
    expiry_month: string | null
    expiry_year: string | null
  }
  order_number: string
  sale_id: string
  sale_timestamp: string
  purchaser_id: string
  subscription_id: string | null
  license_key: string
  ip_country: string
  recurrence: string
  is_gift_receiver_purchase: string
  refunded: string
  disputed: string
  dispute_won: string
  chargebacked: string
  // ... other fields from Gumroad
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse webhook payload from Gumroad
    // Gumroad sends data as application/x-www-form-urlencoded, NOT JSON!
    const contentType = req.headers.get('content-type') || ''
    let payload: GumroadWebhookPayload

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse URL-encoded form data
      const formData = await req.text()
      const params = new URLSearchParams(formData)

      // Convert URLSearchParams to object
      payload = {} as GumroadWebhookPayload
      for (const [key, value] of params.entries()) {
        // Handle nested card object
        if (key.startsWith('card[')) {
          if (!payload.card) payload.card = {} as any
          const cardKey = key.match(/card\[(\w+)\]/)?.[1]
          if (cardKey) {
            (payload.card as any)[cardKey] = value || null
          }
        } else {
          (payload as any)[key] = value
        }
      }
    } else {
      // Fallback to JSON parsing (in case Gumroad changes format)
      payload = await req.json()
    }

    console.log('🦆 Received Gumroad webhook:', {
      order_number: payload.order_number,
      product_id: payload.product_id,
      email: payload.email,
      license_key: payload.license_key?.substring(0, 10) + '...',
      content_type: contentType,
    })

    // Validate required fields
    if (!payload.license_key || !payload.order_number || !payload.product_id || !payload.email) {
      console.error('❌ Missing required fields in webhook payload')
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role (bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse price to cents
    const priceCents = Math.round(parseFloat(payload.price) * 100)

    // Prepare license data
    const licenseData = {
      license_key: payload.license_key,
      order_id: payload.order_number,
      product_id: payload.product_id,
      email: payload.email.toLowerCase(),
      price_cents: priceCents,
      currency: payload.currency.toUpperCase(),
      is_valid: true,
      is_refunded: payload.refunded === 'true',
      is_disputed: payload.disputed === 'true',
      is_chargebacked: payload.chargebacked === 'true',
      purchased_at: new Date(payload.sale_timestamp),
      gumroad_data: payload, // Store full payload for reference
    }

    // Insert or update license in database
    const { data, error } = await supabaseClient
      .from('valid_licenses')
      .upsert(licenseData, {
        onConflict: 'license_key',
        ignoreDuplicates: false,
      })
      .select()

    if (error) {
      console.error('❌ Supabase error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ License saved successfully:', {
      license_key: payload.license_key.substring(0, 10) + '...',
      email: payload.email,
      is_refunded: licenseData.is_refunded,
      is_disputed: licenseData.is_disputed,
    })

    // Send success response to Gumroad
    return new Response(
      JSON.stringify({
        success: true,
        message: 'License processed successfully',
        license_key: payload.license_key.substring(0, 10) + '...',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// Supabase Edge Function: send-sms
// Sends a booking confirmation SMS via Twilio.
// Twilio credentials are read from function secrets (never hard-coded):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//
// Deploy:   supabase functions deploy send-sms --project-ref lvajupbineiwdgdtnkpq
// Secrets:  supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1... --project-ref lvajupbineiwdgdtnkpq

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { phone, pnr, from, to, depart, seats, fare, boarding } = await req.json()

    const SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const FROM = Deno.env.get('TWILIO_FROM_NUMBER')

    if (!SID || !TOKEN || !FROM) {
      return new Response(
        JSON.stringify({ error: 'Twilio secrets not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const when = new Date(depart).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })

    const body =
      `NightLine booking confirmed!\n` +
      `PNR: ${pnr}\n` +
      `${from} to ${to}\n` +
      `Departs: ${when}\n` +
      (boarding ? `Board: ${boarding}\n` : '') +
      `Seats: ${seats}\n` +
      `Paid: Rs.${fare}\n` +
      `Safe travels!`

    const params = new URLSearchParams({ To: phone, From: FROM, Body: body })

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${SID}:${TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )

    const data = await resp.json()
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data.message || 'Twilio error' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, sid: data.sid }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})

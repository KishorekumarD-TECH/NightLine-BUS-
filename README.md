# NightLine — Bus Ticket Booking (Prototype)

A working RedBus-style booking app: search → seat map → passenger details → booking → SMS confirmation. Built on React + Vite + Tailwind + Supabase, with Twilio SMS via a Supabase Edge Function.

Your Supabase project is already created and seeded (project ref: `lvajupbineiwdgdtnkpq`, region: Mumbai). Tables, RLS policies, the double-booking trigger, and demo data (4 operators, 4 buses, 3 routes) are all live.

---

## 1. Run locally

```bash
npm install
cp .env.example .env      # values are already filled in for your project
npm run dev
```

Open the printed localhost URL. Sign up with any email + password, then search Chennai → Bengaluru.

> The anon/publishable key in `.env.example` is safe to expose in the browser — that's what it's designed for. Row Level Security protects the data, so users can only read/write their own bookings.

---

## 2. Turn on SMS (Twilio)

SMS is sent by the `send-sms` Edge Function so your Twilio secret token never touches the browser. You add your own credentials — I never see them.

**a. Get Twilio credentials** from the [Twilio Console](https://console.twilio.com): Account SID, Auth Token, and a Twilio phone number (a trial number works; trial mode can only text *verified* numbers).

**b. Install the Supabase CLI and log in:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref lvajupbineiwdgdtnkpq
```

**c. Set your Twilio secrets** (these live server-side only):
```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx \
  TWILIO_AUTH_TOKEN=your_auth_token \
  TWILIO_FROM_NUMBER=+1xxxxxxxxxx \
  --project-ref lvajupbineiwdgdtnkpq
```

**d. Deploy the function:**
```bash
supabase functions deploy send-sms --project-ref lvajupbineiwdgdtnkpq
```

That's it — bookings will now send a real SMS. If Twilio isn't set up yet, bookings still succeed and the app just shows "SMS could not be sent."

---

## 3. Deploy the site (Vercel)

Push this folder to GitHub, then import it in Vercel (or use the Vercel CLI). Set these two env vars in the Vercel project settings:

```
VITE_SUPABASE_URL   = https://lvajupbineiwdgdtnkpq.supabase.co
VITE_SUPABASE_ANON_KEY = sb_publishable_WOeZ8NYm-uMjmDoQc9Y1qQ_k7qbNofe
```

Build command `npm run build`, output dir `dist`. Done.

---

## What's inside

| Part | Tech |
|---|---|
| UI | React 18 + Vite + Tailwind |
| Auth | Supabase Auth (email + password) |
| Data | Supabase Postgres + Row Level Security |
| Double-booking guard | Postgres trigger `prevent_double_booking` |
| SMS | Twilio via Supabase Edge Function |

## Notes / next steps
- Payment is simulated ("Pay & confirm") — swap in Razorpay when you're ready.
- Email confirmation can be added the same way as SMS (a second edge function).
- To add more buses/routes, insert rows in the Supabase dashboard; the UI picks them up automatically.

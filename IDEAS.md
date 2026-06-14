# Feature Ideas & Backlog

## Priority Order (Recommended)

### 1. "Coffee for my mood/method" Quiz
**Impact:** High — Onboarding hook  
**Effort:** Medium  

A 3-4 step guided flow:
- "What's your brew method?" (filter, French press, espresso, pour-over, South Indian filter)
- "Sweet or punchy?"
- "Budget?"
- → Here are your 3 best matches

**Why:** Most Indian coffee buyers don't know what "washed Arabica with citrus notes" means. This translates jargon into vibes and makes the app instantly useful for newcomers.

---

### 2. Roaster Map of India
**Impact:** High — Storytelling differentiator  
**Effort:** Medium-High  

Interactive map showing where each roaster sources from — Coorg, Chikmagalur, Araku, Wayanad, Nilgiris, Shevaroy Hills. Clicking a region shows the roasters and what makes that terroir unique.

**Why:** People don't realize Indian coffee spans wildly different geographies and microclimates. This is the "awareness" mission made visual.

---

### 3. Flavour Comparison Tool
**Impact:** High — Drives engagement  
**Effort:** Medium  

Pick 2-3 coffees side by side — compare origin, process, roast level, tasting notes on a radar/spider chart. Highlights *why* one costs ₹800 vs ₹400.

---

### 4. "I liked X, what's similar but different?"
**Impact:** High — Supports smaller roasters  
**Effort:** Medium  

Content-based recommendation using flavour profile similarity. If someone loves Blue Tokai's Attikan Estate, surface similar profiles from lesser-known roasters they haven't tried.

---

### 5. Brew Guide per Coffee
**Impact:** Medium — Practical & opinionated  
**Effort:** Low-Medium  

Each product card suggests ideal brew methods: "This natural process Robusta? Best as South Indian filter or French press. Skip pour-over — you'll lose the body."

---

### 6. Price-per-cup Calculator
**Impact:** Medium — Changes purchase psychology  
**Effort:** Low  

People see ₹600 for 250g and think "expensive." Show them it's ₹25/cup vs ₹150 at a café.

---

### 7. Weekly Pick — WhatsApp Message
**Impact:** High — Retention & community building  
**Effort:** Medium  

A weekly curated coffee recommendation sent directly to users' WhatsApp. Think of it as a "coffee newsletter but where people actually read it."

**How it works:**
- Users opt-in with their WhatsApp number on the site
- Every week (e.g. Monday morning), they get a message like:

> ☕ **This week's pick: Attikan Estate by Blue Tokai**
> 🌍 Origin: Chikmagalur, Karnataka
> 🍫 Notes: Dark chocolate, orange peel, brown sugar
> 🔥 Roast: Medium-Dark
> ☕ Best brewed as: French Press or South Indian Filter
> 💰 ₹550/250g (~₹23/cup)
>
> *Why we picked it:* Perfect monsoon comfort coffee — full body, low acidity, pairs beautifully with an evening snack.
>
> 👉 [Check it out →] link

**Implementation options:**
| Provider | Free tier | Notes |
|----------|-----------|-------|
| WhatsApp Business API (via Meta) | First 1000 conversations/month free | Official, reliable, needs business verification |
| Twilio WhatsApp | ₹~0.35/message | Easy API, good docs, fast setup |
| Gupshup | Pay-per-message | Indian company, good local support |
| Wati.io | ₹2000/mo base | Dashboard + API, template management built-in |

**Recommendation:** Start with **Twilio** for dev/early users (simple API, no upfront cost), migrate to **WhatsApp Business API directly** or **Gupshup** when you scale past a few hundred users.

**Backend needs:**
- Phone number collection + opt-in/opt-out (store in SQLite, a `subscribers` table)
- Cron job on the DigitalOcean server (runs weekly, picks coffee, sends batch via API)
- Message template pre-approved by WhatsApp (required for business-initiated messages)
- Unsubscribe flow (reply "STOP" → auto opt-out)

**Design decisions to make later:**
- Personalized picks (based on user taste profile) vs. single editorial pick for everyone?
- Day & time of the week to send?
- Include a "rate this pick" reply flow to build taste data?

---

## Quick Wins (Low Effort, High Charm)

| Idea | Notes |
|------|-------|
| "Today's Pick" | Daily rotating recommendation — reuse randomizer logic, seed by date |
| Seasonal Highlights | "Monsoon Malabar is peaking right now" — editorial content layer |
| Glossary Tooltips | Hover over "washed process" or "SHG" → one-liner explanation |

---

## Parking Lot (Cool but later)

- User accounts & taste profiles
- Roaster reviews / community ratings
- Subscription box builder ("surprise me every month based on my profile")
- "Coffee journey" — track what you've tried, build your palate over time

---

*Move items up or mark as ✅ when picked up for implementation.*

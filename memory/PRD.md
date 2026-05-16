# Product Requirements Document — BaZi & I Ching Mobile App

## Vision
A premium, mystical Expo mobile app that turns a user's birth details into a reflective BaZi & I Ching reading powered by Claude Sonnet 4.5. Dark obsidian + emerald/jade aesthetic, calm and elegant.

## MVP scope (this iteration)
- **Landing page** — hero with `Get Your Reading` CTA.
- **Auth** — email/password (JWT) + Emergent-managed Google OAuth.
- **Birth Input form** — name, year/month/day/hour/minute, birthplace, optional gender.
- **Reading generation** — backend calls Claude Sonnet 4.5 via Emergent LLM key with the BaZi/I Ching prompt; response parsed into 11 sections.
- **Reading Result page** — section cards with icons + jade/gold visuals + disclaimer.
- **Dashboard** — current user, saved people, past readings, subscription status, logout.
- **Stripe paywall** — Free = 1 person/1 reading; Premium ($9.99) unlocks more. Uses Emergent Stripe proxy (`sk_test_emergent`).
- **Disclaimer footer** — on every major screen.

## Future / not in MVP
- Compatibility readings between 2 saved people (premium).
- Edit/delete saved people from dashboard UI.
- Account settings screen.
- Recurring subscription (currently one-time via Emergent payments proxy; flagged to revisit when proxy supports `mode='subscription'`).

## Tech stack
- Frontend: Expo SDK 54, expo-router, React Native, expo-secure-store, expo-web-browser, expo-linear-gradient.
- Backend: FastAPI + Motor + MongoDB.
- Auth: bcrypt + PyJWT; Emergent Google OAuth via `demobackend.emergentagent.com`.
- LLM: `emergentintegrations.llm.chat` → `anthropic / claude-sonnet-4-5-20250929`.
- Payments: `emergentintegrations.payments.stripe.checkout.StripeCheckout` (one-time).

## Data model (MongoDB)
- `users` — user_id, email, name, picture, password_hash, is_premium, free_reading_used, auth_provider.
- `user_sessions` — session_token, user_id, expires_at (TTL).
- `birth_profiles` — profile_id, user_id, name, birth_year/month/day/hour/minute, birthplace, gender.
- `readings` — reading_id, user_id, birth_profile_id, reading_type, generated_text, profile_snapshot.
- `payment_sessions` — checkout_session_id, user_id, status, amount.

## Business smart-add
Free→Premium upgrade gated at the moment of **highest perceived value** (right after the first reading completes), not buried in settings — improves conversion vs generic pricing pages.

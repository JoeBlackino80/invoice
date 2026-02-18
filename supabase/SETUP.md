# Nastavenie Supabase databázy

## 1. Vytvorenie Supabase projektu

1. Choďte na [supabase.com](https://supabase.com) a vytvorte nový projekt
2. Počkajte kým sa projekt vytvorí

## 2. Nastavenie API kľúčov

1. V Supabase dashboard choďte do **Settings > API**
2. Skopírujte:
   - **Project URL** (napr. `https://xxxxx.supabase.co`)
   - **anon public key** (dlhý JWT reťazec začínajúci `eyJ...`)
   - **service_role secret key** (dlhý JWT reťazec začínajúci `eyJ...`)
3. Aktualizujte súbor `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://VÁŠE-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...váš-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...váš-service-role-key...
```

## 3. Spustenie databázových migrácií

V Supabase dashboard choďte do **SQL Editor** a spustite migračné skripty v tomto poradí:

1. `supabase/migrations/00001_create_enums.sql`
2. `supabase/migrations/00002_create_core_tables.sql`
3. `supabase/migrations/00003_create_contacts_tables.sql`
4. `supabase/migrations/00004_create_invoicing_tables.sql`
5. `supabase/migrations/00005_create_accounting_tables.sql`
6. `supabase/migrations/00006_create_bank_tables.sql`
7. `supabase/migrations/00007_create_asset_stock_tax_tables.sql`
8. `supabase/migrations/00008_create_functions_triggers.sql`
9. `supabase/migrations/00009_create_rls_policies.sql`
10. `supabase/migrations/00010_seed_data.sql`
11. `supabase/migrations/00011_fix_audit_trigger.sql`
12. `supabase/migrations/00012_create_missing_tables.sql`

Alebo spustite `supabase/complete_setup.sql` - obsahuje všetko v jednom.

## 4. Nastavenie autentifikácie

1. V Supabase dashboard choďte do **Authentication > Providers**
2. Zapnite **Email** provider
3. Voliteľne: zapnite **Google**, **GitHub** atď.

## 5. Vytvorenie Storage bucketu

1. V Supabase dashboard choďte do **Storage**
2. Vytvorte bucket `company-logos` (public)
3. Vytvorte bucket `documents` (private)

## 6. Spustenie aplikácie

```bash
cd /Users/macbook/Downloads/INVOICE
npm run dev
```

Aplikácia bude dostupná na `http://localhost:3000`

## 7. Prvé prihlásenie

1. Zaregistrujte sa cez formulár
2. Po prihlásení vytvorte firmu
3. Začnite fakturovať!

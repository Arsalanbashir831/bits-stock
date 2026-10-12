# Bits Stock

Daily stock sheet manager built with Next.js, Prisma ORM, and PostgreSQL.

## Requirements

- Node.js 20.9 or newer
- npm or pnpm
- A PostgreSQL database (the Vercel Marketplace Prisma Postgres or Neon integration works)

## Setup

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run db:seed
npm run dev
```

Set `DATABASE_URL` in `.env` to your PostgreSQL connection string before running the database commands. The app also recognizes `BITSSTOCK_PRISMA_DATABASE_URL`, `BITSSTOCK_DATABASE_URL`, and `BITSSTOCK_POSTGRES_URL`. Set `DIRECT_URL` to the provider's direct connection string when available so Prisma migrations can use it. Prisma Client is generated into `lib/generated/prisma` during install. The starter catalog follows the item names in the provided BITS stock report. Check the database connection at [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Vercel deployment

1. In the Vercel project, open **Storage** or **Marketplace** and add Prisma Postgres or Neon. Connect it to this project and allow the integration to add its database environment variables.
2. In **Project Settings → Build and Deployment**, confirm the framework is Next.js and the root directory points to the directory containing this `package.json` and `next.config.ts`. Leave the build command on the default setting so Vercel runs `npm run build` (or the package manager equivalent).
3. Redeploy. The build script applies committed Prisma migrations and then builds the app. Confirm the database variables are available to the deployment environment before it runs.
4. Run `npm run db:seed` once with the production `DATABASE_URL` if you want the starter catalog in production. For local development, pull the Vercel development variables with `npx vercel env pull .env` (or copy the development database connection string into `.env`), then run the setup commands above.

The existing SQLite migration history is retained in `prisma/migrations-sqlite` for reference. It is not applied to PostgreSQL. Records are not copied automatically; use the import steps below to migrate an existing local SQLite database, or run `npm run db:seed` to start with only the sample catalog.

To import an existing local SQLite database instead of starting with the sample catalog, link this folder to the Vercel project, pull the production variables, apply the PostgreSQL schema, and import the rows:

```bash
npx vercel link
npx vercel env pull .env.production.local --environment=production
DOTENV_CONFIG_PATH=.env.production.local npm run db:deploy
DOTENV_CONFIG_PATH=.env.production.local npm run db:import-sqlite
```

The import preserves IDs and timestamps and is transactional. It stops without writing if any application table in PostgreSQL already contains records. Do not run the catalog seed before importing; the SQLite database already includes its catalog rows.

The home page lists saved daily reports and offers a one-per-day “Create today’s report” action. A new sheet copies each product’s previous closing quantity into its opening quantity; a first sheet starts at zero. The date is stored against the `Asia/Karachi` business day. Add items from the Catalog card; an item added after today’s sheet is created is appended to today’s snapshot.

## Database model

- Products hold SKU, cost, sale price, and low-stock threshold. Prices are integer paisa to avoid floating-point rounding.
- Stock receipts and sales record item quantities. Their inventory effects are represented in the stock movement ledger.
- Stock movements use signed quantity changes: receipts and customer returns add stock; sales and replacement units remove stock. Current stock is the sum of a product's movements.
- Sale items retain the sold price and warranty duration so later product price changes do not rewrite sales history.
- Warranty claims are linked to sale items and keep a status, issue, resolution, and dates.
- Stock sheets store a dated row per product, including the displayed name and section, so later catalog edits do not rewrite the report history.

## Daily stock workflow

Create one report for each business day. Each report starts from the previous report's closing stock, pending-warranty balance, and faulty-for-lab balance. Reports retain a dated snapshot for history.

- Purchases increase closing stock. Invoice quantities and Warranty OUT replacement units reduce it.
- Warranty IN entries count as one unit each. A `100% OK` drive increases stock in hand. `Add to Faulty For Lab` increases the separate faulty-for-lab balance. Each Warranty IN claim enters Pending Warranty unless it is replaced on the same day.
- Warranty OUT selects an open pending claim by its claim RMA number and resolves it. Its RMA slip is recorded separately.
- Lab Dead quantities reduce Faulty For Lab. The form prevents entering more units than are currently in that balance.
- Pending Warranty remains independent from Faulty For Lab. Bill Back Check removes a claim from Pending Warranty only, and Today Bill Back is calculated from the amounts checked for that day.
- Closing Qty In Hand, Pending Warranty, Faulty For Lab, and the opening balances on later reports recalculate from the daily entries. Warranty IN amounts are stored in paisa to keep totals precise.

The downloadable PDF is a two-page A4 portrait report. Page one contains the stock sheet; page two contains the daily invoice, warranty, and pending-warranty registers, including Drive Status and Bill Back Check.

When adding write operations, create the source record and its stock movements in the same Prisma transaction. Avoid editing or deleting historical movements; use a correcting movement instead.

## Database commands

```bash
npm run db:migrate -- --name describe_change  # create and apply a development migration
npm run db:deploy                             # apply committed migrations in production
npm run db:generate                           # regenerate Prisma Client
npm run db:studio                             # open Prisma Studio
```

The app uses PostgreSQL in development and production so its data persists across Vercel serverless instances. Keep separate development and production database environments in Vercel to avoid preview deployments writing to production data.

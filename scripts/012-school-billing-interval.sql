-- School subscriptions can now be bought monthly as well as yearly, so the
-- interval has to be stored rather than assumed.
--
-- Nullable with no default and no backfill, deliberately. The column records
-- what Stripe says a subscription actually renews on, and the next sync for
-- each school fills it in from Stripe's own copy. Stamping every existing row
-- 'year' up front would be this migration asserting a billing fact it has not
-- read, and those rows are the ones we are least willing to be wrong about.
ALTER TABLE school_subscription
  ADD COLUMN IF NOT EXISTS "interval" text;

COMMENT ON COLUMN school_subscription."interval" IS
  'month | year, as reported by Stripe. Null until the next sync reads it.';

-- Bring stored seat allowances onto the new tier allowances.
--
-- lib/billing-sync.ts already rewrites these columns from the catalogue on
-- every sync, so each school would land here anyway the next time Stripe sent
-- an event about it — meaning the only thing not running this buys is a period
-- where two schools on the same tier have different allowances depending on
-- when their last webhook happened to fire. Doing it once, here, is the
-- predictable version of something that is going to happen regardless.
--
-- Seats only. No price, subscription or status is touched, and nobody is
-- re-rated: existing subscriptions keep billing exactly what Stripe already
-- holds for them. Enforcement reads the catalogue rather than these columns, so
-- a school sitting above a reduced allowance keeps every member it has and is
-- simply unable to add more.
UPDATE school_subscription SET "teacherSeatLimit" = 4,  "studentSeatLimit" = 700  WHERE tier = 'school_small';
UPDATE school_subscription SET "teacherSeatLimit" = 8,  "studentSeatLimit" = 1100 WHERE tier = 'school_medium';
UPDATE school_subscription SET "teacherSeatLimit" = 50, "studentSeatLimit" = 3000 WHERE tier = 'school_large';

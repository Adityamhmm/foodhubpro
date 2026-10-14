# FoodHub Demonstration Guide

## Before the demonstration

1. In Workbench, create or upgrade `foodhub_db` using the instructions in the README. Check the migration preflight results before adding foreign keys.
2. Configure `DB_USERNAME`, `DB_PASSWORD`, `ADMIN_USERNAME`, and a unique `ADMIN_PASSWORD` (at least 12 characters) in the backend PowerShell terminal.
3. Start Spring Boot with `mvn spring-boot:run`. Confirm `/api/health` and `/api/auth/me` behave as expected.
4. In a second terminal, set `NEXT_PUBLIC_API_URL=http://localhost:8080/api`, run `npm.cmd ci`, then `npm.cmd run dev` from `frontend/`.
5. Sign in to `/login`. Add active table numbers, menu categories/items, and any tax rules in Admin. Create a separate kitchen account under Team.
6. Open the customer ordering route with one configured table, and open `/kitchen` in a separate browser window.

## Live flow

1. Guest selects a menu category, inspects an item, adds it, enters a note, and places the order.
2. Show the saved row and line snapshot in Workbench:

   ```sql
   SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM order_items ORDER BY id DESC LIMIT 10;
   ```

3. Show the new order arriving in the kitchen board. Accept it and confirm the customer table view receives the status update.
4. Complete the order and verify the status/timestamp in MySQL.
5. From Admin → Billing, create a bill for the table. Show its itemized snapshots and tax line.
6. Record the payment method. Verify `paid_at`, `payment_method`, and the admin revenue metrics.
7. Send a waiter request and a customer message. Clear the request in the kitchen/admin view.
8. Sign in as a kitchen account and attempt an admin-only endpoint. Record the authorization result for the project report.
9. Resize the customer and staff screens to phone, tablet, and desktop dimensions; check navigation, dialog controls, tables, and order actions.

## Workbench verification queries

```sql
USE foodhub_db;
SHOW TABLES;

SELECT id, table_number, status, total, created_at
FROM orders ORDER BY created_at DESC LIMIT 10;

SELECT b.id, b.table_number, b.subtotal, b.tax_total, b.grand_total,
       b.payment_method, b.paid_at
FROM bills b ORDER BY b.created_at DESC LIMIT 10;

SELECT bill_id, name, percent, amount
FROM bill_tax_lines ORDER BY id DESC LIMIT 10;

CALL sp_daily_revenue(CURRENT_DATE - INTERVAL 6 DAY, CURRENT_DATE);
```

## Evidence to capture

- Workbench schema and foreign-key view.
- Customer menu, item details, cart, and confirmation.
- Kitchen pending/accepted/completed states.
- Itemized bill, tax lines, and recorded payment.
- Admin metrics populated by the same records.
- Role denial from a kitchen account on an admin-only route.
- Phone/tablet/desktop views.

Use actual records from the demonstration. Do not seed or describe invented sales as real evidence.

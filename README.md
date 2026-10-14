# FoodHub

FoodHub is a restaurant ordering and operations system built with Next.js, Spring Boot, and MySQL. It has a customer ordering flow, a live kitchen board, and an admin workspace for the menu, tables, bills, staff access, and restaurant settings.

## Technology

- Java 21, Spring Boot 3.5, Maven, Spring Security, JdbcTemplate, and Hibernate schema validation
- Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Lucide icons
- MySQL 8 database `foodhub_db`

The frontend is a new implementation because no Next.js source was present in this workspace. It does not include Firebase SDKs or Firebase credentials.

## Database setup in MySQL Workbench

### New database

1. Open MySQL Workbench and connect to your local MySQL 8 server.
2. Open `database/schema.sql` and run the script with the lightning-bolt button. It creates `foodhub_db` and its tables. It contains no `DROP TABLE` or data-deletion statements.
3. Open `database/objects.sql` and run it. It creates the stored function, stored procedure, and order-item triggers used for the DBMS demonstration.
4. Confirm the schema with:

```sql
USE foodhub_db;
SHOW TABLES;
SELECT VERSION();
```

For a fresh database, `schema.sql` creates the complete current schema. Do not run the V2/V3 migrations on it.

`database/demo_data.sql` is an optional insert-only menu/table/tax sample for a disposable demonstration database. It does not create demo orders or revenue. Skip it if you want to begin with empty catalog tables.

### Existing FoodHub database

Back up `foodhub_db` in Workbench before changing it. For the original starter schema, run these scripts once and in order:

1. `database/migrations/V2__normalize_catalog_and_register_tables.sql`
2. Review every preflight result at the end of V2. Continue only if all `rows_found` values are `0`. If any are nonzero, keep the affected rows and resolve their relationships after reviewing the backup; do not delete rows to make the checks pass.
3. `database/migrations/V3__add_referential_constraints.sql`
4. `database/objects.sql`

The migrations add normalized catalog links, a table registry, settings, and staff accounts. They preserve existing tables and historical order/bill snapshots. V2 and V3 are one-time migrations; do not run them again after they succeed. They target the original starter schema, not an arbitrary older schema.

If the existing database already has a different structure, compare it to `database/schema.sql` and make a backup before adapting the migration. Do not execute the fresh schema script over an existing database as a substitute for a migration.

## Environment variables

Set database and first-admin credentials in the same PowerShell session used to start Spring Boot. The Java configuration contains no database password or staff password.

```powershell
$env:DB_USERNAME = 'foodhub_app'
$env:DB_PASSWORD = 'your-local-mysql-password'
$env:ADMIN_USERNAME = 'admin'
$env:ADMIN_PASSWORD = 'choose-a-unique-password-of-at-least-12-characters'
$env:FRONTEND_ORIGIN = 'http://localhost:3000'
mvn spring-boot:run
```

The default JDBC URL points to `jdbc:mysql://localhost:3306/foodhub_db`; override it with `DB_URL` if needed. The first backend start stores the administrator password as a BCrypt hash in `staff_users`. Add kitchen users from Admin → Team. MySQL Workbench should execute the SQL scripts using an account with DDL permissions; the runtime application account only needs the table permissions required by the app.

## Start the frontend

In another PowerShell terminal:

```powershell
cd frontend
npm.cmd ci
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8080/api'
npm.cmd run dev
```

Open:

- Customer ordering: `http://localhost:3000/?table=1` (replace `1` with an active table)
- Staff sign-in: `http://localhost:3000/login`
- Kitchen board: `http://localhost:3000/kitchen`
- Admin workspace: `http://localhost:3000/admin`

Create active tables in Admin → Tables before guests place orders. Customer order prices and bill tax are calculated by the backend from MySQL records. “Record payment” records a staff-entered payment method and timestamp; it does not charge a card or contact a payment provider.

## API outline

Public customer routes:

- `GET /api/menu-items`, `/api/menu-categories`, `/api/menu-tags`, `/api/tax-rules`
- `GET /api/tables/{table}`, `/api/tables/{table}/orders`
- `POST /api/orders`, `/api/requests`, `/api/customer-messages`
- `POST /api/table-sessions/{table}` and `GET /api/events?table={table}`

Staff authentication uses a Spring Security session cookie and CSRF token. Staff routes include `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`. Kitchen users can view orders and requests, update order status, and clear requests. Admin users can manage menu data, tables, staff, bills, tax rules, analytics, and settings.

The server-sent event stream filters customer subscriptions by table and lets authenticated staff subscribe to restaurant-wide updates. Browsers reconnect automatically; each view also fetches current records after connecting.

## Verification performed

- `mvn clean test` — passed; two tax-rounding unit tests passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run build` — passed; Next.js generated the customer, kitchen, admin, and login routes.
- Database migration scripts were not run, and the Java server/API were not started. Database connectivity, Hibernate validation against a real MySQL instance, CORS/session behavior, SQL routines/triggers, and browser-based responsive checks still require local MySQL credentials and a configured database.

See `docs/DBMS_REPORT.md`, `docs/DEMO_GUIDE.md`, and `docs/CONTRIBUTION_TEMPLATE.md` for the project report draft, demo plan, relational design, and rubric coverage.

# FoodHub Viva Questions and Answers

### 1. Why use a relational database for restaurant orders?

Orders, line items, tables, bills, taxes, and staff have stable relationships and constraints. MySQL can preserve those links and commit multi-row transactions together.

### 2. What is a primary key?

A primary key identifies each row uniquely and cannot be null. FoodHub uses IDs for most relations and `table_number` for the restaurant table/session relations.

### 3. What is a foreign key?

A foreign key requires a referenced parent row to exist. For example, `orders.table_number` references a registered row in `restaurant_tables`.

### 4. Why is `menu_item_tags` a separate table?

An item can have many tags and one tag can describe many items. The junction table represents that many-to-many relationship without storing a repeated list in relational columns.

### 5. What is a functional dependency?

It states that one attribute set determines another. In `orders`, the FD is `id → table_number, status, total, created_at, ...` because the order ID identifies those order facts.

### 6. How does 3NF help this design?

Category and tag facts are stored separately from menu items, reducing repeated values and update anomalies. The legacy `category` and JSON `tags` mirrors are documented as transitional denormalization, so the report does not claim the current menu table is fully 3NF.

### 7. Why keep item names and prices in order/bill lines?

Those are historical snapshots. If the live menu price or name changes later, an old order or bill should still show the values that applied at the time.

### 8. How does FoodHub avoid trusting a browser total?

The API accepts menu IDs and quantities, checks availability, reads prices from MySQL, and calculates the total inside a Spring transaction.

### 9. What is the role of a transaction in placing an order?

The order and all its line items either commit together or roll back together. A partially saved order should not be visible.

### 10. What do the stored procedure, function, and triggers demonstrate?

The procedure returns a paid-revenue aggregate for a date range, the function calculates a rounded tax amount, and the triggers validate and recalculate order totals when lines change.

### 11. How are staff passwords protected?

They are encoded with Spring Security’s password encoder before storage. The raw first-admin password is read from an environment variable and is not returned by an API.

### 12. What is the difference between authentication and authorization?

Authentication verifies who signed in. Authorization checks what that role may do; FoodHub distinguishes `ADMIN` and `KITCHEN` on protected routes.

### 13. How are live updates sent?

The backend publishes server-sent events after a database transaction commits. Customer subscriptions are filtered to their table; authenticated staff can subscribe to restaurant-wide events.

### 14. Which parts still need a live database demonstration?

Workbench migration execution, database connectivity, Hibernate validation, SQL routines/triggers, role checks, and the complete customer-to-bill flow must be run against the local MySQL instance before claiming they passed.

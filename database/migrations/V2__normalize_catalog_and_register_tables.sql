-- Apply once to an existing FoodHub database after reviewing the preflight queries below.
-- This migration adds structures and backfills links. It does not drop tables or delete rows.
USE foodhub_db;

CREATE TABLE IF NOT EXISTS restaurant_tables (
    table_number INT PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_restaurant_table_number CHECK (table_number > 0)
);

INSERT IGNORE INTO restaurant_tables (table_number, label, is_active)
SELECT table_number, CONCAT('Table ', table_number), TRUE
FROM (
    SELECT table_number FROM orders
    UNION SELECT table_number FROM requests
    UNION SELECT table_number FROM table_sessions
    UNION SELECT table_number FROM bills
    UNION SELECT table_number FROM customer_messages
) AS existing_tables
WHERE table_number > 0;

INSERT IGNORE INTO menu_categories (id, name, sort_order)
SELECT UUID(), TRIM(category), 0
FROM menu_items
WHERE category IS NOT NULL AND TRIM(category) <> ''
GROUP BY TRIM(category);

INSERT IGNORE INTO menu_categories (id, name, sort_order)
VALUES (UUID(), 'Uncategorized', 999);

SET @foodhub_safe_updates := @@SESSION.sql_safe_updates;
SET SESSION sql_safe_updates = 0;

UPDATE menu_items
SET category = 'Uncategorized'
WHERE category IS NULL OR TRIM(category) = '';

ALTER TABLE menu_items
    ADD COLUMN category_id VARCHAR(36) NULL AFTER category,
    ADD COLUMN image_url VARCHAR(500) NULL AFTER description;

UPDATE menu_items AS item
JOIN menu_categories AS category ON category.name = TRIM(item.category)
SET item.category_id = category.id
WHERE item.category_id IS NULL;

SET SESSION sql_safe_updates = @foodhub_safe_updates;

ALTER TABLE menu_items
    MODIFY COLUMN category_id VARCHAR(36) NOT NULL;

CREATE TABLE IF NOT EXISTS menu_item_tags (
    menu_item_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (menu_item_id, tag_id),
    INDEX idx_menu_item_tags_tag (tag_id)
);

INSERT IGNORE INTO menu_tags (id, name)
SELECT UUID(), TRIM(tag_values.tag_name)
FROM menu_items AS item
JOIN JSON_TABLE(
    CASE WHEN JSON_TYPE(item.tags) = 'ARRAY' THEN item.tags ELSE JSON_ARRAY() END,
    '$[*]' COLUMNS (tag_name VARCHAR(100) PATH '$')
) AS tag_values
WHERE tag_values.tag_name IS NOT NULL AND TRIM(tag_values.tag_name) <> '';

INSERT IGNORE INTO menu_item_tags (menu_item_id, tag_id)
SELECT item.id, tag.id
FROM menu_items AS item
JOIN JSON_TABLE(
    CASE WHEN JSON_TYPE(item.tags) = 'ARRAY' THEN item.tags ELSE JSON_ARRAY() END,
    '$[*]' COLUMNS (tag_name VARCHAR(100) PATH '$')
) AS tag_values
JOIN menu_tags AS tag
    ON tag.name COLLATE utf8mb4_unicode_ci = TRIM(tag_values.tag_name) COLLATE utf8mb4_unicode_ci
WHERE tag_values.tag_name IS NOT NULL AND TRIM(tag_values.tag_name) <> '';

ALTER TABLE tax_rules
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD INDEX idx_tax_rules_active (is_active, name);

ALTER TABLE bill_items
    ADD COLUMN source_order_item_id BIGINT NULL AFTER source_order_id,
    ADD COLUMN category VARCHAR(120) NULL AFTER name,
    ADD COLUMN food_type VARCHAR(30) NULL AFTER category,
    ADD COLUMN chef_note TEXT NULL AFTER quantity;

ALTER TABLE bill_items
    ADD UNIQUE INDEX uk_bill_source_order_item (source_order_item_id);

ALTER TABLE order_items
    MODIFY COLUMN menu_item_id VARCHAR(36) NULL;
ALTER TABLE bill_items
    MODIFY COLUMN menu_item_id VARCHAR(36) NULL;

CREATE TABLE IF NOT EXISTS restaurant_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_users (
    username VARCHAR(80) PRIMARY KEY,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(16) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_staff_users_role (role, enabled),
    CONSTRAINT chk_staff_role CHECK (role IN ('ADMIN','KITCHEN'))
);

-- Review these queries before running V3. Continue only when every count is zero.
-- Preserve and investigate any orphan rows; do not delete them to satisfy a foreign key.
SELECT 'orders without a registered table' AS issue, COUNT(*) AS rows_found
FROM orders o LEFT JOIN restaurant_tables t ON t.table_number = o.table_number
WHERE t.table_number IS NULL;
SELECT 'requests without a registered table' AS issue, COUNT(*) AS rows_found
FROM requests r LEFT JOIN restaurant_tables t ON t.table_number = r.table_number
WHERE t.table_number IS NULL;
SELECT 'table sessions without a registered table' AS issue, COUNT(*) AS rows_found
FROM table_sessions s LEFT JOIN restaurant_tables t ON t.table_number = s.table_number
WHERE t.table_number IS NULL;
SELECT 'bills without a registered table' AS issue, COUNT(*) AS rows_found
FROM bills b LEFT JOIN restaurant_tables t ON t.table_number = b.table_number
WHERE t.table_number IS NULL;
SELECT 'messages without a registered table' AS issue, COUNT(*) AS rows_found
FROM customer_messages m LEFT JOIN restaurant_tables t ON t.table_number = m.table_number
WHERE t.table_number IS NULL;
SELECT 'menu items without categories' AS issue, COUNT(*) AS rows_found
FROM menu_items i LEFT JOIN menu_categories c ON c.id = i.category_id
WHERE c.id IS NULL;
SELECT 'order items with a broken menu link' AS issue, COUNT(*) AS rows_found
FROM order_items i LEFT JOIN menu_items m ON m.id = i.menu_item_id
WHERE i.menu_item_id IS NOT NULL AND m.id IS NULL;
SELECT 'order items without an order' AS issue, COUNT(*) AS rows_found
FROM order_items i LEFT JOIN orders o ON o.id = i.order_id
WHERE o.id IS NULL;
SELECT 'bill items with broken links' AS issue, COUNT(*) AS rows_found
FROM bill_items i
LEFT JOIN bills b ON b.id = i.bill_id
LEFT JOIN orders o ON o.id = i.source_order_id
LEFT JOIN order_items oi ON oi.id = i.source_order_item_id
LEFT JOIN menu_items m ON m.id = i.menu_item_id
WHERE b.id IS NULL
   OR (i.source_order_id IS NOT NULL AND o.id IS NULL)
   OR (i.source_order_item_id IS NOT NULL AND oi.id IS NULL)
   OR (i.menu_item_id IS NOT NULL AND m.id IS NULL);
SELECT 'bill tax lines with broken tax links' AS issue, COUNT(*) AS rows_found
FROM bill_tax_lines i
LEFT JOIN bills b ON b.id = i.bill_id
LEFT JOIN tax_rules t ON t.id = i.tax_rule_id
WHERE b.id IS NULL OR (i.tax_rule_id IS NOT NULL AND t.id IS NULL);

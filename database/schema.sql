CREATE DATABASE IF NOT EXISTS foodhub_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Optional local application account. Replace the password before running.
-- CREATE USER IF NOT EXISTS 'foodhub_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON foodhub_db.* TO 'foodhub_app'@'localhost';

USE foodhub_db;

CREATE TABLE IF NOT EXISTS menu_categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_tags (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
    table_number INT PRIMARY KEY,
    label VARCHAR(80) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_restaurant_table_number CHECK (table_number > 0)
);

CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(120) NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    food_type VARCHAR(30),
    price DECIMAL(12,2) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    tags JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_menu_items_category (category_id),
    CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id) REFERENCES menu_categories(id),
    CONSTRAINT chk_menu_price CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS menu_item_tags (
    menu_item_id VARCHAR(36) NOT NULL,
    tag_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (menu_item_id, tag_id),
    INDEX idx_menu_item_tags_tag (tag_id),
    CONSTRAINT fk_menu_item_tags_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_menu_item_tags_tag FOREIGN KEY (tag_id) REFERENCES menu_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tax_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    percent DECIMAL(6,3) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tax_rules_active (is_active, name),
    CONSTRAINT chk_tax_percent CHECK (percent >= 0 AND percent <= 100)
);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY,
    table_number INT NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    status ENUM('Pending','Accepted','Denied','Completed') NOT NULL DEFAULT 'Pending',
    chef_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    denied_at TIMESTAMP NULL,
    INDEX idx_orders_table_status (table_number, status),
    INDEX idx_orders_created (created_at),
    CONSTRAINT fk_orders_table FOREIGN KEY (table_number) REFERENCES restaurant_tables(table_number),
    CONSTRAINT chk_order_table CHECK (table_number > 0),
    CONSTRAINT chk_order_total CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    menu_item_id VARCHAR(36) NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(120),
    food_type VARCHAR(30),
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    chef_note TEXT,
    INDEX idx_order_items_order (order_id),
    INDEX idx_order_items_menu_item (menu_item_id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_item_price CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS requests (
    id VARCHAR(36) PRIMARY KEY,
    table_number INT NOT NULL,
    type ENUM('Waiter','Bill') NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_requests_table (table_number),
    CONSTRAINT fk_requests_table FOREIGN KEY (table_number) REFERENCES restaurant_tables(table_number)
);

CREATE TABLE IF NOT EXISTS table_sessions (
    table_number INT PRIMARY KEY,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    has_cart BOOLEAN NOT NULL DEFAULT FALSE,
    bill_requested BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen TIMESTAMP NULL,
    reset_at TIMESTAMP NULL,
    CONSTRAINT fk_table_sessions_table FOREIGN KEY (table_number) REFERENCES restaurant_tables(table_number)
);

CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(36) PRIMARY KEY,
    table_number INT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL,
    payment_method ENUM('Cash','Card','UPI') NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL,
    payment_updated_at TIMESTAMP NULL,
    INDEX idx_bills_table (table_number),
    INDEX idx_bills_created (created_at),
    CONSTRAINT fk_bills_table FOREIGN KEY (table_number) REFERENCES restaurant_tables(table_number),
    CONSTRAINT chk_bill_amounts CHECK (subtotal >= 0 AND tax_total >= 0 AND grand_total >= 0)
);

CREATE TABLE IF NOT EXISTS bill_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id VARCHAR(36) NOT NULL,
    source_order_id VARCHAR(36) NULL,
    source_order_item_id BIGINT NULL,
    menu_item_id VARCHAR(36) NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(120),
    food_type VARCHAR(30),
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    chef_note TEXT,
    UNIQUE KEY uk_bill_source_order_item (source_order_item_id),
    INDEX idx_bill_items_source_order (source_order_id),
    CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES bills(id),
    CONSTRAINT fk_bill_items_order FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_bill_items_order_item FOREIGN KEY (source_order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
    CONSTRAINT fk_bill_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL,
    CONSTRAINT chk_bill_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_bill_item_price CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS bill_tax_lines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bill_id VARCHAR(36) NOT NULL,
    tax_rule_id VARCHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    percent DECIMAL(6,3) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_bill_tax_bill FOREIGN KEY (bill_id) REFERENCES bills(id),
    CONSTRAINT fk_bill_tax_rule FOREIGN KEY (tax_rule_id) REFERENCES tax_rules(id) ON DELETE SET NULL,
    CONSTRAINT chk_bill_tax_percent CHECK (percent >= 0 AND percent <= 100),
    CONSTRAINT chk_bill_tax_amount CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS customer_messages (
    id VARCHAR(36) PRIMARY KEY,
    table_number INT NOT NULL,
    type VARCHAR(50),
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_table (table_number),
    CONSTRAINT fk_messages_table FOREIGN KEY (table_number) REFERENCES restaurant_tables(table_number)
);

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

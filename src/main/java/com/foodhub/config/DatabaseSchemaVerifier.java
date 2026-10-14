package com.foodhub.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Component
@Order(1)
public class DatabaseSchemaVerifier implements ApplicationRunner {
    private static final Map<String, Set<String>> REQUIRED_COLUMNS = Map.ofEntries(
        Map.entry("menu_categories", Set.of("id", "name", "sort_order")),
        Map.entry("menu_tags", Set.of("id", "name")),
        Map.entry("restaurant_tables", Set.of("table_number", "label", "is_active")),
        Map.entry("menu_items", Set.of("id", "name", "category", "category_id", "description", "image_url", "food_type", "price", "available")),
        Map.entry("menu_item_tags", Set.of("menu_item_id", "tag_id")),
        Map.entry("tax_rules", Set.of("id", "name", "percent", "is_active")),
        Map.entry("orders", Set.of("id", "table_number", "total", "status", "chef_note", "created_at", "accepted_at", "completed_at", "denied_at")),
        Map.entry("order_items", Set.of("id", "order_id", "menu_item_id", "name", "category", "food_type", "unit_price", "quantity", "chef_note")),
        Map.entry("requests", Set.of("id", "table_number", "type", "message", "created_at")),
        Map.entry("table_sessions", Set.of("table_number", "is_online", "has_cart", "bill_requested", "last_seen")),
        Map.entry("bills", Set.of("id", "table_number", "subtotal", "tax_total", "grand_total", "payment_method", "created_at", "paid_at", "payment_updated_at")),
        Map.entry("bill_items", Set.of("id", "bill_id", "source_order_id", "source_order_item_id", "menu_item_id", "name", "category", "food_type", "unit_price", "quantity", "chef_note")),
        Map.entry("bill_tax_lines", Set.of("id", "bill_id", "tax_rule_id", "name", "percent", "amount")),
        Map.entry("customer_messages", Set.of("id", "table_number", "type", "message", "created_at")),
        Map.entry("restaurant_settings", Set.of("setting_key", "setting_value", "updated_at")),
        Map.entry("staff_users", Set.of("username", "password_hash", "role", "enabled", "created_at"))
    );

    private final JdbcTemplate db;

    public DatabaseSchemaVerifier(JdbcTemplate db) {
        this.db = db;
    }

    @Override
    public void run(ApplicationArguments args) {
        Map<String, Set<String>> actual = new HashMap<>();
        List<Map<String, Object>> columns = db.queryForList("""
            SELECT table_name,column_name
            FROM information_schema.columns
            WHERE table_schema=DATABASE()
            """);
        for (Map<String, Object> column : columns) {
            String table = String.valueOf(column.get("TABLE_NAME")).toLowerCase();
            String name = String.valueOf(column.get("COLUMN_NAME")).toLowerCase();
            actual.computeIfAbsent(table, ignored -> new HashSet<>()).add(name);
        }

        Set<String> missing = new TreeSet<>();
        REQUIRED_COLUMNS.forEach((table, required) -> required.stream()
            .filter(column -> !actual.getOrDefault(table, Set.of()).contains(column))
            .forEach(column -> missing.add(table + "." + column)));
        if (!missing.isEmpty())
            throw new IllegalStateException("FoodHub database schema is incomplete. Missing: " + String.join(", ", missing)
                + ". Run database/schema.sql for a new database, or the V2 and V3 migrations for an existing database.");
    }
}

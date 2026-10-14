package com.foodhub.data;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodhub.api.dto.Requests;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class RestaurantRepository {
    private final JdbcTemplate db;
    private final ObjectMapper json;

    public RestaurantRepository(JdbcTemplate db, ObjectMapper json) {
        this.db = db;
        this.json = json;
    }

    public List<Map<String, Object>> menuItems() {
        List<Map<String, Object>> items = db.queryForList("""
            SELECT i.id, i.name, i.category, i.category_id AS categoryId,
                   i.description, i.image_url AS imageUrl, i.food_type AS foodType,
                   i.price, i.available
            FROM menu_items i
            ORDER BY i.category, i.name
            """);
        for (Map<String, Object> item : items) {
            item.put("tags", db.queryForList("""
                SELECT t.name FROM menu_item_tags link
                JOIN menu_tags t ON t.id = link.tag_id
                WHERE link.menu_item_id = ? ORDER BY t.name
                """, String.class, item.get("id")));
        }
        return items;
    }

    public Map<String, Object> menuItem(String id) {
        return db.queryForMap("SELECT id,name,category,category_id AS categoryId,description,image_url AS imageUrl,food_type AS foodType,price,available FROM menu_items WHERE id=?", id);
    }

    public String saveMenuItem(String id, Requests.MenuItem item) {
        String categoryId = ensureCategory(item.category().trim());
        String tags = toJson(item.tags() == null ? List.of() : item.tags());
        boolean available = item.available() == null || item.available();
        if (id == null) {
            id = UUID.randomUUID().toString();
            db.update("""
                INSERT INTO menu_items(id,name,category,category_id,description,image_url,food_type,price,available,tags)
                VALUES (?,?,?,?,?,?,?,?,?,?)
                """, id, item.name().trim(), item.category().trim(), categoryId,
                item.description(), item.imageUrl(), item.foodType(), item.price(), available, tags);
        } else {
            int count = db.update("""
                UPDATE menu_items SET name=?,category=?,category_id=?,description=?,image_url=?,food_type=?,price=?,available=?,tags=?
                WHERE id=?
                """, item.name().trim(), item.category().trim(), categoryId,
                item.description(), item.imageUrl(), item.foodType(), item.price(), available, tags, id);
            if (count == 0) throw new java.util.NoSuchElementException("Menu item not found");
        }
        syncTags(id, item.tags() == null ? List.of() : item.tags());
        return id;
    }

    public void deleteMenuItem(String id) {
        if (db.update("DELETE FROM menu_items WHERE id=?", id) == 0)
            throw new java.util.NoSuchElementException("Menu item not found");
    }

    private String ensureCategory(String name) {
        List<String> matches = db.query("SELECT id FROM menu_categories WHERE name=?", (rs, row) -> rs.getString(1), name);
        if (!matches.isEmpty()) return matches.get(0);
        String id = UUID.randomUUID().toString();
        try {
            db.update("INSERT INTO menu_categories(id,name,sort_order) VALUES (?,?,0)", id, name);
            return id;
        } catch (DuplicateKeyException duplicate) {
            return db.queryForObject("SELECT id FROM menu_categories WHERE name=?", String.class, name);
        }
    }

    private void syncTags(String itemId, List<String> tags) {
        db.update("DELETE FROM menu_item_tags WHERE menu_item_id=?", itemId);
        for (String raw : tags) {
            String name = raw.trim();
            if (name.isEmpty()) continue;
            String id = db.query("SELECT id FROM menu_tags WHERE name=?", rs -> rs.next() ? rs.getString(1) : null, name);
            if (id == null) {
                id = UUID.randomUUID().toString();
                try {
                    db.update("INSERT INTO menu_tags(id,name) VALUES (?,?)", id, name);
                } catch (DuplicateKeyException duplicate) {
                    id = db.queryForObject("SELECT id FROM menu_tags WHERE name=?", String.class, name);
                }
            }
            db.update("INSERT IGNORE INTO menu_item_tags(menu_item_id,tag_id) VALUES (?,?)", itemId, id);
        }
    }

    public List<Map<String, Object>> categories() {
        return db.queryForList("SELECT id,name,sort_order AS sortOrder FROM menu_categories ORDER BY sort_order,name");
    }

    public String createCategory(Requests.Category category) {
        String id = UUID.randomUUID().toString();
        db.update("INSERT INTO menu_categories(id,name,sort_order) VALUES (?,?,?)", id, category.name().trim(), category.sortOrder());
        return id;
    }

    public void updateCategory(String id, Requests.Category category) {
        if (db.update("UPDATE menu_categories SET name=?,sort_order=? WHERE id=?",
            category.name().trim(), category.sortOrder(), id) == 0)
            throw new java.util.NoSuchElementException("Category not found");
    }

    public List<Map<String, Object>> tags() {
        return db.queryForList("SELECT id,name,created_at AS createdAt FROM menu_tags ORDER BY name");
    }

    public String createTag(Requests.Tag tag) {
        String id = UUID.randomUUID().toString();
        db.update("INSERT INTO menu_tags(id,name) VALUES (?,?)", id, tag.name().trim());
        return id;
    }

    public List<Map<String, Object>> taxRules() {
        return db.queryForList("SELECT id,name,percent,is_active AS active FROM tax_rules ORDER BY name");
    }

    public String createTaxRule(Requests.TaxRule tax) {
        String id = UUID.randomUUID().toString();
        db.update("INSERT INTO tax_rules(id,name,percent,is_active) VALUES (?,?,?,?)",
            id, tax.name().trim(), tax.percent(), tax.active() == null || tax.active());
        return id;
    }

    public void updateTaxRule(String id, Requests.TaxRule tax) {
        int count = db.update("UPDATE tax_rules SET name=?,percent=?,is_active=? WHERE id=?",
            tax.name().trim(), tax.percent(), tax.active() == null || tax.active(), id);
        if (count == 0) throw new java.util.NoSuchElementException("Tax rule not found");
    }

    public List<Map<String, Object>> activeTaxRules() {
        return db.queryForList("SELECT id,name,percent FROM tax_rules WHERE is_active=TRUE ORDER BY name");
    }

    public boolean tableExists(int table) {
        Integer count = db.queryForObject("SELECT COUNT(*) FROM restaurant_tables WHERE table_number=? AND is_active=TRUE", Integer.class, table);
        return count != null && count > 0;
    }

    public List<Map<String, Object>> tables() {
        return db.queryForList("""
            SELECT t.table_number AS tableNumber,t.label,t.is_active AS active,
                   (s.last_seen >= CURRENT_TIMESTAMP - INTERVAL 5 MINUTE) AS online,
                   s.has_cart AS hasCart,s.bill_requested AS billRequested,s.last_seen AS lastSeen
            FROM restaurant_tables t LEFT JOIN table_sessions s ON s.table_number=t.table_number
            ORDER BY t.table_number
            """);
    }

    public Map<String, Object> table(int table) {
        return db.queryForMap("SELECT table_number AS tableNumber,label,is_active AS active FROM restaurant_tables WHERE table_number=?", table);
    }

    public int orderTable(String id) {
        Integer table = db.queryForObject("SELECT table_number FROM orders WHERE id=?", Integer.class, id);
        if (table == null) throw new java.util.NoSuchElementException("Order not found");
        return table;
    }

    public void createTable(Requests.RestaurantTable table) {
        db.update("INSERT INTO restaurant_tables(table_number,label) VALUES (?,?)", table.tableNumber(), table.label().trim());
    }

    public void setTableActive(int table, boolean active) {
        if (db.update("UPDATE restaurant_tables SET is_active=? WHERE table_number=?", active, table) == 0)
            throw new java.util.NoSuchElementException("Table not found");
    }

    public void touchTable(int table, boolean hasCart) {
        db.update("""
            INSERT INTO table_sessions(table_number,is_online,has_cart,last_seen)
            VALUES (?,TRUE,?,CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE is_online=TRUE,has_cart=VALUES(has_cart),last_seen=CURRENT_TIMESTAMP
            """, table, hasCart);
    }

    public void setBillRequested(int table, boolean requested) {
        db.update("""
            INSERT INTO table_sessions(table_number,bill_requested,last_seen)
            VALUES (?,?,CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE bill_requested=VALUES(bill_requested),last_seen=CURRENT_TIMESTAMP
            """, table, requested);
    }

    public void insertOrder(String id, int table, BigDecimal total, String note) {
        db.update("INSERT INTO orders(id,table_number,total,status,chef_note) VALUES (?,?,?,'Pending',?)", id, table, total, note);
    }

    public void insertOrderItem(String orderId, String menuId, String name, String category, String foodType,
                                BigDecimal price, int quantity, String note) {
        db.update("""
            INSERT INTO order_items(order_id,menu_item_id,name,category,food_type,unit_price,quantity,chef_note)
            VALUES (?,?,?,?,?,?,?,?)
            """, orderId, menuId, name, category, foodType, price, quantity, note);
    }

    public List<Map<String, Object>> orders(Integer table) {
        String filter = table == null ? "" : " WHERE table_number=?";
        String sql = """
            SELECT id,table_number AS `table`,total,status,chef_note AS chefNote,created_at AS createdAt,
                   accepted_at AS acceptedAt,completed_at AS completedAt,denied_at AS deniedAt
            FROM orders
            """ + filter + " ORDER BY created_at DESC";
        List<Map<String, Object>> orders = table == null ? db.queryForList(sql) : db.queryForList(sql, table);
        orders.forEach(order -> order.put("items", orderItems(order.get("id"))));
        return orders;
    }

    public List<Map<String, Object>> tableOrders(int table) {
        List<Map<String, Object>> orders = db.queryForList("""
            SELECT id,table_number AS `table`,total,status,created_at AS createdAt,
                   accepted_at AS acceptedAt,completed_at AS completedAt
            FROM orders WHERE table_number=? ORDER BY created_at DESC LIMIT 30
            """, table);
        orders.forEach(order -> order.put("items", orderItems(order.get("id"))));
        return orders;
    }

    private List<Map<String, Object>> orderItems(Object orderId) {
        return db.queryForList("""
            SELECT id,menu_item_id AS menuItemId,name,category,food_type AS foodType,
                   unit_price AS price,quantity,chef_note AS chefNote
            FROM order_items WHERE order_id=? ORDER BY id
            """, orderId);
    }

    public String orderStatus(String id) {
        return db.queryForObject("SELECT status FROM orders WHERE id=? FOR UPDATE", String.class, id);
    }

    public void setOrderStatus(String id, String status) {
        int count = db.update("""
            UPDATE orders SET status=?,
              accepted_at=IF(?='Accepted',COALESCE(accepted_at,CURRENT_TIMESTAMP),accepted_at),
              denied_at=IF(?='Denied',COALESCE(denied_at,CURRENT_TIMESTAMP),denied_at),
              completed_at=IF(?='Completed',COALESCE(completed_at,CURRENT_TIMESTAMP),completed_at)
            WHERE id=?
            """, status, status, status, status, id);
        if (count == 0) throw new java.util.NoSuchElementException("Order not found");
    }

    public void deletePendingOrder(String id) {
        db.update("DELETE FROM order_items WHERE order_id=?", id);
        if (db.update("DELETE FROM orders WHERE id=? AND status='Pending'", id) == 0)
            throw new IllegalStateException("Only pending orders without a completed workflow can be removed");
    }

    public boolean hasBillForOrder(String id) {
        Integer count = db.queryForObject("SELECT COUNT(*) FROM bill_items WHERE source_order_id=?", Integer.class, id);
        return count != null && count > 0;
    }

    public List<Map<String, Object>> requests() {
        return db.queryForList("SELECT id,table_number AS `table`,type,message,created_at AS createdAt FROM requests ORDER BY created_at DESC");
    }

    public String createRequest(int table, String type, String message) {
        String id = UUID.randomUUID().toString();
        db.update("INSERT INTO requests(id,table_number,type,message) VALUES (?,?,?,?)", id, table, type, message);
        return id;
    }

    public void deleteRequest(String id) {
        if (db.update("DELETE FROM requests WHERE id=?", id) == 0)
            throw new java.util.NoSuchElementException("Request not found");
    }

    public List<Map<String, Object>> messages() {
        return db.queryForList("SELECT id,table_number AS `table`,type,message,created_at AS createdAt FROM customer_messages ORDER BY created_at DESC");
    }

    public String createMessage(int table, String type, String message) {
        String id = UUID.randomUUID().toString();
        db.update("INSERT INTO customer_messages(id,table_number,type,message) VALUES (?,?,?,?)", id, table, type, message);
        return id;
    }

    public List<Map<String, Object>> unbilledItems(int table) {
        return db.queryForList("""
            SELECT oi.id AS sourceOrderItemId,oi.order_id AS sourceOrderId,oi.menu_item_id AS menuItemId,
                   oi.name,oi.category,oi.food_type AS foodType,oi.unit_price AS unitPrice,
                   oi.quantity,oi.chef_note AS chefNote
            FROM order_items oi JOIN orders o ON o.id=oi.order_id
            WHERE o.table_number=? AND o.status='Completed'
              AND NOT EXISTS (
                  SELECT 1 FROM bill_items bi
                  WHERE bi.source_order_item_id=oi.id OR bi.source_order_id=oi.order_id
              )
            ORDER BY o.created_at,oi.id FOR UPDATE
            """, table);
    }

    public void insertBill(String id, int table, BigDecimal subtotal, BigDecimal tax, BigDecimal total) {
        db.update("INSERT INTO bills(id,table_number,subtotal,tax_total,grand_total) VALUES (?,?,?,?,?)", id, table, subtotal, tax, total);
    }

    public void insertBillItem(String billId, Map<String, Object> item) {
        db.update("""
            INSERT INTO bill_items(bill_id,source_order_id,source_order_item_id,menu_item_id,name,category,food_type,
                                   unit_price,quantity,chef_note)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """, billId, item.get("sourceOrderId"), item.get("sourceOrderItemId"), item.get("menuItemId"),
            item.get("name"), item.get("category"), item.get("foodType"), item.get("unitPrice"),
            item.get("quantity"), item.get("chefNote"));
    }

    public void insertBillTax(String billId, Map<String, Object> rule, BigDecimal amount) {
        db.update("INSERT INTO bill_tax_lines(bill_id,tax_rule_id,name,percent,amount) VALUES (?,?,?,?,?)",
            billId, rule.get("id"), rule.get("name"), rule.get("percent"), amount);
    }

    public List<Map<String, Object>> bills() {
        return db.queryForList("""
            SELECT id,table_number AS `table`,subtotal,tax_total AS taxTotal,grand_total AS grandTotal,
                   payment_method AS paymentMethod,created_at AS createdAt,paid_at AS paidAt
            FROM bills ORDER BY created_at DESC
            """);
    }

    public Map<String, Object> bill(String id) {
        Map<String, Object> bill = db.queryForMap("""
            SELECT id,table_number AS `table`,subtotal,tax_total AS taxTotal,grand_total AS grandTotal,
                   payment_method AS paymentMethod,created_at AS createdAt,paid_at AS paidAt
            FROM bills WHERE id=?
            """, id);
        bill.put("items", db.queryForList("SELECT name,category,food_type AS foodType,unit_price AS unitPrice,quantity,chef_note AS chefNote FROM bill_items WHERE bill_id=? ORDER BY id", id));
        bill.put("taxLines", db.queryForList("SELECT name,percent,amount FROM bill_tax_lines WHERE bill_id=? ORDER BY id", id));
        return bill;
    }

    public void markPaid(String id, String method) {
        int count = db.update("UPDATE bills SET payment_method=?,paid_at=CURRENT_TIMESTAMP,payment_updated_at=CURRENT_TIMESTAMP WHERE id=? AND paid_at IS NULL", method, id);
        if (count == 0) throw new java.util.NoSuchElementException("Unpaid bill not found");
    }

    public Map<String, Object> analytics() {
        Map<String, Object> metrics = db.queryForMap("""
            SELECT COUNT(*) AS orderCount,
                   COALESCE(SUM(CASE WHEN status='Completed' THEN total ELSE 0 END),0) AS completedSales,
                   COALESCE(AVG(CASE WHEN status='Completed' THEN total END),0) AS averageOrderValue,
                   SUM(CASE WHEN status IN ('Pending','Accepted') THEN 1 ELSE 0 END) AS openOrders
            FROM orders WHERE created_at >= CURRENT_DATE
            """);
        metrics.put("paidRevenue", db.queryForObject("SELECT COALESCE(SUM(grand_total),0) FROM bills WHERE paid_at IS NOT NULL AND paid_at >= CURRENT_DATE", BigDecimal.class));
        metrics.put("activeTables", db.queryForObject("SELECT COUNT(*) FROM restaurant_tables WHERE is_active=TRUE", Integer.class));
        metrics.put("dailyRevenue", db.queryForList("""
            SELECT DATE(paid_at) AS day,SUM(grand_total) AS revenue
            FROM bills WHERE paid_at >= CURRENT_DATE - INTERVAL 6 DAY
            GROUP BY DATE(paid_at) ORDER BY day
            """));
        metrics.put("popularItems", db.queryForList("""
            SELECT bi.name,SUM(bi.quantity) AS quantity
            FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
            WHERE b.paid_at IS NOT NULL AND b.paid_at >= CURRENT_DATE - INTERVAL 6 DAY
            GROUP BY bi.name ORDER BY quantity DESC LIMIT 5
            """));
        return metrics;
    }

    public Map<String, String> settings() {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map<String, Object> row : db.queryForList("SELECT setting_key,setting_value FROM restaurant_settings ORDER BY setting_key"))
            result.put(String.valueOf(row.get("setting_key")), String.valueOf(row.get("setting_value")));
        return result;
    }

    public void setSetting(String key, String value) {
        db.update("""
            INSERT INTO restaurant_settings(setting_key,setting_value) VALUES (?,?)
            ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)
            """, key, value);
    }

    private String toJson(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Invalid JSON value", e);
        }
    }
}

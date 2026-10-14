package com.foodhub.service;

import com.foodhub.api.dto.Requests;
import com.foodhub.data.RestaurantRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
public class RestaurantService {
    private static final Set<String> ORDER_STATUSES = Set.of("Pending", "Accepted", "Denied", "Completed");
    private static final Set<String> PAYMENT_METHODS = Set.of("Cash", "Card", "UPI");

    private final RestaurantRepository repository;
    private final EventHub events;

    public RestaurantService(RestaurantRepository repository, EventHub events) {
        this.repository = repository;
        this.events = events;
    }

    public List<Map<String, Object>> menuItems() { return repository.menuItems(); }
    public List<Map<String, Object>> categories() { return repository.categories(); }
    public List<Map<String, Object>> tags() { return repository.tags(); }
    public List<Map<String, Object>> taxRules() { return repository.taxRules(); }
    public Map<String, Object> analytics() { return repository.analytics(); }
    public List<Map<String, Object>> tables() { return repository.tables(); }
    public List<Map<String, Object>> orders(Integer table) { return repository.orders(table); }
    public List<Map<String, Object>> requests() { return repository.requests(); }
    public List<Map<String, Object>> messages() { return repository.messages(); }
    public List<Map<String, Object>> bills() { return repository.bills(); }
    public Map<String, String> settings() { return repository.settings(); }
    public Map<String, Object> table(int table) {
        if (!repository.tableExists(table)) throw new NoSuchElementException("Active table not found");
        return repository.table(table);
    }

    @Transactional
    public String saveMenuItem(String id, Requests.MenuItem item) {
        String savedId = repository.saveMenuItem(id, item);
        events.publishAfterCommit("menu.updated", null, Map.of("id", savedId));
        return savedId;
    }

    @Transactional
    public void deleteMenuItem(String id) {
        repository.deleteMenuItem(id);
        events.publishAfterCommit("menu.updated", null, Map.of("id", id));
    }

    @Transactional
    public String createCategory(Requests.Category category) {
        String id = repository.createCategory(category);
        events.publishAfterCommit("menu.updated", null, Map.of("categoryId", id));
        return id;
    }

    @Transactional
    public void updateCategory(String id, Requests.Category category) {
        repository.updateCategory(id, category);
        events.publishAfterCommit("menu.updated", null, Map.of("categoryId", id));
    }

    @Transactional
    public String createTag(Requests.Tag tag) {
        return repository.createTag(tag);
    }

    @Transactional
    public String createTaxRule(Requests.TaxRule tax) {
        return repository.createTaxRule(tax);
    }

    @Transactional
    public void updateTaxRule(String id, Requests.TaxRule tax) {
        repository.updateTaxRule(id, tax);
    }

    @Transactional
    public Map<String, Object> placeOrder(Requests.PlaceOrder request) {
        requireActiveTable(request.table());
        BigDecimal total = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        String orderId = UUID.randomUUID().toString();
        record PricedLine(String id, String name, String category, String foodType,
                          BigDecimal price, int quantity, String note) {}
        List<PricedLine> lines = request.items().stream().map(line -> {
            Map<String, Object> item;
            try {
                item = repository.menuItem(line.id());
            } catch (EmptyResultDataAccessException e) {
                throw new IllegalArgumentException("Menu item is no longer available: " + line.id());
            }
            if (!Boolean.TRUE.equals(item.get("available")))
                throw new IllegalArgumentException("Menu item is no longer available: " + line.id());
            BigDecimal price = (BigDecimal) item.get("price");
            totalLineCheck(line.quantity());
            return new PricedLine(line.id(), String.valueOf(item.get("name")),
                String.valueOf(item.get("category")), String.valueOf(item.get("foodType")),
                price, line.quantity(), normalize(line.chefNote()));
        }).toList();
        for (PricedLine line : lines)
            total = total.add(line.price().multiply(BigDecimal.valueOf(line.quantity())));

        repository.insertOrder(orderId, request.table(), total, normalize(request.chefNote()));
        for (PricedLine line : lines)
            repository.insertOrderItem(orderId, line.id(), line.name(), line.category(), line.foodType(),
                line.price(), line.quantity(), line.note());
        repository.touchTable(request.table(), false);
        events.publishAfterCommit("order.created", request.table(), Map.of("id", orderId));
        return Map.of("id", orderId, "table", request.table(), "total", total, "status", "Pending");
    }

    @Transactional
    public Map<String, Object> updateOrderStatus(String id, String next) {
        if (!ORDER_STATUSES.contains(next)) throw new IllegalArgumentException("Invalid order status");
        String current = repository.orderStatus(id);
        int table = repository.orderTable(id);
        boolean allowed = current.equals(next)
            || (current.equals("Pending") && Set.of("Accepted", "Denied").contains(next))
            || (current.equals("Accepted") && next.equals("Completed"));
        if (!allowed) throw new IllegalStateException("Order cannot move from " + current + " to " + next);
        if (!current.equals(next)) repository.setOrderStatus(id, next);
        events.publishAfterCommit("order.updated", table, Map.of("id", id, "status", next));
        return Map.of("id", id, "status", next);
    }

    @Transactional
    public void deletePendingOrder(String id) {
        int table = repository.orderTable(id);
        if (!repository.orderStatus(id).equals("Pending") || repository.hasBillForOrder(id))
            throw new IllegalStateException("Only pending orders without a bill can be removed");
        repository.deletePendingOrder(id);
        events.publishAfterCommit("order.deleted", table, Map.of("id", id));
    }

    public List<Map<String, Object>> tableOrders(int table) {
        if (!repository.tableExists(table)) throw new NoSuchElementException("Table not found");
        return repository.tableOrders(table);
    }

    @Transactional
    public String createRequest(Requests.Request request) {
        requireActiveTable(request.table());
        if (!Set.of("Waiter", "Bill").contains(request.type()))
            throw new IllegalArgumentException("Request type must be Waiter or Bill");
        String message = normalize(request.message());
        if (message.isBlank()) message = request.type().equals("Bill") ? "Please bring the bill." : "A waiter was requested.";
        String id = repository.createRequest(request.table(), request.type(), message);
        if (request.type().equals("Bill")) repository.setBillRequested(request.table(), true);
        events.publishAfterCommit("request.created", request.table(), Map.of("id", id, "type", request.type()));
        return id;
    }

    @Transactional
    public void deleteRequest(String id) {
        repository.deleteRequest(id);
        events.publishAfterCommit("request.updated", null, Map.of("id", id));
    }

    @Transactional
    public String createMessage(Requests.CustomerMessage message) {
        requireActiveTable(message.table());
        String id = repository.createMessage(message.table(), normalize(message.type()), message.message().trim());
        events.publishAfterCommit("message.created", message.table(), Map.of("id", id));
        return id;
    }

    @Transactional
    public void createTable(Requests.RestaurantTable table) {
        repository.createTable(table);
        events.publishAfterCommit("tables.updated", null, Map.of("table", table.tableNumber()));
    }

    @Transactional
    public void setTableActive(int table, boolean active) {
        repository.setTableActive(table, active);
        events.publishAfterCommit("tables.updated", null, Map.of("table", table, "active", active));
    }

    @Transactional
    public void touchTable(int table, boolean hasCart) {
        requireActiveTable(table);
        repository.touchTable(table, hasCart);
        events.publishAfterCommit("table.activity", table, Map.of("hasCart", hasCart));
    }

    @Transactional
    public Map<String, Object> createBill(int table) {
        if (!repository.tableExists(table)) throw new NoSuchElementException("Table not found");
        List<Map<String, Object>> items = repository.unbilledItems(table);
        if (items.isEmpty()) throw new IllegalStateException("No completed, unbilled items for this table");

        BigDecimal subtotal = items.stream().map(item -> ((BigDecimal) item.get("unitPrice"))
            .multiply(BigDecimal.valueOf(((Number) item.get("quantity")).longValue())))
            .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
        List<Map<String, Object>> taxes = repository.activeTaxRules();
        BigDecimal taxTotal = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        Map<String, BigDecimal> taxAmounts = new LinkedHashMap<>();
        for (Map<String, Object> tax : taxes) {
            BigDecimal amount = TaxCalculator.amount(subtotal, (BigDecimal) tax.get("percent"));
            taxAmounts.put(String.valueOf(tax.get("id")), amount);
            taxTotal = taxTotal.add(amount);
        }
        String id = UUID.randomUUID().toString();
        BigDecimal grandTotal = subtotal.add(taxTotal).setScale(2, RoundingMode.HALF_UP);
        repository.insertBill(id, table, subtotal, taxTotal, grandTotal);
        for (Map<String, Object> item : items) repository.insertBillItem(id, item);
        for (Map<String, Object> tax : taxes)
            repository.insertBillTax(id, tax, taxAmounts.get(String.valueOf(tax.get("id"))));
        repository.setBillRequested(table, false);
        events.publishAfterCommit("bill.created", table, Map.of("id", id));
        return repository.bill(id);
    }

    @Transactional
    public Map<String, Object> markPaid(String id, String method) {
        if (!PAYMENT_METHODS.contains(method)) throw new IllegalArgumentException("Payment method must be Cash, Card, or UPI");
        repository.markPaid(id, method);
        events.publishAfterCommit("bill.paid", null, Map.of("id", id, "method", method));
        return repository.bill(id);
    }

    @Transactional
    public void saveSetting(Requests.Setting setting) {
        repository.setSetting(setting.key().trim(), setting.value());
    }

    private void requireActiveTable(int table) {
        if (!repository.tableExists(table)) throw new NoSuchElementException("Active table not found");
    }

    private void totalLineCheck(int quantity) {
        if (quantity < 1 || quantity > 100) throw new IllegalArgumentException("Quantity must be 1-100");
    }

    private String normalize(String value) { return value == null ? "" : value.trim(); }
}

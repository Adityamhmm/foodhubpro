package com.foodhub.api;

import com.foodhub.api.dto.Requests;
import com.foodhub.service.EventHub;
import com.foodhub.service.RestaurantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RestaurantController {
    private final RestaurantService service;
    private final EventHub events;

    public RestaurantController(RestaurantService service, EventHub events) {
        this.service = service;
        this.events = events;
    }

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }

    @GetMapping("/menu-items")
    public List<Map<String, Object>> menuItems() { return service.menuItems(); }

    @PostMapping("/menu-items")
    public ResponseEntity<Map<String, String>> createMenuItem(@Valid @RequestBody Requests.MenuItem item) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.saveMenuItem(null, item)));
    }

    @PutMapping("/menu-items/{id}")
    public Map<String, String> updateMenuItem(@PathVariable String id, @Valid @RequestBody Requests.MenuItem item) {
        return Map.of("id", service.saveMenuItem(id, item));
    }

    @DeleteMapping("/menu-items/{id}")
    public ResponseEntity<Void> deleteMenuItem(@PathVariable String id) {
        service.deleteMenuItem(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/menu-categories")
    public List<Map<String, Object>> categories() { return service.categories(); }

    @PostMapping("/menu-categories")
    public ResponseEntity<Map<String, String>> createCategory(@Valid @RequestBody Requests.Category category) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.createCategory(category)));
    }

    @PutMapping("/menu-categories/{id}")
    public Map<String, String> updateCategory(@PathVariable String id, @Valid @RequestBody Requests.Category category) {
        service.updateCategory(id, category);
        return Map.of("id", id);
    }

    @GetMapping("/menu-tags")
    public List<Map<String, Object>> tags() { return service.tags(); }

    @PostMapping("/menu-tags")
    public ResponseEntity<Map<String, String>> createTag(@Valid @RequestBody Requests.Tag tag) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.createTag(tag)));
    }

    @GetMapping("/tax-rules")
    public List<Map<String, Object>> taxRules() { return service.taxRules(); }

    @PostMapping("/tax-rules")
    public ResponseEntity<Map<String, String>> createTaxRule(@Valid @RequestBody Requests.TaxRule tax) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.createTaxRule(tax)));
    }

    @PutMapping("/tax-rules/{id}")
    public Map<String, String> updateTaxRule(@PathVariable String id, @Valid @RequestBody Requests.TaxRule tax) {
        service.updateTaxRule(id, tax);
        return Map.of("id", id);
    }

    @GetMapping("/orders")
    public List<Map<String, Object>> orders(@RequestParam(required = false) Integer table) { return service.orders(table); }

    @PostMapping("/orders")
    public ResponseEntity<Map<String, Object>> createOrder(@Valid @RequestBody Requests.PlaceOrder order) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.placeOrder(order));
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> updateOrderStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        return service.updateOrderStatus(id, body.getOrDefault("status", ""));
    }

    @DeleteMapping("/orders/{id}")
    public ResponseEntity<Void> deletePendingOrder(@PathVariable String id) {
        service.deletePendingOrder(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tables")
    public List<Map<String, Object>> tables() { return service.tables(); }

    @GetMapping("/tables/{table}")
    public Map<String, Object> table(@PathVariable int table) { return service.table(table); }

    @GetMapping("/tables/{table}/orders")
    public List<Map<String, Object>> tableOrders(@PathVariable int table) { return service.tableOrders(table); }

    @PostMapping("/tables")
    public ResponseEntity<Void> createTable(@Valid @RequestBody Requests.RestaurantTable table) {
        service.createTable(table);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PatchMapping("/tables/{table}/active")
    public ResponseEntity<Void> setTableActive(@PathVariable int table, @RequestBody Map<String, Boolean> body) {
        service.setTableActive(table, Boolean.TRUE.equals(body.get("active")));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/table-sessions/{table}")
    public ResponseEntity<Void> touchTable(@PathVariable int table, @RequestBody Map<String, Boolean> body) {
        service.touchTable(table, Boolean.TRUE.equals(body.get("hasCart")));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/requests")
    public List<Map<String, Object>> requests() { return service.requests(); }

    @PostMapping("/requests")
    public ResponseEntity<Map<String, String>> createRequest(@Valid @RequestBody Requests.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.createRequest(request)));
    }

    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> deleteRequest(@PathVariable String id) {
        service.deleteRequest(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/customer-messages")
    public List<Map<String, Object>> messages() { return service.messages(); }

    @PostMapping("/customer-messages")
    public ResponseEntity<Map<String, String>> createMessage(@Valid @RequestBody Requests.CustomerMessage message) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", service.createMessage(message)));
    }

    @GetMapping("/bills")
    public List<Map<String, Object>> bills() { return service.bills(); }

    @PostMapping("/bills")
    public ResponseEntity<Map<String, Object>> createBill(@RequestParam int table) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createBill(table));
    }

    @PatchMapping("/bills/{id}/payment")
    public Map<String, Object> payBill(@PathVariable String id, @Valid @RequestBody Requests.Payment payment) {
        return service.markPaid(id, payment.method());
    }

    @GetMapping("/analytics")
    public Map<String, Object> analytics() { return service.analytics(); }

    @GetMapping("/settings")
    public Map<String, String> settings() { return service.settings(); }

    @PutMapping("/settings")
    public ResponseEntity<Void> saveSetting(@Valid @RequestBody Requests.Setting setting) {
        service.saveSetting(setting);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/events")
    public SseEmitter events(@RequestParam(required = false) Integer table, Authentication authentication) {
        if (table != null) service.table(table);
        boolean staff = authentication != null && authentication.getAuthorities().stream()
            .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN") || authority.getAuthority().equals("ROLE_KITCHEN"));
        if (table == null && !staff)
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return events.subscribe(table);
    }
}

package com.foodhub.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public final class Requests {
    private Requests() {}

    public record OrderLine(
        @NotBlank @Size(max = 36) String id,
        @Min(1) @Max(100) int quantity,
        @Size(max = 2000) String chefNote
    ) {}

    public record PlaceOrder(
        @Min(1) int table,
        @NotEmpty List<@Valid OrderLine> items,
        @Size(max = 2000) String chefNote
    ) {}

    public record MenuItem(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 120) String category,
        @Size(max = 2000) String description,
        @Size(max = 500) String imageUrl,
        @Size(max = 30) String foodType,
        @NotNull @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal price,
        Boolean available,
        @Size(max = 30) List<@Size(max = 100) String> tags
    ) {}

    public record Category(@NotBlank @Size(max = 120) String name, int sortOrder) {}
    public record Tag(@NotBlank @Size(max = 100) String name) {}
    public record TaxRule(
        @NotBlank @Size(max = 120) String name,
        @NotNull @DecimalMin("0.000") @DecimalMax("100.000") BigDecimal percent,
        Boolean active
    ) {}
    public record Request(
        @Min(1) int table,
        @NotBlank String type,
        @Size(max = 2000) String message
    ) {}
    public record CustomerMessage(
        @Min(1) int table,
        @Size(max = 50) String type,
        @NotBlank @Size(max = 2000) String message
    ) {}
    public record RestaurantTable(@Min(1) int tableNumber, @NotBlank @Size(max = 80) String label) {}
    public record Payment(@NotBlank String method) {}
    public record StaffUser(
        @NotBlank @Size(max = 80) String username,
        @NotBlank @Size(min = 12, max = 200) String password,
        @NotBlank String role
    ) {}
    public record Enabled(Boolean enabled) {}
    public record Setting(@NotBlank @Size(max = 100) String key, @NotNull @Size(max = 2000) String value) {}
}

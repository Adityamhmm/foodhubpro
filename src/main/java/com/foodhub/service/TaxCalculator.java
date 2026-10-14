package com.foodhub.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class TaxCalculator {
    private TaxCalculator() {}

    public static BigDecimal amount(BigDecimal subtotal, BigDecimal percent) {
        return subtotal.multiply(percent).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
    }
}

package com.foodhub.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaxCalculatorTest {
    @Test
    void roundsTaxToCurrencyPrecision() {
        assertEquals(new BigDecimal("1.50"), TaxCalculator.amount(new BigDecimal("19.99"), new BigDecimal("7.5")));
    }

    @Test
    void handlesZeroTax() {
        assertEquals(new BigDecimal("0.00"), TaxCalculator.amount(new BigDecimal("82.40"), BigDecimal.ZERO));
    }
}

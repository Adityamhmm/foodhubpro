package com.foodhub.config;

import com.foodhub.data.StaffUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain security(HttpSecurity http) throws Exception {
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);
        return http
            .cors(cors -> {})
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(csrfHandler))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/csrf", "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/health", "/api/menu-items", "/api/menu-categories",
                    "/api/menu-tags", "/api/tax-rules", "/api/tables/*",
                    "/api/tables/*/orders", "/api/events").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/orders", "/api/requests", "/api/customer-messages",
                    "/api/table-sessions/*").permitAll()
                .requestMatchers("/api/staff", "/api/staff/**", "/api/bills", "/api/bills/**",
                    "/api/analytics", "/api/analytics/**", "/api/settings").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/orders", "/api/requests", "/api/customer-messages",
                    "/api/tables").hasAnyRole("ADMIN", "KITCHEN")
                .requestMatchers(HttpMethod.PATCH, "/api/orders/*/status", "/api/requests/*").hasAnyRole("ADMIN", "KITCHEN")
                .requestMatchers(HttpMethod.DELETE, "/api/orders/**").hasRole("ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/menu-items", "/api/menu-categories", "/api/menu-tags",
                    "/api/tax-rules", "/api/tables", "/api/bills").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/menu-items/**", "/api/tax-rules/**", "/api/settings").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/menu-categories/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/menu-items/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/requests/**").hasAnyRole("ADMIN", "KITCHEN")
                .requestMatchers(HttpMethod.PATCH, "/api/tables/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, auth) -> response.setStatus(204)))
            .build();
    }

    @Bean
    UserDetailsService userDetailsService(StaffUserRepository users) {
        return username -> users.findById(username)
            .map(staff -> User.withUsername(staff.getUsername())
                .password(staff.getPasswordHash())
                .roles(staff.getRole().name())
                .disabled(!staff.isEnabled())
                .build())
            .orElseThrow(() -> new UsernameNotFoundException("Invalid username or password"));
    }

    @Bean
    AuthenticationProvider authenticationProvider(UserDetailsService users, PasswordEncoder encoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(users);
        provider.setPasswordEncoder(encoder);
        return provider;
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${app.frontend-origin}") String frontendOrigin) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontendOrigin));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}

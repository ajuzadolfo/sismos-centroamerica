package com.sismos.repository;

import com.sismos.model.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    void deleteByEndpoint(String endpoint);

    @Query("SELECT p FROM PushSubscription p WHERE p.minMagnitude <= :magnitude OR p.minMagnitude IS NULL")
    List<PushSubscription> findEligibleSubscriptions(@Param("magnitude") BigDecimal magnitude);
}

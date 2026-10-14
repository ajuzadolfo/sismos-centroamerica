package com.sismos.repository.projection;

public interface RegionalSummaryRow {
    String getCountryLabel();
    Long getTotalCount();
    Long getMagMenor();
    Long getMagModerado();
    Long getMagFuerte();
    Long getMagMayor();
    Long getSomeros();
    Long getIntermedios();
    Long getProfundos();
}

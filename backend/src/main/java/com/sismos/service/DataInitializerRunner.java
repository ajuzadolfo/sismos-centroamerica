package com.sismos.service;

import com.sismos.model.entity.GeologicalFault;
import com.sismos.repository.GeologicalFaultRepository;
import com.sismos.repository.SeismicEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.MultiLineString;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializerRunner implements ApplicationRunner {

    private final SeismicEventRepository seismicEventRepository;
    private final GeologicalFaultRepository geologicalFaultRepository;
    private final UsgsIngestionService usgsIngestionService;

    @Override
    public void run(ApplicationArguments args) {
        // 1. Inicialización de fallas geológicas principales de Centroamérica
        if (geologicalFaultRepository.count() == 0) {
            log.info("Inicializando fallas geologicas de referencia para Centroamerica...");
            seedGeologicalFaults();
        }

        // 2. Carga inicial de sismos si hay pocos eventos almacenados
        long currentCount = seismicEventRepository.count();
        if (currentCount < 10) {
            log.info("Iniciando precarga historica de los ultimos 30 dias desde USGS FDSN...");
            int loaded = usgsIngestionService.syncHistoricalData(30);
            log.info("Precarga historica completada: {} sismos registrados", loaded);
        } else {
            log.info("Catalogo sismico activo con {} eventos almacenados", currentCount);
        }
    }

    private void seedGeologicalFaults() {
        GeometryFactory factory = new GeometryFactory(new PrecisionModel(), 4326);

        // Falla del Motagua (Guatemala) - Límite de placas Norteamericana y del Caribe
        LineString motagua = factory.createLineString(new Coordinate[]{
                new Coordinate(-91.5, 15.0),
                new Coordinate(-90.0, 15.2),
                new Coordinate(-88.5, 15.5)
        });
        GeologicalFault faultMotagua = GeologicalFault.builder()
                .name("Falla del Motagua")
                .faultType("Transformante")
                .countryCode("GTM")
                .geom(factory.createMultiLineString(new LineString[]{motagua}))
                .build();

        // Falla de Chixoy-Polochic (Guatemala)
        LineString polochic = factory.createLineString(new Coordinate[]{
                new Coordinate(-91.8, 15.3),
                new Coordinate(-90.5, 15.4),
                new Coordinate(-89.2, 15.6)
        });
        GeologicalFault faultPolochic = GeologicalFault.builder()
                .name("Falla de Chixoy-Polochic")
                .faultType("Transformante")
                .countryCode("GTM")
                .geom(factory.createMultiLineString(new LineString[]{polochic}))
                .build();

        // Falla de Jocotán-Chamelecón (Guatemala / Honduras)
        LineString jocotan = factory.createLineString(new Coordinate[]{
                new Coordinate(-89.8, 14.8),
                new Coordinate(-88.7, 15.2),
                new Coordinate(-87.8, 15.4)
        });
        GeologicalFault faultJocotan = GeologicalFault.builder()
                .name("Falla de Jocotán-Chamelecón")
                .faultType("Normal")
                .countryCode("HND")
                .geom(factory.createMultiLineString(new LineString[]{jocotan}))
                .build();

        // Falla de Nejapa (Nicaragua - Graben de Managua)
        LineString nejapa = factory.createLineString(new Coordinate[]{
                new Coordinate(-86.35, 12.08),
                new Coordinate(-86.32, 12.18),
                new Coordinate(-86.29, 12.25)
        });
        GeologicalFault faultNejapa = GeologicalFault.builder()
                .name("Falla de Nejapa")
                .faultType("Normal / Volcánica")
                .countryCode("NIC")
                .geom(factory.createMultiLineString(new LineString[]{nejapa}))
                .build();

        // Zona de Fractura de Panamá
        LineString panama = factory.createLineString(new Coordinate[]{
                new Coordinate(-82.8, 5.0),
                new Coordinate(-82.5, 7.5),
                new Coordinate(-82.3, 8.5)
        });
        GeologicalFault faultPanama = GeologicalFault.builder()
                .name("Zona de Fractura de Panamá")
                .faultType("Transformante")
                .countryCode("PAN")
                .geom(factory.createMultiLineString(new LineString[]{panama}))
                .build();

        geologicalFaultRepository.saveAll(List.of(faultMotagua, faultPolochic, faultJocotan, faultNejapa, faultPanama));
        log.info("5 fallas geologicas principales insertadas correctamente");
    }
}

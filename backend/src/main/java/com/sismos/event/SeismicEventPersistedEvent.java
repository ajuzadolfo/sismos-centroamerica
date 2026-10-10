package com.sismos.event;

import com.sismos.model.entity.SeismicEvent;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class SeismicEventPersistedEvent extends ApplicationEvent {

    private final SeismicEvent seismicEvent;
    private final boolean isNew;

    public SeismicEventPersistedEvent(Object source, SeismicEvent seismicEvent, boolean isNew) {
        super(source);
        this.seismicEvent = seismicEvent;
        this.isNew = isNew;
    }
}

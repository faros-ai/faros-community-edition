ARG METABASE_IMAGE
ARG METABASE_VERSION
FROM ${METABASE_IMAGE}:${METABASE_VERSION}
RUN mkdir /faros
COPY log4j2.xml /faros/
ENV JAVA_OPTS="${JAVA_OPTS} -Dlog4j2.formatMsgNoLookups=true -Dlog4j.configurationFile=file:/faros/log4j2.xml"

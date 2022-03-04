ARG METABASE_IMAGE
FROM ${METABASE_IMAGE}:v0.41.6
RUN mkdir /faros
COPY log4j2.xml /faros/
ENV JAVA_OPTS="${JAVA_OPTS} -Dlog4j2.formatMsgNoLookups=true -Dlog4j.configurationFile=file:/faros/log4j2.xml"

FROM metabase/metabase:v0.40.5
RUN mkdir /faros
COPY log4j2.xml /faros/
ENV JAVA_OPTS="${JAVA_OPTS} -Dlog4j.configurationFile=file:/faros/log4j2.xml"

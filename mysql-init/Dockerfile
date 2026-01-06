FROM mysql:8.0

# Copy initialization scripts
# They will be executed in alphabetical order
COPY init.sql /docker-entrypoint-initdb.d/

# Set proper permissions
RUN chown -R mysql:mysql /docker-entrypoint-initdb.d/

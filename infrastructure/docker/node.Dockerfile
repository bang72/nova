FROM rust:1.85-bookworm AS build
WORKDIR /src
COPY . .
RUN cargo build --release -p nova-node
FROM debian:bookworm-slim
RUN useradd -r -u 10001 nova
COPY --from=build /src/target/release/nova-node /usr/local/bin/nova-node
USER nova
EXPOSE 7711
ENTRYPOINT ["nova-node"]

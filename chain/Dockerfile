FROM node:22-alpine
WORKDIR /nova
COPY chain ./chain
ENV NOVA_DATA_DIR=/var/lib/nova
ENV NOVA_RPC_HOST=0.0.0.0
ENV NOVA_RPC_PORT=4178
EXPOSE 4178
VOLUME ["/var/lib/nova"]
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4178/health || exit 1
CMD ["node", "chain/src/node.mjs"]

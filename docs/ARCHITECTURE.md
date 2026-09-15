# NOVA Architecture

```
NOVA Protocol Specification
          │
   ┌──────┴──────┐
 reference     independent
   client        client
   └──────┬──────┘
       NOVA L1
    ┌─────┼───────────┐
 Wallet Explorer   Archive
    │       │           │
    └──── RPC/events ───┘

NOVA Social → SAID → PSR → Relay/Indexer/Media
                     │
            economic actions only
                     ▼
                 NOVA Wallet → L1
```

The protocol specification is normative. Client code is an implementation of that specification, not its replacement. Social records remain off L1 unless an action truly requires global settlement or ownership consensus.

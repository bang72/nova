# NOVA Social Protocol

NOVA Social is the first public application of the continuity network, not the definition of NOVA itself.

## Core model

- **SAID**: stable social account identifier independent from mutable handle and provider.
- **PSR**: signed personal social repository containing profile records, follows and public social records.
- **Media**: content-addressed external blobs; raw media is not stored on L1.
- **Relay**: verifies repository commits and publishes event streams.
- **Indexer**: materializes search, graph, feed and moderation views.
- **Portability**: export, mirror and provider migration are first-class operations.

Financial Account IDs and SAIDs are separate by default. Users may explicitly publish a binding; the application must not silently expose financial history through social identity.

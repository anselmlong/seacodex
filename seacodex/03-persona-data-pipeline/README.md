# Persona Data Pipeline

## Target Result

Prepare SEA-grounded persona seed data and mocked campaign/social-post inputs for the simulator.

## Build

- Normalize personas into `../shared/contracts/persona.schema.json`.
- Include country, age band, community type, language mix, brand attitude, sharing tendency, and backlash sensitivity.
- Provide a scripted Shopee 11.11 campaign fixture.
- Mock image-scraping output as structured product behavior signals.

## Constraints

Do not depend on live scraping during the demo. Keep all demo fixtures checked in.

## Stop Condition

The simulator can load personas and campaign signals from this lane without manual cleanup.


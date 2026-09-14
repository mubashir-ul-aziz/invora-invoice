Build ONLY this screen from the existing Stitch design.

Before coding:
1. Inspect the corresponding Stitch screen/design.
2. Inspect the existing frontend code and routing.
3. Inspect the existing backend/API and database schema only to determine which data already exists for this screen.
4. Reuse existing components, APIs, types, models, and design system where possible.
5. Do NOT create, modify, migrate, seed, or delete any database tables, columns, records, or schemas.
6. Do NOT modify backend logic, API contracts, controllers, services, or endpoints.
7. If the Stitch design contains a value, field, action, or UI element that has no existing backend/API/database support:
   - Still build the UI exactly as designed.
   - Do not invent real data or backend behavior.
   - Clearly mark that element with a visible "DESIGN ONLY" badge.
   - Also add a code comment identifying exactly what is missing.
8. If the required data already exists in the existing API/database, connect the UI to the existing implementation.
9. Never fake a backend feature when the backend does not support it.
10. Do not redesign the Stitch screen. Match the Stitch design as closely as possible.
11. Keep the implementation mobile-first and production-quality.
12. Do not modify unrelated screens.
13. After implementation, report:
    - What was implemented
    - Existing API/database data successfully connected
    - Any missing backend/database values
    - Every element marked "DESIGN ONLY"
    - Files changed

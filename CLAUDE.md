I need you to build a self-hosted helicopter pilot logbook web application that I can deploy in a Docker container on my homelab.

CORE REQUIREMENTS:

1. TECHNOLOGY STACK:
   - Backend: Node.js + Express
   - Database: SQLite (with easy path to PostgreSQL later)
   - Frontend: Simple HTML/CSS/JavaScript (no React/Vue - keep it lightweight)
   - Authentication: Simple session-based login for single user
   - All in a single Docker container

2. ESSENTIAL FEATURES:

   Flight Entry Form with these fields:
   - Date (date picker)
   - Aircraft Category (radio buttons: Helicopter, Aeroplane, Simulator)
   - Engine Type (radio buttons: Single Engine, Multi Engine)
   - Aircraft Type (dropdown: R22, R44, AS350B2, AS350B3, H125, B206, Bell 212, plus custom types)
   - Registration (text input)
   - Pilot in Command (text input)
   - Co-pilot/Student (text input)
   - Flight Details/Route (textarea)
   - Flight Time Breakdown (8 fields, auto-calculates total):
     * Day PIC, Night PIC
     * Day Dual, Night Dual
     * Day SIC (Second in Command), Night SIC
     * Day Commanded Practice, Night Commanded Practice
   - Custom Fields: User-defined specialty hour fields created via Settings > Custom Fields (e.g., Longline, Mountain, Instructor, etc.)
   - Takeoffs: Day/Night (integer inputs)
   - Landings: Day/Night (integer inputs)

   Flight List View:
   - Table showing all flights with date, aircraft, registration, flight time, route
   - Sort by date (newest first)
   - Basic search/filter by aircraft type
   - Edit and delete buttons for each entry
   - Pagination (20 entries per page)
   - CSV export (all flight entries)
   - Summary export (totals by all variables)

   Dashboard/Summary:
   - Total flight hours (all time)
   - Total hours by aircraft type (simple breakdown)
   - Total flights count
   - Last 10 flights preview

   Authentication:
   - Simple login page
   - Single user credential (username/password)
   - Session-based auth (no JWT complexity needed)
   - Logout functionality

3. USER INTERFACE:
   - Clean, professional design
   - Mobile-responsive (I'll be entering flights on my phone in the field)
   - Dark mode support would be nice but not essential
   - Navigation: Home/Dashboard, Add Flight, View Flights, Logout

4. DATA VALIDATION:
   - Date cannot be in the future
   - Total flight time must be > 0 (calculated from breakdown fields)
   - Required fields: Date, Aircraft Type, and at least one flight time breakdown field

5. DOCKER SETUP:
   - Single Dockerfile
   - docker-compose.yml for easy deployment
   - SQLite database should persist in a volume
   - Expose on port 3000
   - Include environment variables for:
     * Initial admin username/password
     * Database path
     * Session secret

6. PROJECT STRUCTURE:
   /logbook
     /src
       /routes (API endpoints)
       /models (database models)
       /middleware (auth)
       /public (HTML/CSS/JS)
     /data (SQLite database volume mount point)
     Dockerfile
     docker-compose.yml
     package.json
     README.md

7. ADDITIONAL REQUIREMENTS:
   - Include a README.md with:
     * Setup instructions
     * How to deploy with Docker
     * How to access the app
     * How to backup the database
     * Environment variables documentation
   - Basic error handling and user feedback
   - SQL schema should be initialized automatically on first run
   - Use prepared statements to prevent SQL injection

NICE TO HAVES (only if easy):
- Export flights to CSV
- Backup/restore functionality
- Basic field validation with user-friendly error messages

WHAT NOT TO INCLUDE:
- No complex reporting or analytics (we'll add this later)
- No 90-day currency tracking yet
- No Excel import functionality yet
- No multi-user support
- No password reset flows

CONTEXT:
I'm a helicopter pilot (AS350, B206, Bell 212) with a homelab running Proxmox, TrueNAS, and various Docker containers. I use nginx reverse proxy with Cloudflare Tunnel for external access. I currently track flights in an Excel spreadsheet but want something more accessible on mobile for field entry.

Please build this as a working, production-ready application that I can deploy immediately. Focus on simplicity and reliability over features.

---

## DEVELOPMENT PROGRESS

Last updated: 2026-11-10

### ✅ COMPLETED - PRODUCTION-READY APPLICATION WITH ENHANCED FEATURES!

**Project Structure:**
```
/logbook
  ├── Dockerfile                    # Production Docker container
  ├── docker-compose.yml            # Easy deployment configuration
  ├── package.json                  # Node.js dependencies
  ├── README.md                     # Comprehensive documentation
  ├── CLAUDE.md                     # This file - project status
  ├── .dockerignore                 # Docker build exclusions
  ├── .gitignore                    # Git exclusions
  ├── /data                         # SQLite database volume (created at runtime)
  │   └── logbook.db               # SQLite database file
  └── /src
      ├── server.js                 # Express server entry point
      ├── /models
      │   └── database.js          # SQLite schema & initialization
      ├── /middleware
      │   └── auth.js              # Authentication middleware
      ├── /routes
      │   ├── auth.js              # Login/logout endpoints
      │   ├── flights.js           # Flight CRUD & stats endpoints
      │   ├── aircraft.js          # Custom aircraft management
      │   ├── custom-fields.js     # Custom hour fields management
      │   ├── tags.js              # Quick-insert tags management
      │   ├── preferences.js       # User dashboard preferences
      │   └── pdf-export.js        # PDF logbook export endpoint
      ├── /lib
      │   └── pdf-generator.js     # PDF generation logic (pdfkit)
      └── /public
          ├── login.html           # Login page
          ├── dashboard.html       # Dashboard/home page
          ├── add-flight.html      # Add flight form
          ├── edit-flight.html     # Edit flight form
          ├── flights.html         # Flight list/search
          ├── aircraft.html        # Aircraft management
          ├── /css
          │   └── styles.css       # Mobile-responsive styling
          └── /js
              ├── login.js         # Login functionality
              ├── dashboard.js     # Dashboard stats & recent flights
              ├── flight-form.js   # Add/edit flight logic
              ├── flights-list.js  # Flight list & filtering
              └── aircraft.js      # Aircraft management UI
```

**Backend (100% Complete):**
- ✅ Project structure created with proper directory layout
- ✅ package.json with all required dependencies (express, better-sqlite3, bcrypt, express-session, body-parser)
- ✅ Database schema (src/models/database.js):
  - Users table with bcrypt password hashing
  - Flights table with all required fields including specialty hour tracking
  - Aircraft_types table for custom aircraft management
  - Indexes on date and aircraft_type for performance
  - Auto-initialization on first run with schema migrations
  - Default admin user creation from env variables
  - Support for specialty hours: longline_hours, mountain_hours, instructor_hours, crosscountry_hours, night_vision_hours, instrument_hours, simulated_instrument_hours, ground_instrument_hours (decimal fields)
  - Aircraft category field: Helicopter, Aeroplane, or Simulator
  - Engine type field: Single Engine or Multi Engine
- ✅ Authentication middleware (src/middleware/auth.js):
  - requireAuth for protected routes
  - redirectIfAuthenticated for login page
  - Session validation
- ✅ Auth routes (src/routes/auth.js):
  - POST /api/auth/login
  - POST /api/auth/logout
  - GET /api/auth/me (session check)
- ✅ Flight routes (src/routes/flights.js):
  - GET /api/flights (with pagination and aircraft filtering)
  - GET /api/flights/:id (returns complete flight details)
  - POST /api/flights (with validation, supports all specialty hours and engine type)
  - PUT /api/flights/:id (with validation, supports all specialty hours and engine type)
  - DELETE /api/flights/:id (with user authorization check)
  - GET /api/flights/stats/summary (dashboard stats with day/night/dual/PIC breakdown)
  - GET /api/flights/export/csv (CSV export with all fields including specialty hours, engine type, and aircraft category)
  - GET /api/flights/export/summary (comprehensive experience summary export as text file)
- ✅ Aircraft routes (src/routes/aircraft.js):
  - GET /api/aircraft (list custom aircraft types)
  - POST /api/aircraft (add new aircraft type)
  - PUT /api/aircraft/:id (rename aircraft type with batch flight update)
  - DELETE /api/aircraft/:id (delete with usage validation)
- ✅ Tags routes (src/routes/tags.js):
  - GET /api/tags (list user's custom tags)
  - POST /api/tags (add new tag, max 10 per user)
  - DELETE /api/tags/:id (delete tag)
- ✅ Express server (src/server.js):
  - Session management with express-session
  - Static file serving
  - Route protection
  - Error handling
  - Configured to run on port 3000
  - Aircraft management routes registered

**Frontend (100% Complete):**
- ✅ Login page HTML (src/public/login.html) - Session-based authentication
- ✅ Dashboard HTML (src/public/dashboard.html) - Stats overview, recent flights, quick actions
- ✅ Add Flight form HTML (src/public/add-flight.html) - Complete flight entry with all specialty hours
- ✅ Flight List view HTML (src/public/flights.html) - Searchable, filterable, paginated flight log
- ✅ Edit Flight form HTML (src/public/edit-flight.html) - Full edit capability with specialty hours
- ✅ Aircraft Management page HTML (src/public/aircraft.html) - CRUD for custom aircraft types

**Navigation Structure:**
- Dashboard (home page after login)
- Add Flight (quick entry form)
- View Flights (searchable table with edit/delete)
- Aircraft (manage custom aircraft types)
- Logout

**CSS & JavaScript (100% Complete):**
- ✅ Mobile-responsive CSS stylesheet (src/public/css/styles.css)
  - Clean, professional design
  - Mobile-first responsive layout
  - Dark mode support (automatic based on system preference)
  - Professional color scheme
  - Print styles
  - Custom styles for aircraft management
- ✅ Login JavaScript (src/public/js/login.js)
- ✅ Dashboard JavaScript (src/public/js/dashboard.js)
- ✅ Flight form JavaScript (src/public/js/flight-form.js)
  - Handles both add and edit modes
  - Dynamic aircraft type loading from API (combines defaults with custom types)
  - Aircraft category selection (Helicopter, Aeroplane, Simulator)
  - Custom specialty hour fields loaded from user-defined custom fields
  - Fixed pattern validation (step="any" for decimal inputs)
  - Real-time validation feedback for day/night hours vs total flight time
  - Duplicate mode support (pre-populates form from existing flight)
  - "Self" quick-select buttons for PIC and Co-pilot fields
- ✅ Flights list JavaScript (src/public/js/flights-list.js)
  - Dynamic aircraft filter dropdown
  - Duplicate flight functionality
- ✅ Aircraft management JavaScript (src/public/js/aircraft.js) - NEW!

**Docker Deployment (100% Complete):**
- ✅ Dockerfile with multi-stage optimization
- ✅ docker-compose.yml with volume persistence
- ✅ Health checks configured
- ✅ Environment variable configuration
- ✅ Non-root user for security
- ✅ Volume mount for /data directory

**Documentation (100% Complete):**
- ✅ Comprehensive README.md with:
  - Quick start guide
  - Detailed installation instructions
  - Environment variables documentation
  - Backup and restore procedures
  - Deployment options (local, reverse proxy, Cloudflare Tunnel)
  - Troubleshooting section
  - Database schema documentation
  - Security considerations
  - Update procedures

**Validation & Features:**
- ✅ Date cannot be in the future
- ✅ Flight time must be > 0
- ✅ Day + Night hours validation with warning
- ✅ Required fields enforced (Date, Aircraft Type, Flight Time only - Registration and PIC are optional)
- ✅ SQL injection prevention with prepared statements
- ✅ CSV export functionality
- ✅ Pagination (20 entries per page)
- ✅ Aircraft type filtering (dynamic from database)
- ✅ Delete confirmation modals
- ✅ Mobile-responsive navigation
- ✅ Session-based authentication
- ✅ Error handling and user feedback
- ✅ Aircraft category selection (Helicopter, Aeroplane, Simulator) - tracked with every flight
- ✅ Engine type selection (Single Engine, Multi Engine) - mutually exclusive radio buttons
- ✅ Custom specialty hour fields (user-defined via Settings > Custom Fields, no hardcoded defaults)
- ✅ Custom aircraft type management (add/remove aircraft types via dedicated Aircraft page)
- ✅ Dynamic aircraft dropdowns (combines defaults with custom types from database)
- ✅ Protection against deleting aircraft types that are in use (shows usage count)
- ✅ Fixed decimal input validation (step="any" for all numeric fields)
- ✅ CSV export includes user-defined custom fields, aircraft category, and engine type (legacy specialty columns removed)
- ✅ Summary export provides comprehensive experience totals organized by category, engine type, aircraft type, and operation type
- ✅ Ground Time tracking: Simulator flights accumulate separately and don't count toward flight totals

### DEPLOYMENT INSTRUCTIONS:

1. **Set up environment variables** (REQUIRED):
   ```bash
   # Create .env file from template
   cp .env.example .env

   # Generate secure session secret
   openssl rand -hex 32
   # or: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # Edit .env and configure ALL required variables:
   nano .env  # or use your preferred editor

   # Required settings:
   # - SESSION_SECRET (generate with command above)
   # - ADMIN_USERNAME (your username)
   # - ADMIN_PASSWORD (your secure password)
   # - TRUST_PROXY (false for direct access, true for reverse proxy)
   # - HOST_PORT, PORT, TZ, DATA_PATH, CONTAINER_NAME
   ```

2. **Create data directory**:
   ```bash
   mkdir -p data
   ```

3. **Start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Direct access: http://localhost:3000 (or your configured HOST_PORT)
   - Behind reverse proxy: https://your-domain.com
   - Login with your credentials from `.env`
   - **CHANGE DEFAULT PASSWORD IMMEDIATELY IN SETTINGS!**

**Important for ARM platforms (Raspberry Pi, Mac M1/M2):**
- Ensure `TRUST_PROXY=false` in `.env` if accessing directly over HTTP
- Setting `TRUST_PROXY=true` without a reverse proxy will cause 401 authentication errors
- See README.md "Reverse Proxy Configuration" section for details

### READY TO USE:

The application is **production-ready** and can be deployed immediately. All core requirements and additional enhancements have been implemented:

**Core Features:**
✅ Flight entry with all required fields (Date, Aircraft Type, Flight Time)
✅ Optional fields (Registration, PIC, Co-pilot, Route, etc.)
✅ Flight list with filtering, pagination, edit, and delete
✅ Dashboard with statistics and recent flights
✅ CSV export functionality
✅ Mobile-responsive design
✅ Dark mode support (automatic)
✅ Session-based authentication
✅ Docker containerization
✅ Complete documentation

**Enhanced Features:**
✅ **Aircraft Category Selection**: Classify flights as Helicopter, Aeroplane, or Simulator
✅ **Engine Type Tracking**: Classify as Single Engine or Multi Engine (mutually exclusive)
✅ **User-Defined Specialty Hours**: Create unlimited custom specialty hour fields via Settings > Custom Fields
✅ **Summary Export**: Export a comprehensive experience summary showing totals for all tracked variables (total hours, specialty hours, by aircraft category, by engine type, by aircraft type, takeoffs/landings)
✅ **Custom Aircraft Management**: Add/remove your own aircraft types (e.g., AS350B3+, Bell 407, Cessna 172) via dedicated Aircraft management page
✅ **Dynamic Dropdowns**: Aircraft lists automatically combine defaults with your custom types
✅ **Enhanced Dashboard Stats**: Displays Total Hours, Total Flights, Day/Night breakdown, Dual/PIC breakdown, Hours by Aircraft Type, and Recent Flights
✅ **Smart Validation**: Only Date, Aircraft Type, and Flight Time are required (Registration, PIC, and other fields are optional)
✅ **Usage Protection**: Cannot delete aircraft types that are used in existing flights
✅ **Decimal Input Support**: All hour fields accept any decimal value (fixed pattern validation issues)
✅ **Custom Tags**: Create up to 10 quick-insert tags in Settings that appear as clickable buttons on flight entry forms - clicking adds tag name to flight details
✅ **"Self" Quick-Select**: PIC and Co-pilot fields have a "Self" button for quick entry
✅ **Duplicate Flight**: One-click duplication of flight entries from View Flights page
✅ **User-Defined Custom Fields**: All specialty hour fields are now user-defined (no hardcoded defaults)
✅ **PDF Export**: Professional aviation logbook PDF export with two-page spreads, running totals, custom fields, and signature lines
✅ **Ground Time Tracking**: Simulator flights tracked separately as "Ground Time" - not counted in flight totals but displayed on dashboard and all exports
✅ **Editable User-Defined Fields**: Rename aircraft types and custom fields with automatic batch updates to associated flights
✅ **Departure/Arrival Locations**: Optional fields for flight origin and destination (CSV export only)
✅ **Dashboard Display Settings**: Customize dashboard by toggling charts and custom field visibility

### NOTES:
- Default credentials: username=admin, password=changeme (CHANGE IMMEDIATELY!)
- Database auto-initializes on first run with automatic schema migrations
- All data persists in ./data/logbook.db
- Application runs on port 3000 by default
- Backup instructions included in README.md
- Suitable for immediate deployment to homelab
- Default aircraft types: R22, R44, AS350B2, AS350B3, H125, B206, Bell 212
- Add your own aircraft types via the Aircraft management page

### RECENT ENHANCEMENTS:

**2026-11-10 (v1.8.0) - Hardening & deployment review (Alfred/Hermes):**
1. **Auth/pages**: HTML pages were served by `express.static` *before* the auth check, so `/dashboard.html`, `/flights.html` etc. loaded unauthenticated (API calls then 401'd). Session middleware now runs first and every `*.html` except login redirects to `/login.html` when signed out. Frontend `checkAuth()` also fixed (it checked `response.ok` but `/api/auth/me` always returns 200; now checks `authenticated`).
2. **Persistent sessions**: replaced express-session's MemoryStore (leaks, loses logins on every restart) with a SQLite-backed store in the same DB (`src/lib/session-store.js`, `sessions` table). Cookie renamed `logbook.sid`, rolling expiry.
3. **Change password**: new `POST /api/auth/change-password` + Settings > **Account** tab. Invalidates other sessions. Previously there was no way to change the password at all after first run.
4. **Backup**: `GET /api/backup/db` (SQLite online backup API) + download button on the Account tab.
5. **Database**: WAL journal mode, `busy_timeout`, `synchronous=NORMAL`; migrations rewritten as a table-driven `addColumnIfMissing` (no more try/catch-per-column); index on `custom_field_values(flight_id)`; graceful SIGTERM shutdown with WAL checkpoint.
6. **Validation**: date must be a real `YYYY-MM-DD` calendar date; hours/counts must be non-negative numbers; a single (non-prime) entry is capped at 24 h; `aircraft_category` / `engine_type` restricted to known values; custom field ids are validated against the user's own fields (previously any id was accepted). Flight create/update + custom field writes now run in one transaction.
7. **CSV export**: every field is RFC-4180 escaped (previously only Flight Details was quoted, so a comma in Registration/PIC/route broke the row) and leading `=+-@` are neutralised against spreadsheet formula injection.
8. **Security headers**: helmet now applies to all responses (pages included), CSP allows Chart.js from jsDelivr and the app's inline `onclick` handlers (`script-src-attr 'unsafe-inline'`, helmet's default of `'none'` breaks every button). COOP disabled (plain-HTTP LAN noise).
9. **Rate limiting**: API limit raised 100 → 600 per 15 min (a single page load issues several calls; 100 could trip on normal use). Login limit 5 → 10. New `/healthz` endpoint outside the limiter for health checks (Docker healthcheck updated).
10. **Dependencies**: Node 18 (EOL) → 22 in the Dockerfile; `better-sqlite3` ^9 → ^12 and `bcrypt` ^5 → ^6 (no prebuilt binaries for Node 22 on the old versions); `npm audit fix` → 0 vulnerabilities. `npm ci --omit=dev` in the image.
11. **Initial password**: if `ADMIN_PASSWORD` is unset a random one is generated and logged once instead of defaulting to `changeme`. Dockerfile no longer bakes in default secrets.
12. **Tests**: `npm test` runs `test/smoke.test.js` — boots the server on a temp DB and exercises login, page protection, CSP, validation, create/update/delete, stats, CSV/PDF/summary exports, backup download, password change, and session persistence.
13. **Minor**: flight list no longer returns dead `day_hours/night_hours` columns (returns `aircraft_category`, `departure`, `arrival` instead); pagination clamped (1–200); unknown `/api/*` routes return JSON 404; `x-powered-by` removed.

**Homelab deployment**: runs natively (no Docker) in Proxmox LXC 180 `pilots-logbook` (192.168.4.111:3000), systemd `pilots-logbook.service`, app in `/opt/pilots-logbook`, data in `/var/lib/pilots-logbook/data`, env in `/etc/pilots-logbook.env`, nightly SQLite snapshot timer → `/var/lib/pilots-logbook/backups` (30-day retention), LXC included in the nightly PBS backup job. Details in `/root/CLAUDE.md` inside the LXC.

**2026-01-24 (Latest Update - v1.7.0):**
1. **Dashboard Display Settings**:
   - New "Dashboard" tab in Settings page
   - Toggle visibility of dashboard charts: Hours Over Time, Hours by Aircraft, Monthly Activity
   - Toggle visibility of custom experience fields on dashboard
   - User preferences stored in new `user_preferences` table
   - New `/api/preferences` endpoint (GET/PUT) for saving dashboard configuration
   - Dashboard respects user preferences and filters charts/custom fields accordingly
   - Preferences persist across sessions

2. **Environment Variable Configuration Changes**:
   - Removed inline default values from `docker-compose.yml`
   - All environment variables (except DB_PATH) now require explicit definition in `.env` file
   - Users must copy `.env.example` to `.env` and configure all settings
   - Enforces explicit configuration and prevents accidental deployment with defaults
   - **IMPORTANT**: Existing deployments must create `.env` file before updating

3. **Documentation Improvements**:
   - Added screenshots to repository showing Dashboard, Add Flight, View Flights, and Settings pages
   - Added PDF export example (`screenshots/pdf-sample.pdf`) demonstrating logbook output
   - Enhanced README.md with reverse proxy configuration examples

**2026-01-18 (v1.6.0):**
1. **Editable User-Defined Fields**:
   - Aircraft types can now be renamed via Settings > Aircraft Types > Edit button
   - Renaming an aircraft type automatically updates all associated flights (batch update in transaction)
   - Custom fields can be renamed via Settings > Custom Fields > Edit button
   - Edit modals with form validation and error handling
2. **Departure/Arrival Location Fields**:
   - Added optional departure and arrival text fields to flight entry forms
   - Fields appear in CSV export only (not displayed in flight list table)
   - Auto-uppercase input for consistency
3. **PDF Export Improvements**:
   - Fixed page overflow by reducing rows per spread from 24 to 22
   - Reorganized footer layout to prevent totals overlapping with signature section
   - Footer now displays in compact 2x2 grid (Aeroplane/Helicopter, Simulator/Grand Total)
   - Signature and date lines now use proper drawn lines instead of underscores
   - Extended Date column vertical line to touch top horizontal border
   - Fixed page number positioning to prevent extra blank pages
   - Page numbers now appear in bottom left corner

**2026-01-17 (v1.5.1):**
1. **PDF Export SIM TIME Column**:
   - Added dedicated "SIM TIME" column (column 16) to PDF export Page B
   - Displays flight hours only for simulator flights (aircraft_category = 'Simulator')
   - Custom field columns shifted to positions 17-19 (from 16-18)
   - Running totals include simulator time accumulation
   - Clean separation of simulator training time in professional logbook format

**2026-01-17 (Earlier - v1.5.0):**
1. **Ground Time Tracking for Simulator Flights**:
   - Simulator flights now accumulate in a separate "Ground Time" statistic
   - Simulator time does NOT count toward Total Flight Hours, Day/Night hours, PIC/Dual hours, or flight counts
   - User-defined custom fields still work for simulator flights and count in their respective totals
   - Ground Time displayed on Dashboard with dedicated stat card
   - Ground Time included in Summary export
   - PDF export already correctly excludes simulator from grand total (displays as "Simulator (not in total)")
   - Aircraft breakdown shows simulator entries with "(Sim)" suffix and "sessions" instead of "flights"

2. **CSV Export Cleanup**:
   - Removed 8 legacy specialty hour columns (Longline, Mountain, Instructor, Cross-Country, Night Vision, Instrument, Simulated Instrument, Ground Instrument)
   - User-defined custom fields are still dynamically included in CSV export
   - Cleaner export format without unused legacy columns

**2026-01-17 (Earlier - v1.4.0):**
1. **PDF Export Feature**: Professional aviation logbook PDF export
   - Two-page spread format (Page A: flight details, Page B: hours breakdown)
   - A4 landscape layout with fixed 24 rows per page
   - Alternating row shading for readability
   - Running totals carried forward across page spreads
   - Footer totals: Aeroplane, Helicopter, Simulator (not in total), Grand Total
   - Signature and certification lines
   - Custom field columns (up to 3 user-defined fields in columns 17-19)
   - SIM TIME column (column 16) for simulator flights
   - Hours breakdown by engine type (Single-Engine vs Multi-Engine)
   - Instrument time tracking (Actual, Simulated, Ground)
   - Page numbering: "Page 1a of N" / "Page 1b of N"
   - Access via View Flights > "Export to PDF" button

**2026-01-15 (v1.3.0):**
1. **User-Defined Custom Fields Only**: Removed hardcoded "Default Specialty Fields" section
   - All specialty hour fields are now user-defined via Settings > Custom Fields
   - Previously hardcoded fields (Longline, Mountain, Instructor, etc.) removed from flight forms
   - Users create their own custom fields as needed
   - Legacy database columns remain for backwards compatibility (data ignored)
   - Reserved field name restriction removed - users can use any field name
2. **Tags Insert Plain Text**: Tags now insert as plain text instead of `#TagName`
3. **"Self" Quick-Select Buttons**: Added "Self" button next to PIC and Co-pilot fields for quick entry
4. **Duplicate Flight Feature**: New "Dup" button on View Flights page to duplicate entries
   - Opens Add Flight form pre-populated with flight data
   - Date defaults to today (not the original flight's date)
5. **Removed "Type" Column**: Removed legacy flight_type column from View Flights table

**2026-01-15 (Earlier - v1.2.13):**
1. **Custom Tags Feature**: New Tags management in Settings page
   - Create up to 10 custom tags (e.g., Training, CheckRide, Sightseeing)
   - Tags appear as clickable buttons below Flight Details/Route field on Add Flight and Edit Flight forms
   - Tag names support letters, numbers, underscores, and hyphens (no spaces)
   - Full CRUD management with delete confirmation modals
   - Tags stored in new `tags` database table
2. **Aircraft Delete Fix** (v1.2.12): Fixed aircraft delete button not working due to datetime format parsing issue and window function scope

**2026-01-14 (v1.2.7):**
1. **Prime Logbook Auto-Calculate Total** (v1.2.5): Removed manual total hours input, now auto-calculates from breakdown fields like Add Flight form
2. **Prime Entries Excluded from Flight Counts** (v1.2.6): Prime entries contribute hours but don't count as flights in statistics
3. **CSV Export Spelling Fix** (v1.2.7): Fixed "Commanded Practice" to "Command Practice" in CSV headers
4. **Screenshots Added**: Added screenshots to README showing Dashboard, Add Flight, View Flights, and Settings pages

**2026-01-14 (Earlier - v1.2.4):**
1. **Prime Logbook Form Updated**: Settings page Prime Logbook tab now uses the same 8-field breakdown structure as flight entry
   - Replaced old fields (Day Hours, Night Hours, Dual Hours, PIC Hours, Solo Hours) with new breakdown fields
   - Now includes: Day PIC, Night PIC, Day Dual, Night Dual, Day SIC, Night SIC, Day Comm'd Practice, Night Comm'd Practice
   - JavaScript updated to calculate total flight time from breakdown fields automatically
   - Maintains consistency across all flight entry points (Add Flight, Edit Flight, Prime Logbook)
   - Prime entries still marked with "=== LOGBOOK PRIME ENTRY ===" in route field for identification

**2026-01-14 (Earlier - v1.2.2):**
1. **Complete Flight Time Breakdown Implementation**: Full restructuring of flight time tracking system
   - Removed single `flight_time` input field and `flight_type` radio buttons (legacy approach)
   - Implemented 8 detailed breakdown fields: Day PIC, Night PIC, Day Dual, Night Dual, Day SIC, Night SIC, Day Command Practice, Night Command Practice
   - Total flight time now auto-calculates from breakdown fields in real-time
   - **BREAKING CHANGE**: Completely removed `flight_type` field from database schema (no longer NOT NULL)
   - Removed `flight_type` from all INSERT/UPDATE operations
   - Removed `flight_type` from all SELECT queries (GET endpoints)
   - Database schema now has NO dependency on legacy `flight_type` field
   - Validation now requires Date, Aircraft Type, and at least one flight time breakdown field (total must be > 0)
   - Updated dashboard statistics to use new breakdown fields (PIC, Dual, SIC calculations)
   - CSV export updated to include all 8 breakdown columns
   - Summary export formatting standardized (removed indentation/sub-bullets, all fields now use consistent format)
   - Fixed typo in export: "Commanded Practice" changed to "Command Practice"
2. **Visual Improvements**:
   - Separated "Takeoffs & Landings" section from "Special Operations" section for clarity
   - Added clarification that special operations hours do NOT count towards total flight time
   - Real-time display of calculated total flight time as user enters breakdown values
   - Form shows breakdown fields with clear labels and placeholders
3. **Database Cleanup**:
   - Fresh databases no longer create `flight_type` column
   - Existing databases can migrate by simply updating to latest image (field becomes unused but harmless)
   - All queries work without `flight_type` - completely decoupled from application logic

**2026-01-13 (Evening):**
1. **Docker Health Check Fix**: Fixed container health check in docker-compose.yml
   - Changed `localhost` to `127.0.0.1` for IPv4 compatibility (prevents IPv6 ECONNREFUSED errors)
   - Updated expected status code from 401 to 200 to match actual `/api/auth/me` endpoint behavior
   - Container now correctly reports as "healthy" when application is running
   - Resolved SQLite database permission errors by setting proper permissions on data directory

**2026-01-13 (Afternoon):**
1. **Ground Instrument Hours**: Added 8th specialty hour field for ground instrument training time
2. **Engine Type Selection**: Added Single Engine vs Multi Engine radio button classification (mutually exclusive)
3. **Summary Export Feature**: New export that provides comprehensive experience totals:
   - Total flights and hours
   - Day/Night/Dual/PIC/Solo breakdowns
   - All 8 specialty hour totals (longline, mountain, instructor, cross-country, night vision, instrument, simulated instrument, ground instrument)
   - Totals by aircraft category (Helicopter, Aeroplane, Simulator)
   - Totals by engine type (Single Engine, Multi Engine)
   - Totals by aircraft type (R22, AS350B2, etc.)
   - Takeoffs and landings totals
4. **Enhanced CSV Export**: CSV now includes engine type field
5. **Public Release**: Made GitHub repository public and published Docker image to GitHub Container Registry

**2026-01-13 (Morning):**
1. **Aircraft Category Selection**: Added ability to classify flights as Helicopter, Aeroplane, or Simulator with radio button selection
2. **Expanded Specialty Hours**: Added three new specialty hour fields:
   - Night Vision hours
   - Instrument hours
   - Simulated Instrument hours
3. **Enhanced CSV Export**: CSV exports now include aircraft category and all specialty hour fields
4. **Database Migration**: Automatic schema migration adds new columns to existing databases without data loss

**2026-01-13 (Previous Updates):**
1. **Specialty Operations as Hours**: Changed from checkboxes to decimal hour inputs for longline, mountain, instructor, and cross-country time
2. **Aircraft Management Page**: Full CRUD interface for managing custom aircraft types with usage validation
3. **Dynamic Aircraft Dropdowns**: Flight forms and filters now load aircraft from database (combines default types with custom additions)
4. **Enhanced Dashboard**: Added Day/Night/Dual/PIC hour breakdowns alongside total hours and aircraft-specific statistics
5. **Fixed Validation Issues**: Resolved "pattern mismatch" errors on decimal inputs by using step="any"
6. **Optional Fields**: Made Registration and PIC optional (only Date, Aircraft Type, and Flight Time are required)

---

## DATABASE SCHEMA REFERENCE

### Flight Entry Fields (All fields available in flights table):

**Required Fields:**
- `date` (DATE) - Flight date, cannot be in future
- `aircraft_type` (TEXT) - Aircraft model (dropdown with defaults + custom)
- `flight_time_hours` (REAL) - Total flight hours (auto-calculated from breakdown fields, must be > 0)

**Optional Core Fields:**
- `aircraft_category` (TEXT) - Helicopter, Aeroplane, or Simulator (defaults to Helicopter)
- `engine_type` (TEXT) - Single Engine or Multi Engine (defaults to Single Engine)
- `registration` (TEXT) - Aircraft registration/tail number
- `pilot_in_command` (TEXT) - PIC name
- `copilot_student` (TEXT) - Co-pilot or student name
- `flight_details` (TEXT) - Route and flight description
- `departure` (TEXT) - Departure location (CSV export only)
- `arrival` (TEXT) - Arrival location (CSV export only)

**Flight Time Breakdown (at least one required, decimals):**
- `day_pic` (REAL) - Day Pilot in Command hours
- `night_pic` (REAL) - Night Pilot in Command hours
- `day_dual` (REAL) - Day Dual (training/instruction) hours
- `night_dual` (REAL) - Night Dual hours
- `day_sic` (REAL) - Day Second in Command hours
- `night_sic` (REAL) - Night Second in Command hours
- `day_cmnd_practice` (REAL) - Day Commanded Practice hours
- `night_cmnd_practice` (REAL) - Night Commanded Practice hours

**Legacy Fields (retained for backwards compatibility with old databases):**
- `day_hours` (REAL) - Legacy daylight flying time field (replaced by breakdown fields)
- `night_hours` (REAL) - Legacy night flying time field (replaced by breakdown fields)
- `longline_sling` (INTEGER) - Legacy boolean flag (replaced by longline_hours)
- `mountain` (INTEGER) - Legacy boolean flag (replaced by mountain_hours)
- `instructor` (INTEGER) - Legacy boolean flag (replaced by instructor_hours)
- Note: `flight_type` field completely removed from schema as of v1.2.0 (no longer needed)

**Special Operations Hours (Optional, decimals):**
- `longline_hours` (REAL) - Longline/sling operations time
- `mountain_hours` (REAL) - Mountain operations time
- `instructor_hours` (REAL) - Time spent instructing
- `crosscountry_hours` (REAL) - Cross-country flight time
- `night_vision_hours` (REAL) - Night vision operations time
- `instrument_hours` (REAL) - Instrument flight time
- `simulated_instrument_hours` (REAL) - Simulated instrument time
- `ground_instrument_hours` (REAL) - Ground instrument training time

**Operations Counts (Optional, integers):**
- `takeoffs_day` (INTEGER) - Daytime takeoffs
- `takeoffs_night` (INTEGER) - Night takeoffs
- `landings_day` (INTEGER) - Daytime landings
- `landings_night` (INTEGER) - Night landings

**Metadata (Auto-generated):**
- `id` (INTEGER) - Primary key
- `user_id` (INTEGER) - Foreign key to users table
- `created_at` (DATETIME) - Entry creation timestamp
- `updated_at` (DATETIME) - Last modification timestamp
- Legacy boolean flags: `longline_sling`, `mountain`, `instructor` (kept for compatibility)

### Aircraft Types Table:
- `id` (INTEGER) - Primary key
- `user_id` (INTEGER) - Foreign key to users
- `name` (TEXT) - Aircraft type name (unique per user)
- `created_at` (DATETIME) - Creation timestamp

**Default Aircraft Types:** R22, R44, AS350B2, AS350B3, H125, B206, Bell 212
**Custom Types:** Users can add unlimited custom aircraft types via Aircraft management page

### Tags Table:
- `id` (INTEGER) - Primary key
- `user_id` (INTEGER) - Foreign key to users
- `name` (TEXT) - Tag name (unique per user, max 30 chars)
- `created_at` (DATETIME) - Creation timestamp

**Constraints:** Maximum 10 tags per user, names can only contain letters, numbers, underscores, and hyphens

### Users Table:
- `id` (INTEGER) - Primary key
- `username` (TEXT) - Unique username
- `password` (TEXT) - Bcrypt hashed password
- `created_at` (DATETIME) - Account creation timestamp

### User Preferences Table:
- `id` (INTEGER) - Primary key
- `user_id` (INTEGER) - Foreign key to users (unique)
- `dashboard_config` (TEXT) - JSON configuration for dashboard display settings
- `created_at` (DATETIME) - Preference creation timestamp
- `updated_at` (DATETIME) - Last modification timestamp

**Dashboard Config Structure:**
```json
{
  "showHoursOverTime": true,
  "showAircraftChart": true,
  "showMonthlyActivity": true,
  "hiddenCustomFields": [1, 3, 5]
}
```

---

## API ENDPOINTS REFERENCE

### Authentication:
- `POST /api/auth/login` - Login (username, password)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Check session status

### Flights:
- `GET /api/flights` - List flights (pagination, filtering by aircraft_type)
- `GET /api/flights/:id` - Get single flight details
- `POST /api/flights` - Create new flight (with all specialty hours, engine type, and aircraft category)
- `PUT /api/flights/:id` - Update flight (with all specialty hours, engine type, and aircraft category)
- `DELETE /api/flights/:id` - Delete flight
- `GET /api/flights/stats/summary` - Dashboard statistics
- `GET /api/flights/export/csv` - Export all flights to CSV (includes all fields)
- `GET /api/flights/export/summary` - Export experience summary report (totals by all variables)
- `GET /api/flights/export/pdf` - Export professional aviation logbook PDF (optional query: `?fields=1,2,3` for custom field IDs)

### Aircraft:
- `GET /api/aircraft` - List user's custom aircraft types
- `POST /api/aircraft` - Add new aircraft type
- `PUT /api/aircraft/:id` - Rename aircraft type (batch updates all associated flights)
- `DELETE /api/aircraft/:id` - Delete aircraft type (validates no flights using it)

### Tags:
- `GET /api/tags` - List user's custom tags
- `POST /api/tags` - Add new tag (max 10 per user, validates name format)
- `DELETE /api/tags/:id` - Delete tag

### Custom Fields:
- `GET /api/custom-fields` - List user's custom hour fields
- `POST /api/custom-fields` - Create new custom field
- `PUT /api/custom-fields/:id` - Rename custom field label
- `DELETE /api/custom-fields/:id` - Delete custom field (and associated values)

### Preferences:
- `GET /api/preferences` - Get user's dashboard display preferences
- `PUT /api/preferences` - Update dashboard display preferences (chart toggles, hidden custom fields)

---

## DEVELOPMENT WORKFLOW

After making code changes, build and push a new Docker image. The image must support both ARM and x86 architectures (multi-platform build).

### Build and Push Commands:

```bash
# Build and push multi-architecture image (ARM + x86)
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/penguinator13/pilots-logbook:latest --push .
```

### Prerequisites:

1. **Docker Buildx** must be available (comes with Docker Desktop, or install separately)
2. **Authenticate to GitHub Container Registry**:
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u penguinator13 --password-stdin
   ```
3. **Create buildx builder** (one-time setup, if not already done):
   ```bash
   docker buildx create --name multiarch --use
   docker buildx inspect --bootstrap
   ```

### Notes:
- Always build multi-platform to support both homelab servers (x86) and ARM devices (Raspberry Pi, Apple Silicon)
- The `--push` flag builds and pushes in one step (more efficient for multi-arch)
- Image is published to: `ghcr.io/penguinator13/pilots-logbook:latest`

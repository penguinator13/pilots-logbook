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
   - Flight Time Hours (decimal input, e.g., 1.5)
   - Day/Night breakdown (two decimal inputs that should sum to total flight time)
   - Flight Type: Dual, PIC, Solo (radio buttons)
   - Special Operations Hours: Longline/Sling, Mountain, Instructor, Cross-Country, Night Vision, Instrument, Simulated Instrument, Ground Instrument (decimal hour inputs)
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
   - Flight time must be > 0
   - Day + Night hours should equal total flight time (warn if not)
   - Required fields: Date, Aircraft Type, Flight Time

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

Last updated: 2026-01-13

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
      │   └── aircraft.js          # Custom aircraft management
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
  - DELETE /api/aircraft/:id (delete with usage validation)
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
  - Specialty hours tracking (longline, mountain, instructor, cross-country, night vision, instrument, simulated instrument)
  - Fixed pattern validation (step="any" for decimal inputs)
  - Real-time validation feedback for day/night hours vs total flight time
- ✅ Flights list JavaScript (src/public/js/flights-list.js)
  - Dynamic aircraft filter dropdown
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
- ✅ Specialty hours tracking (8 fields: Longline, Mountain, Instructor, Cross-Country, Night Vision, Instrument, Simulated Instrument, Ground Instrument) - decimal hour inputs
- ✅ Custom aircraft type management (add/remove aircraft types via dedicated Aircraft page)
- ✅ Dynamic aircraft dropdowns (combines defaults with custom types from database)
- ✅ Protection against deleting aircraft types that are in use (shows usage count)
- ✅ Fixed decimal input validation (step="any" for all numeric fields)
- ✅ CSV export includes all specialty hours fields, aircraft category, and engine type
- ✅ Summary export provides comprehensive experience totals organized by category, engine type, aircraft type, and operation type

### DEPLOYMENT INSTRUCTIONS:

1. **Set up environment variables** (recommended):
   ```bash
   cat > .env << EOF
   SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   ADMIN_USERNAME=your-username
   ADMIN_PASSWORD=your-secure-password
   EOF
   ```

2. **Create data directory**:
   ```bash
   mkdir -p data
   ```

3. **Build and start the application**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Open browser to http://localhost:3000
   - Login with your credentials (default: admin/changeme)
   - **CHANGE DEFAULT PASSWORD IMMEDIATELY!**

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
✅ **Comprehensive Specialty Hours Tracking**: Track 8 specialty hour types as decimal values: longline, mountain, instructor, cross-country, night vision, instrument, simulated instrument, and ground instrument
✅ **Summary Export**: Export a comprehensive experience summary showing totals for all tracked variables (total hours, specialty hours, by aircraft category, by engine type, by aircraft type, takeoffs/landings)
✅ **Custom Aircraft Management**: Add/remove your own aircraft types (e.g., AS350B3+, Bell 407, Cessna 172) via dedicated Aircraft management page
✅ **Dynamic Dropdowns**: Aircraft lists automatically combine defaults with your custom types
✅ **Enhanced Dashboard Stats**: Displays Total Hours, Total Flights, Day/Night breakdown, Dual/PIC breakdown, Hours by Aircraft Type, and Recent Flights
✅ **Smart Validation**: Only Date, Aircraft Type, and Flight Time are required (Registration, PIC, and other fields are optional)
✅ **Usage Protection**: Cannot delete aircraft types that are used in existing flights
✅ **Decimal Input Support**: All hour fields accept any decimal value (fixed pattern validation issues)

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

**2026-01-13 (Latest Update - Evening):**
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
- `flight_time_hours` (REAL) - Total flight hours (must be > 0)
- `flight_type` (TEXT) - Dual, PIC, or Solo

**Optional Core Fields:**
- `aircraft_category` (TEXT) - Helicopter, Aeroplane, or Simulator (defaults to Helicopter)
- `engine_type` (TEXT) - Single Engine or Multi Engine (defaults to Single Engine)
- `registration` (TEXT) - Aircraft registration/tail number
- `pilot_in_command` (TEXT) - PIC name
- `copilot_student` (TEXT) - Co-pilot or student name
- `flight_details` (TEXT) - Route and flight description

**Time Breakdown (Optional, decimals):**
- `day_hours` (REAL) - Daylight flying time
- `night_hours` (REAL) - Night flying time
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

### Users Table:
- `id` (INTEGER) - Primary key
- `username` (TEXT) - Unique username
- `password` (TEXT) - Bcrypt hashed password
- `created_at` (DATETIME) - Account creation timestamp

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

### Aircraft:
- `GET /api/aircraft` - List user's custom aircraft types
- `POST /api/aircraft` - Add new aircraft type
- `DELETE /api/aircraft/:id` - Delete aircraft type (validates no flights using it)

# Pilot's Logbook

A self-hosted web application for pilots to track and manage their flight hours. Built with simplicity and mobile accessibility in mind.

## Features

- **Flight Entry Management**: Record detailed flight information including aircraft type, registration, route, and flight times
- **Dashboard**: View total flight hours, flight counts, and hours broken down by aircraft type
- **Flight Log**: Browse, search, filter, and manage all flight entries
- **CSV Export**: Export your flight data for backup or external analysis
- **Mobile-Responsive**: Optimized for field entry on mobile devices
- **Dark Mode**: Automatic dark mode support based on system preferences
- **Single User Authentication**: Simple session-based login for personal use

## Supported Aircraft

- R22
- R44
- AS350B2
- AS350B3
- H125
- B206
- Bell 212

## Technology Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (with easy migration path to PostgreSQL)
- **Frontend**: Vanilla HTML/CSS/JavaScript (lightweight, no framework dependencies)
- **Authentication**: Session-based authentication with bcrypt password hashing
- **Container**: Docker + Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose installed on your system
- A Linux/Unix environment (or Windows with WSL2)

### Installation

1. **Clone or download this repository**:
   ```bash
   cd /your/desired/location
   git clone <repository-url> logbook
   cd logbook
   ```

2. **Create a `.env` file** (required for production):
   ```bash
   # Copy the example file
   cp .env.example .env

   # Edit with your settings
   nano .env
   ```

   **Important**: Change these values:
   - `SESSION_SECRET` - Generate with: `openssl rand -hex 32`
   - `ADMIN_USERNAME` - Your desired username
   - `ADMIN_PASSWORD` - Your secure password
   - `HOST_PORT` - Change if port 3000 is already in use

3. **Create the data directory**:
   ```bash
   mkdir -p data
   ```

4. **Build and start the application**:
   ```bash
   docker-compose up -d
   ```

5. **Access the application**:
   - Open your browser and navigate to `http://localhost:3000` (or your configured `HOST_PORT`)
   - Login with your credentials from the `.env` file
   - Start logging flights!

## Configuration

### Environment Variables

All configuration is done through environment variables. Create a `.env` file (use `.env.example` as a template):

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Secret key for session encryption | (required - change this!) |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `changeme` |
| `PORT` | Internal application port | `3000` |
| `HOST_PORT` | External port to access app | `3000` |
| `DB_PATH` | Path to SQLite database (inside container) | `/app/data/logbook.db` |
| `DATA_PATH` | Path to data directory on host | `./data` |
| `CONTAINER_NAME` | Docker container name | `pilots-logbook` |

### Port Configuration

To use a different port (e.g., if 3000 is already in use), set in your `.env` file:

```bash
HOST_PORT=8080  # Access via http://localhost:8080
PORT=3000       # Internal container port (usually leave as 3000)
```

Then restart: `docker-compose down && docker-compose up -d`

## Usage

### Adding a Flight

1. Click **Add Flight** in the navigation
2. Fill out the flight details:
   - **Required**: Date, Aircraft Type, Flight Time
   - **Optional**: Registration, Pilot names, Route, Day/Night breakdown, etc.
3. Click **Add Flight** to save

### Viewing Flights

1. Click **View Flights** in the navigation
2. Use the aircraft filter to narrow down results
3. Click **Edit** to modify a flight entry
4. Click **Delete** to remove a flight entry (with confirmation)

### Exporting Data

1. Go to **View Flights**
2. Optionally filter by aircraft type
3. Click **Export to CSV** to download your flight data

### Dashboard

The dashboard shows:
- Total flight hours (all time)
- Total number of flights
- Day vs Night hours breakdown
- Hours by aircraft type
- Recent 10 flights

## Backup & Restore

### Backing Up Your Data

The entire flight database is stored in a single SQLite file: `./data/logbook.db`

**Manual Backup**:
```bash
# Copy the database file
cp ./data/logbook.db ./data/logbook.db.backup

# Or create a timestamped backup
cp ./data/logbook.db "./data/logbook.db.backup.$(date +%Y%m%d_%H%M%S)"
```

**Automated Backup** (using cron):
```bash
# Add to crontab
0 2 * * * cp /path/to/logbook/data/logbook.db /path/to/backups/logbook.db.$(date +\%Y\%m\%d)
```

### Restoring from Backup

```bash
# Stop the application
docker-compose down

# Restore the database
cp ./data/logbook.db.backup ./data/logbook.db

# Start the application
docker-compose up -d
```

### Offsite Backup

Consider backing up to TrueNAS, cloud storage, or another system:

```bash
# Example: Copy to TrueNAS share
cp ./data/logbook.db /mnt/truenas/backups/logbook/logbook.db.$(date +%Y%m%d)
```

## Deployment Options

### Local Network Access

The application is accessible on your local network at `http://[server-ip]:3000`

### Reverse Proxy with Nginx

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name logbook.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Cloudflare Tunnel

1. Install Cloudflare Tunnel on your homelab
2. Create a tunnel pointing to `http://localhost:3000`
3. Access your logbook from anywhere via your Cloudflare domain

### Docker Run (without Docker Compose)

```bash
docker build -t helicopter-logbook .

docker run -d \
  --name helicopter-logbook \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e SESSION_SECRET="your-random-secret" \
  -e ADMIN_USERNAME="your-username" \
  -e ADMIN_PASSWORD="your-password" \
  --restart unless-stopped \
  helicopter-logbook
```

## Updating the Application

```bash
# Pull the latest changes (if using git)
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

Your data in `./data/logbook.db` will be preserved.

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker-compose logs -f
```

### Can't login

1. Check your credentials in the `.env` file or `docker-compose.yml`
2. The default credentials are `admin` / `changeme`
3. Rebuild the container if you changed credentials:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### Database is locked

This usually happens if the container didn't shut down cleanly:
```bash
docker-compose down
docker-compose up -d
```

### Permission errors with data directory

Ensure the data directory is writable:
```bash
chmod 777 ./data
```

## Database Schema

The application uses SQLite with the following tables:

### Users Table
- `id`: Primary key
- `username`: Unique username
- `password`: Bcrypt hashed password
- `created_at`: Account creation timestamp

### Flights Table
- `id`: Primary key
- `date`: Flight date
- `aircraft_type`: Aircraft model
- `registration`: Aircraft registration
- `pic`: Pilot in command name
- `copilot`: Co-pilot/student name
- `route`: Flight route/details
- `flight_time`: Total flight hours
- `day_hours`: Day flying hours
- `night_hours`: Night flying hours
- `flight_type`: Dual, PIC, or Solo
- `longline`: Longline/sling operations flag
- `mountain`: Mountain operations flag
- `instructor`: Instructor role flag
- `takeoffs_day`: Day takeoffs count
- `takeoffs_night`: Night takeoffs count
- `landings_day`: Day landings count
- `landings_night`: Night landings count
- `created_at`: Entry creation timestamp

## Security Considerations

1. **Change default credentials** immediately
2. **Use a strong SESSION_SECRET** (at least 32 random characters)
3. **Use HTTPS** if exposing to the internet (via reverse proxy)
4. **Regular backups** of the database file
5. **Keep Docker images updated** for security patches
6. **Limit network access** if only used locally

## Future Enhancements (Not Yet Implemented)

- 90-day currency tracking
- Advanced reporting and analytics
- Excel import functionality
- Multi-user support
- Password reset functionality
- PostgreSQL migration option

## Support

For issues, questions, or contributions, please open an issue in the repository.

## License

This project is provided as-is for personal use.

---

**Built for helicopter pilots who value simplicity and reliability.**

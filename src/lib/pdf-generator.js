/**
 * PDF Logbook Generator
 * Generates professional aviation logbook format PDFs with two-page spreads
 */

const PDFDocument = require('pdfkit');

class LogbookPDFGenerator {
  constructor(options = {}) {
    this.rowsPerSpread = options.rowsPerSpread || 24;  // Fixed 24 rows per page
    this.customFields = options.customFields || [];

    // A4 Landscape dimensions in points
    this.pageWidth = 841.89;
    this.pageHeight = 595.28;

    // Margins
    this.marginTop = 40;
    this.marginBottom = 40;
    this.marginLeft = 50;
    this.marginRight = 50;

    // Layout constants
    this.rowHeight = 17;  // Slightly taller rows for better readability
    this.headerHeight = 80;
    this.footerHeight = 60;

    // Page A column widths (flight details)
    this.pageAColumns = {
      date: 55,
      type: 50,
      registration: 60,
      pic: 95,
      copilot: 95,
      details: 0 // Calculated as remaining space
    };

    // Calculate details column width
    const usedWidth = Object.values(this.pageAColumns).reduce((a, b) => a + b, 0);
    const availableWidth = this.pageWidth - this.marginLeft - this.marginRight;
    this.pageAColumns.details = availableWidth - usedWidth;

    // Page B column widths (hours breakdown) - 15 fixed + up to 3 custom
    this.pageBColumnWidth = 43; // Each numeric column
  }

  /**
   * Generate the complete PDF document
   * @param {Array} flights - Array of flight objects
   * @returns {PDFDocument} - The PDF document stream
   */
  generate(flights) {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      autoFirstPage: false,
      margins: {
        top: this.marginTop,
        bottom: this.marginBottom,
        left: this.marginLeft,
        right: this.marginRight
      }
    });

    if (flights.length === 0) {
      doc.addPage();
      doc.fontSize(14).text('No flights to export', 100, 100);
      return doc;
    }

    // Calculate total spreads needed
    const totalSpreads = Math.ceil(flights.length / this.rowsPerSpread);

    // Running totals
    let runningTotals = this.initializeTotals();

    // Process flights in chunks
    for (let spreadIndex = 0; spreadIndex < totalSpreads; spreadIndex++) {
      const startIdx = spreadIndex * this.rowsPerSpread;
      const spreadFlights = flights.slice(startIdx, startIdx + this.rowsPerSpread);

      // Get year from first flight in spread
      const year = this.getYear(spreadFlights[0].date);

      // Draw Page A (left side - flight details)
      doc.addPage();
      this.drawPageA(doc, spreadFlights, year, spreadIndex + 1, totalSpreads, runningTotals);

      // Draw Page B (right side - hours breakdown)
      doc.addPage();
      this.drawPageB(doc, spreadFlights, spreadIndex + 1, totalSpreads, runningTotals);

      // Update running totals for next spread
      runningTotals = this.calculateTotals(spreadFlights, runningTotals);
    }

    return doc;
  }

  /**
   * Initialize totals object with all fields set to 0
   */
  initializeTotals() {
    const totals = {
      // Single-engine
      se_day_dual: 0,
      se_day_pic: 0,
      se_night_dual: 0,
      se_night_pic: 0,
      // Multi-engine
      me_day_dual: 0,
      me_day_pic: 0,
      me_day_copilot: 0,
      me_day_cmnd: 0,
      me_night_dual: 0,
      me_night_pic: 0,
      me_night_copilot: 0,
      me_night_cmnd: 0,
      // Instrument
      instrument_actual: 0,
      instrument_simulated: 0,
      instrument_ground: 0,
      // Category totals
      helicopter_total: 0,
      aeroplane_total: 0,
      simulator_total: 0,
      grand_total: 0  // = helicopter + aeroplane (NOT simulator)
    };

    // Add custom field totals
    this.customFields.forEach(cf => {
      totals[`custom_${cf.id}`] = 0;
    });

    return totals;
  }

  /**
   * Calculate totals from flights and add to running totals
   */
  calculateTotals(flights, previousTotals) {
    const totals = { ...previousTotals };

    flights.forEach(flight => {
      const isSingleEngine = flight.engine_type === 'Single Engine';
      const isMultiEngine = flight.engine_type === 'Multi Engine';

      // Single-engine hours
      if (isSingleEngine) {
        totals.se_day_dual += flight.day_dual || 0;
        totals.se_day_pic += flight.day_pic || 0;
        totals.se_night_dual += flight.night_dual || 0;
        totals.se_night_pic += flight.night_pic || 0;
      }

      // Multi-engine hours
      if (isMultiEngine) {
        totals.me_day_dual += flight.day_dual || 0;
        totals.me_day_pic += flight.day_pic || 0;
        totals.me_day_copilot += flight.day_sic || 0;
        totals.me_day_cmnd += flight.day_cmnd_practice || 0;
        totals.me_night_dual += flight.night_dual || 0;
        totals.me_night_pic += flight.night_pic || 0;
        totals.me_night_copilot += flight.night_sic || 0;
        totals.me_night_cmnd += flight.night_cmnd_practice || 0;
      }

      // Instrument hours (all flights)
      totals.instrument_actual += flight.instrument_hours || 0;
      totals.instrument_simulated += flight.simulated_instrument_hours || 0;
      totals.instrument_ground += flight.ground_instrument_hours || 0;

      // Category totals
      if (flight.aircraft_category === 'Helicopter') {
        totals.helicopter_total += flight.flight_time_hours || 0;
      }
      if (flight.aircraft_category === 'Aeroplane') {
        totals.aeroplane_total += flight.flight_time_hours || 0;
      }
      if (flight.aircraft_category === 'Simulator') {
        totals.simulator_total += flight.flight_time_hours || 0;
      }

      // Grand total = helicopter + aeroplane (excludes simulator)
      if (flight.aircraft_category !== 'Simulator') {
        totals.grand_total += flight.flight_time_hours || 0;
      }

      // Custom fields
      this.customFields.forEach(cf => {
        const value = flight.customFieldValues?.[cf.id] || 0;
        totals[`custom_${cf.id}`] += value;
      });
    });

    return totals;
  }

  /**
   * Draw Page A - Flight Details
   */
  drawPageA(doc, flights, year, pageNum, totalPages, broughtForward) {
    const contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    let y = this.marginTop;

    // Year header
    doc.fontSize(13).font('Helvetica-Bold');
    doc.text('Year', this.marginLeft, y);
    y += 15;
    doc.fontSize(15);
    doc.text(year, this.marginLeft, y);

    // Main column headers (positioned closer to sub-headers)
    const mainHeaderY = this.marginTop + 20;
    doc.fontSize(11).font('Helvetica-Bold');

    // Center 'Aircraft' over Type + Reg'n columns
    const aircraftStartX = this.marginLeft + this.pageAColumns.date;
    const aircraftWidth = this.pageAColumns.type + this.pageAColumns.registration;
    doc.text('Aircraft', aircraftStartX, mainHeaderY, { width: aircraftWidth, align: 'center' });

    // Calculate centered positions for headers over their columns
    const picStartX = this.marginLeft + this.pageAColumns.date + this.pageAColumns.type + this.pageAColumns.registration;
    const copilotStartX = picStartX + this.pageAColumns.pic;
    const detailsStartX = copilotStartX + this.pageAColumns.copilot;

    doc.text('Pilot in Command', picStartX, mainHeaderY, { width: this.pageAColumns.pic, align: 'center' });
    doc.text('Co-pilot or Student', copilotStartX, mainHeaderY, { width: this.pageAColumns.copilot, align: 'center' });
    doc.text('Details of Flight', detailsStartX, mainHeaderY, { width: this.pageAColumns.details, align: 'center' });

    y = this.marginTop + 35;

    // Column headers
    doc.font('Helvetica-Bold').fontSize(9);
    let x = this.marginLeft;

    doc.text('Date', x + 2, y, { width: this.pageAColumns.date - 4, align: 'left' });
    x += this.pageAColumns.date;
    doc.text('Type', x + 2, y, { width: this.pageAColumns.type - 4, align: 'left' });
    x += this.pageAColumns.type;
    doc.text("Reg'n", x + 2, y, { width: this.pageAColumns.registration - 4, align: 'left' });
    x += this.pageAColumns.registration;
    // PIC and Copilot headers already shown above
    x += this.pageAColumns.pic + this.pageAColumns.copilot + this.pageAColumns.details;

    y += 15;

    // Calculate table boundaries
    const tableStartY = y;
    const dataStartY = y + 5 + this.rowHeight; // After header line and "Totals brought forward" row
    const tableEndX = this.marginLeft + contentWidth;

    // Calculate column X positions for vertical lines
    const colPositions = [
      this.marginLeft,
      this.marginLeft + this.pageAColumns.date,
      this.marginLeft + this.pageAColumns.date + this.pageAColumns.type,
      this.marginLeft + this.pageAColumns.date + this.pageAColumns.type + this.pageAColumns.registration,
      this.marginLeft + this.pageAColumns.date + this.pageAColumns.type + this.pageAColumns.registration + this.pageAColumns.pic,
      this.marginLeft + this.pageAColumns.date + this.pageAColumns.type + this.pageAColumns.registration + this.pageAColumns.pic + this.pageAColumns.copilot,
      tableEndX
    ];

    // Draw header line
    doc.lineWidth(1);
    doc.moveTo(this.marginLeft, y).lineTo(tableEndX, y).stroke();
    y += 5;

    // Totals brought forward row
    doc.font('Helvetica-Oblique').fontSize(9);
    doc.text('Totals brought forward', this.marginLeft + contentWidth - 200, y, { align: 'right', width: 200 });
    y += this.rowHeight;

    // Draw separator line after "Totals brought forward"
    doc.lineWidth(0.5);
    doc.moveTo(this.marginLeft, y - 3).lineTo(tableEndX, y - 3).stroke();

    // Calculate the end Y position for the grid (fixed 24 rows)
    const gridEndY = y + (this.rowsPerSpread * this.rowHeight);

    // Draw alternating row shading (before drawing grid lines)
    for (let i = 0; i < this.rowsPerSpread; i++) {
      if (i % 2 === 1) {  // Shade odd-indexed rows (2nd, 4th, 6th...)
        const rowY = y + (i * this.rowHeight) - 3;
        doc.rect(this.marginLeft, rowY, contentWidth, this.rowHeight)
           .fill('#f0f0f0');  // Light gray
      }
    }
    doc.fillColor('black');  // Reset fill color for text

    // Draw all 24 horizontal row lines first (creates the fixed grid)
    doc.lineWidth(0.5);
    for (let i = 0; i <= this.rowsPerSpread; i++) {
      const rowY = y + (i * this.rowHeight) - 3;
      doc.moveTo(this.marginLeft, rowY).lineTo(tableEndX, rowY).stroke();
    }

    // Draw vertical column separator lines
    // Lines for PIC, Co-pilot, and Details columns extend up to main header row
    const headerRowY = this.marginTop + 15;  // Just below the main header text
    colPositions.forEach((xPos, index) => {
      // Columns 0-2 (Date, Type, Reg'n) start at tableStartY (under "Aircraft")
      // Columns 3-6 (after Reg'n, PIC, Copilot, Details end) extend to header row
      const startY = (index >= 3) ? headerRowY : tableStartY;
      doc.moveTo(xPos, startY).lineTo(xPos, gridEndY - 3).stroke();
    });

    // Fill in flight data (only for rows that have flights)
    doc.font('Helvetica').fontSize(9);
    const textVerticalOffset = 4;  // Center text vertically in row
    flights.forEach((flight, index) => {
      const rowY = y + (index * this.rowHeight);
      const textY = rowY + textVerticalOffset;
      x = this.marginLeft;

      // Date (format: MMM-DD)
      const dateStr = this.formatDate(flight.date);
      doc.text(dateStr, x + 2, textY, { width: this.pageAColumns.date - 4, align: 'left' });
      x += this.pageAColumns.date;

      // Aircraft Type
      doc.text(flight.aircraft_type || '', x + 2, textY, { width: this.pageAColumns.type - 4, align: 'left' });
      x += this.pageAColumns.type;

      // Registration
      doc.text(flight.registration || '', x + 2, textY, { width: this.pageAColumns.registration - 4, align: 'left' });
      x += this.pageAColumns.registration;

      // PIC
      doc.text(flight.pilot_in_command || '', x + 2, textY, { width: this.pageAColumns.pic - 4, align: 'left' });
      x += this.pageAColumns.pic;

      // Co-pilot
      doc.text(flight.copilot_student || '', x + 2, textY, { width: this.pageAColumns.copilot - 4, align: 'left' });
      x += this.pageAColumns.copilot;

      // Details (truncate if too long)
      const details = this.truncateText(flight.flight_details || '', 60);
      doc.text(details, x + 2, textY, { width: this.pageAColumns.details - 4, align: 'left' });
    });

    // Move Y to after the grid
    y = gridEndY;

    // Draw final separator before totals (thicker line)
    y += 2;
    doc.lineWidth(1);
    doc.moveTo(this.marginLeft, y).lineTo(tableEndX, y).stroke();
    y += 10;

    // Footer totals
    doc.font('Helvetica').fontSize(10);
    doc.text('Total flight experience:', this.marginLeft, y, { lineBreak: false });

    // Calculate page totals
    const cumulativeTotals = this.calculateTotals(flights, broughtForward);

    // Category totals
    const totalsX = this.marginLeft + 200;

    // Aeroplane total
    doc.text('Aeroplane', totalsX, y, { lineBreak: false });
    doc.font('Helvetica-Bold');
    doc.text(this.formatHours(cumulativeTotals.aeroplane_total), totalsX + 70, y, { lineBreak: false });

    // Helicopter total
    y += 12;
    doc.font('Helvetica').fontSize(10);
    doc.text('Helicopter', totalsX, y, { lineBreak: false });
    doc.font('Helvetica-Bold');
    doc.text(this.formatHours(cumulativeTotals.helicopter_total), totalsX + 70, y, { lineBreak: false });

    // Simulator total (not included in grand total)
    y += 12;
    doc.font('Helvetica').fontSize(10);
    doc.text('Simulator (not in total)', totalsX, y, { lineBreak: false });
    doc.font('Helvetica-Bold');
    doc.text(this.formatHours(cumulativeTotals.simulator_total), totalsX + 120, y, { lineBreak: false });

    // Grand Total (Helicopter + Aeroplane, NOT simulator)
    y += 12;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('Grand Total', totalsX, y, { lineBreak: false });
    doc.text(this.formatHours(cumulativeTotals.grand_total), totalsX + 70, y, { lineBreak: false });

    // Right side - certification and signature
    const certX = totalsX + 180;
    doc.font('Helvetica').fontSize(9);
    doc.text('Entries certified correct', certX, y - 36, { lineBreak: false });

    // Signature line with more space
    y += 8;
    doc.text('Signature ______________________', certX, y - 24, { lineBreak: false });
    doc.text('Date ________________', certX + 220, y - 24, { lineBreak: false });

    // Page number
    y = this.pageHeight - this.marginBottom;
    doc.fontSize(9);
    doc.text(`Page ${pageNum}a of ${totalPages}`, this.pageWidth - this.marginRight - 80, y, { align: 'right', lineBreak: false });
  }

  /**
   * Draw Page B - Hours Breakdown
   */
  drawPageB(doc, flights, pageNum, totalPages, broughtForward) {
    const contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    let y = this.marginTop;

    // Calculate column positions
    const numFixedCols = 15;
    const numCustomCols = this.customFields.length;
    const totalCols = numFixedCols + numCustomCols;
    const colWidth = Math.min(this.pageBColumnWidth, contentWidth / totalCols);
    const tableEndX = this.marginLeft + (colWidth * totalCols);

    // Header row 1 - Section headers
    doc.font('Helvetica-Bold').fontSize(9);
    let x = this.marginLeft;

    // SINGLE-ENGINE header (cols 1-4)
    doc.text('SINGLE-ENGINE', x, y, { width: colWidth * 4, align: 'center' });
    x += colWidth * 4;

    // MULTI-ENGINE header (cols 5-12)
    doc.text('MULTI-ENGINE', x, y, { width: colWidth * 8, align: 'center' });
    x += colWidth * 8;

    // INSTRUMENT header (cols 13-15)
    doc.text('INSTRUMENT', x, y, { width: colWidth * 3, align: 'center' });
    x += colWidth * 3;

    // OTHER header (custom fields)
    if (numCustomCols > 0) {
      doc.text('OTHER', x, y, { width: colWidth * numCustomCols, align: 'center' });
    }

    y += 12;

    // Header row 2 - Day/Night subheaders
    x = this.marginLeft;
    doc.fontSize(8);

    // Single-engine: Day | Night
    doc.text('DAY', x, y, { width: colWidth * 2, align: 'center' });
    x += colWidth * 2;
    doc.text('NIGHT', x, y, { width: colWidth * 2, align: 'center' });
    x += colWidth * 2;

    // Multi-engine: Day | Night
    doc.text('DAY', x, y, { width: colWidth * 4, align: 'center' });
    x += colWidth * 4;
    doc.text('NIGHT', x, y, { width: colWidth * 4, align: 'center' });
    x += colWidth * 4;

    // Instrument: FLIGHT
    doc.text('FLIGHT', x, y, { width: colWidth * 3, align: 'center' });
    x += colWidth * 3;

    y += 12;

    // Header row 3 - Column labels
    x = this.marginLeft;
    doc.fontSize(7);

    // Single-engine columns
    doc.text('DUAL', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('PIC', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('DUAL', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('PIC', x, y, { width: colWidth, align: 'center' });
    x += colWidth;

    // Multi-engine day columns
    doc.text('DUAL', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('PIC', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('CO-PILOT', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text("COMM'D\nPRACTICE", x, y - 3, { width: colWidth, align: 'center' });
    x += colWidth;

    // Multi-engine night columns
    doc.text('DUAL', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('PIC', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('CO-PILOT', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text("COMM'D\nPRACTICE", x, y - 3, { width: colWidth, align: 'center' });
    x += colWidth;

    // Instrument columns
    doc.text('ACTUAL', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('SIMULATED', x, y, { width: colWidth, align: 'center' });
    x += colWidth;
    doc.text('GROUND', x, y, { width: colWidth, align: 'center' });
    x += colWidth;

    // Custom field columns
    this.customFields.forEach(cf => {
      doc.text(cf.field_label.toUpperCase(), x, y, { width: colWidth, align: 'center' });
      x += colWidth;
    });

    y += 15;

    // Column numbers row
    x = this.marginLeft;
    doc.font('Helvetica').fontSize(8);
    for (let i = 1; i <= totalCols; i++) {
      doc.text(String(i), x, y, { width: colWidth, align: 'center' });
      x += colWidth;
    }

    y += 12;

    // Draw header separator
    const tableStartY = y;
    doc.lineWidth(1);
    doc.moveTo(this.marginLeft, y).lineTo(tableEndX, y).stroke();
    y += 3;

    // Totals brought forward row
    const bfRowY = y;
    const bfTextVerticalOffset = 4;  // Center text vertically in row
    doc.font('Helvetica').fontSize(8);
    x = this.marginLeft;

    // Display brought forward values
    const bf = broughtForward;
    const bfValues = [
      bf.se_day_dual, bf.se_day_pic, bf.se_night_dual, bf.se_night_pic,
      bf.me_day_dual, bf.me_day_pic, bf.me_day_copilot, bf.me_day_cmnd,
      bf.me_night_dual, bf.me_night_pic, bf.me_night_copilot, bf.me_night_cmnd,
      bf.instrument_actual, bf.instrument_simulated, bf.instrument_ground
    ];

    // Add custom field brought forward values
    this.customFields.forEach(cf => {
      bfValues.push(bf[`custom_${cf.id}`] || 0);
    });

    bfValues.forEach(val => {
      doc.text(this.formatHoursCell(val), x, y + bfTextVerticalOffset, { width: colWidth, align: 'center' });
      x += colWidth;
    });

    y += this.rowHeight;

    // Calculate the data start position (after brought forward row)
    const dataStartY = y;

    // Calculate the end Y position for the grid (fixed 24 rows)
    const gridEndY = dataStartY + (this.rowsPerSpread * this.rowHeight);

    // Draw alternating row shading (before drawing grid lines)
    const gridWidth = colWidth * totalCols;
    for (let i = 0; i < this.rowsPerSpread; i++) {
      if (i % 2 === 1) {  // Shade odd-indexed rows (2nd, 4th, 6th...)
        const rowY = dataStartY + (i * this.rowHeight) - 3;
        doc.rect(this.marginLeft, rowY, gridWidth, this.rowHeight)
           .fill('#f0f0f0');  // Light gray
      }
    }
    doc.fillColor('black');  // Reset fill color for text

    // Draw all 24 horizontal row lines first (creates the fixed grid)
    doc.lineWidth(0.5);
    for (let i = 0; i <= this.rowsPerSpread; i++) {
      const rowY = dataStartY + (i * this.rowHeight) - 3;
      doc.moveTo(this.marginLeft, rowY).lineTo(tableEndX, rowY).stroke();
    }

    // Draw vertical column separator lines (extending up to header sections)
    // Y positions for different header levels
    const headerRow1Y = this.marginTop;           // SINGLE-ENGINE, MULTI-ENGINE, etc.
    const headerRow2Y = this.marginTop + 12;      // DAY, NIGHT subheaders
    const headerRow3Y = this.marginTop + 24;      // DUAL, PIC, etc. column labels

    for (let i = 0; i <= totalCols; i++) {
      const xPos = this.marginLeft + (i * colWidth);

      // Determine how high this vertical line should extend based on column position
      let startY;
      if (i === 0 || i === 4 || i === 12 || i === 15 || i === totalCols) {
        // Major section dividers (left edge, after SE, after ME, after Instrument, right edge)
        startY = headerRow1Y + 10;  // Just below section header text
      } else if (i === 2 || i === 8) {
        // Day/Night sub-section dividers (within SE: col 2, within ME: col 8)
        startY = headerRow2Y + 10;  // Just below Day/Night subheaders
      } else {
        // Individual column dividers
        startY = headerRow3Y + 10;  // Just below column labels
      }

      doc.moveTo(xPos, startY).lineTo(xPos, gridEndY - 3).stroke();
    }

    // Fill in flight data (only for rows that have flights)
    doc.font('Helvetica').fontSize(8);
    const textVerticalOffset = 4;  // Center text vertically in row
    flights.forEach((flight, index) => {
      const rowY = dataStartY + (index * this.rowHeight);
      const textY = rowY + textVerticalOffset;
      x = this.marginLeft;
      const isSingleEngine = flight.engine_type === 'Single Engine';
      const isMultiEngine = flight.engine_type === 'Multi Engine';

      // Single-engine columns (1-4)
      doc.text(isSingleEngine ? this.formatHoursCell(flight.day_dual) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isSingleEngine ? this.formatHoursCell(flight.day_pic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isSingleEngine ? this.formatHoursCell(flight.night_dual) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isSingleEngine ? this.formatHoursCell(flight.night_pic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;

      // Multi-engine day columns (5-8)
      doc.text(isMultiEngine ? this.formatHoursCell(flight.day_dual) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.day_pic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.day_sic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.day_cmnd_practice) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;

      // Multi-engine night columns (9-12)
      doc.text(isMultiEngine ? this.formatHoursCell(flight.night_dual) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.night_pic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.night_sic) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(isMultiEngine ? this.formatHoursCell(flight.night_cmnd_practice) : '', x, textY, { width: colWidth, align: 'center' });
      x += colWidth;

      // Instrument columns (13-15)
      doc.text(this.formatHoursCell(flight.instrument_hours), x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(this.formatHoursCell(flight.simulated_instrument_hours), x, textY, { width: colWidth, align: 'center' });
      x += colWidth;
      doc.text(this.formatHoursCell(flight.ground_instrument_hours), x, textY, { width: colWidth, align: 'center' });
      x += colWidth;

      // Custom field columns (16+)
      this.customFields.forEach(cf => {
        const value = flight.customFieldValues?.[cf.id] || 0;
        doc.text(this.formatHoursCell(value), x, textY, { width: colWidth, align: 'center' });
        x += colWidth;
      });
    });

    // Move Y to after the grid
    y = gridEndY;

    // Column totals row (thicker separator line)
    y += 2;
    doc.lineWidth(1);
    doc.moveTo(this.marginLeft, y).lineTo(tableEndX, y).stroke();
    y += 5;

    // Calculate cumulative totals
    const cumulativeTotals = this.calculateTotals(flights, broughtForward);

    x = this.marginLeft;
    doc.font('Helvetica-Bold').fontSize(7);

    const totalValues = [
      cumulativeTotals.se_day_dual, cumulativeTotals.se_day_pic,
      cumulativeTotals.se_night_dual, cumulativeTotals.se_night_pic,
      cumulativeTotals.me_day_dual, cumulativeTotals.me_day_pic,
      cumulativeTotals.me_day_copilot, cumulativeTotals.me_day_cmnd,
      cumulativeTotals.me_night_dual, cumulativeTotals.me_night_pic,
      cumulativeTotals.me_night_copilot, cumulativeTotals.me_night_cmnd,
      cumulativeTotals.instrument_actual, cumulativeTotals.instrument_simulated,
      cumulativeTotals.instrument_ground
    ];

    // Add custom field totals
    this.customFields.forEach(cf => {
      totalValues.push(cumulativeTotals[`custom_${cf.id}`] || 0);
    });

    totalValues.forEach(val => {
      doc.text(this.formatHoursCell(val), x, y, { width: colWidth, align: 'center', lineBreak: false });
      x += colWidth;
    });

    y += 12;

    // Column numbers at bottom
    x = this.marginLeft;
    doc.font('Helvetica').fontSize(7);
    for (let i = 1; i <= totalCols; i++) {
      doc.text(String(i), x, y, { width: colWidth, align: 'center', lineBreak: false });
      x += colWidth;
    }

    // Page number
    y = this.pageHeight - this.marginBottom;
    doc.fontSize(9);
    doc.text(`Page ${pageNum}b of ${totalPages}`, this.pageWidth - this.marginRight - 80, y, { align: 'right', lineBreak: false });
  }

  /**
   * Format date as MMM-DD
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month, day] = dateString.split('-');
    return `${months[parseInt(month) - 1]}-${day}`;
  }

  /**
   * Get year from date string
   */
  getYear(dateString) {
    if (!dateString) return '';
    return dateString.split('-')[0];
  }

  /**
   * Format hours for display (e.g., "1.5" or empty for 0)
   */
  formatHours(hours) {
    if (!hours || hours === 0) return '0.0';
    return hours.toFixed(1);
  }

  /**
   * Format hours for cell display (empty string for 0)
   */
  formatHoursCell(hours) {
    if (!hours || hours === 0) return '';
    return hours.toFixed(1);
  }

  /**
   * Truncate text to max length with ellipsis
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

module.exports = LogbookPDFGenerator;

/**
 * PDF Report Generator for Qwatt LED Configurator
 * Generates professional channel letter reports with LED layout visualization
 */

import { jsPDF } from 'jspdf';
import type { TextBlock, BlockCharPaths, CharLEDData } from '../data/store';
import type { LEDModule } from '../data/catalog/modules';
import type { PowerSupply } from '../data/catalog/powerSupplies';
import { drawTechnicalLayout } from './technicalDrawing';

// Qwatt brand colors
const COLORS = {
  darkBlue: '#1a365d',
  lightBlue: '#22d3ee',
  mediumBlue: '#3b82f6',
  gray: '#64748b',
  lightGray: '#94a3b8',
  black: '#0f172a',
};

interface ReportData {
  blocks: TextBlock[];
  totalModules: number;
  totalPowerWatts: number;
  depthInches: number;
  currentModule: LEDModule;
  recommendedPSU: PowerSupply | null;
  blockCharPaths?: BlockCharPaths[];
  charLeds?: CharLEDData[];
}

/**
 * Draw the Qwatt logo header
 */
function drawHeader(doc: jsPDF, pageWidth: number): number {
  const marginLeft = 15;

  // Draw "Qwatt" text logo
  doc.setFontSize(28);
  doc.setTextColor(COLORS.darkBlue);
  doc.setFont('helvetica', 'bold');
  doc.text('Qwatt', marginLeft, 18);

  // TM superscript
  doc.setFontSize(8);
  doc.text('TM', marginLeft + 38, 12);

  // Tagline
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(COLORS.mediumBlue);
  doc.text('A New Era of Innovation', marginLeft, 24);

  // Tech Support info (center)
  const centerX = pageWidth / 2;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.darkBlue);
  doc.text('Tech Support', centerX, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray);
  doc.text('+91-7907835933', centerX, 20, { align: 'center' });
  doc.text('info@qwatt.co', centerX, 25, { align: 'center' });

  // Date (right aligned)
  const rightX = pageWidth - 15;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.setFontSize(9);
  doc.setTextColor(COLORS.gray);
  doc.text(dateStr, rightX, 18, { align: 'right' });

  // Horizontal line
  doc.setDrawColor(COLORS.lightGray);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 30, pageWidth - 15, 30);

  return 35; // Return Y position after header
}

/**
 * Draw specifications row at the bottom
 */
function drawSpecsFooter(doc: jsPDF, data: ReportData, startY: number, pageWidth: number): void {
  const marginLeft = 15;
  const colWidth = (pageWidth - 30) / 7;

  // Draw light background
  doc.setFillColor('#f8fafc');
  doc.rect(marginLeft, startY - 5, pageWidth - 30, 35, 'F');

  // Draw border
  doc.setDrawColor(COLORS.lightGray);
  doc.setLineWidth(0.2);
  doc.rect(marginLeft, startY - 5, pageWidth - 30, 35, 'S');

  const specs = [
    { label: 'Illumination', value: 'Face Lit' },
    { label: 'Depth', value: `${data.depthInches.toFixed(1)} in` },
    { label: 'Power Supply', value: data.recommendedPSU?.name || '-' },
    { label: 'Module', value: data.currentModule.name.replace('Tetra MAX ', '') },
    { label: 'CCT', value: data.currentModule.colorTemperature },
    { label: 'Total Modules', value: `${data.totalModules}` },
    { label: 'Total Watts', value: `${data.totalPowerWatts.toFixed(1)} W` },
  ];

  specs.forEach((spec, i) => {
    const x = marginLeft + 5 + i * colWidth;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.gray);
    doc.text(spec.label, x, startY + 3);

    // Value
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.black);
    doc.text(spec.value, x, startY + 10);
  });

  // Second row of specs
  const specs2 = [
    {
      label: 'Height',
      value: data.blocks[0] ? `${(data.blocks[0].fontSize / 12.5).toFixed(1)} in` : '-',
    },
    { label: 'Voltage', value: `${data.currentModule.voltage}V` },
    { label: 'Watts/Module', value: `${data.currentModule.wattsPerModule} W` },
    { label: 'Lumens/Module', value: `${data.currentModule.lumensPerModule}` },
    {
      label: 'Spacing',
      value: `${(12 / data.currentModule.installation.modulesPerFoot).toFixed(1)} in`,
    },
    { label: 'Letter Count', value: `${data.blocks.length}` },
    {
      label: 'Text',
      value: data.blocks
        .map((b) => b.text)
        .join(', ')
        .substring(0, 15),
    },
  ];

  specs2.forEach((spec, i) => {
    const x = marginLeft + 5 + i * colWidth;

    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.gray);
    doc.text(spec.label, x, startY + 18);

    // Value
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.black);
    doc.text(spec.value, x, startY + 25);
  });
}

/**
 * Draw disclaimer text
 */
function drawDisclaimer(doc: jsPDF, y: number, pageWidth: number): void {
  const marginLeft = 15;

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.gray);

  const disclaimer = `THE GRAPHICS ABOVE ARE FOR REFERENCE ONLY and should not be used for commercial quotation or bid without validation. LED MODULE PLACEMENT AND QUANTITY IS AN APPROXIMATION ONLY. The sign manufacturer must verify module placement and quantity to ensure even illumination. All signs should be tested as complete units before installation.`;

  const lines = doc.splitTextToSize(disclaimer, pageWidth - 30);
  doc.text(lines, marginLeft, y);
}

/**
 * Generate PDF report - Single page with LED layout
 */
export async function generatePDFReport(data: ReportData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter', // 279.4 x 215.9 mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Draw header
  const contentStartY = drawHeader(doc, pageWidth);

  // Calculate available space for drawing
  const maxDrawWidth = pageWidth - 30;
  const maxDrawHeight = pageHeight - contentStartY - 55; // Leave room for specs and disclaimer

  // Draw technical layout if we have layout data
  if (data.blockCharPaths && data.charLeds && data.blockCharPaths.length > 0) {
    drawTechnicalLayout(
      doc,
      {
        blockCharPaths: data.blockCharPaths,
        charLeds: data.charLeds,
        blocks: data.blocks,
      },
      {
        x: 15,
        y: contentStartY,
        maxWidth: maxDrawWidth,
        maxHeight: maxDrawHeight,
      }
    );

    // Draw specs footer below the drawing area
    const specsY = contentStartY + maxDrawHeight + 5;
    drawSpecsFooter(doc, data, specsY, pageWidth);

    // Draw disclaimer
    drawDisclaimer(doc, specsY + 38, pageWidth);
  } else {
    // No layout data - show message
    doc.setFontSize(14);
    doc.setTextColor(COLORS.gray);
    doc.text(
      'No LED layout generated. Click "POPULATE LEDs" first.',
      pageWidth / 2,
      pageHeight / 2,
      { align: 'center' }
    );
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(COLORS.lightGray);
  doc.text('Generated by Qwatt LED Configurator', pageWidth / 2, pageHeight - 8, {
    align: 'center',
  });

  // Generate filename with timestamp
  const timestamp = new Date()
    .toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(/[/:]/g, '-')
    .replace(', ', ' ');

  const textContent =
    data.blocks
      .map((b) => b.text)
      .join('_')
      .substring(0, 20) || 'Layout';
  const filename = `Channel Letter ${textContent} ${timestamp}.pdf`;

  // Save the PDF
  doc.save(filename);
}

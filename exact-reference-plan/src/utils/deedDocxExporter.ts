import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { capturePlan } from './capturePlan';
import { PlanDocument } from '../types';
import { generateLegalDescription, formatDimensionDisplay } from './dimensionUtils';

/**
 * Exports a complete Word 2007 deed document (.docx)
 * with structured legal description, boundary schedule, executant/claimant details,
 * and high-resolution sketch drawing.
 */
export async function downloadWord2007DeedDocx(doc: PlanDocument, elementToCapture?: HTMLElement | null): Promise<void> {
  const { title, propertyDescription, executantText, claimantText } = generateLegalDescription(doc);
  const b = doc.boundaries;
  const p = doc.property;

  let imgBytes: Uint8Array | null = null;
  let canvasWidth = 750;
  let canvasHeight = 500;

  if (elementToCapture) {
    try {
      const canvas = await capturePlan(elementToCapture);
      const imgData = canvas.toDataURL('image/png').split(',')[1];
      imgBytes = Uint8Array.from(atob(imgData), (c) => c.charCodeAt(0));
      canvasWidth = 720;
      canvasHeight = (canvas.height * 720) / canvas.width;
    } catch (err) {
      console.warn('Could not capture sketch image for Word document:', err);
    }
  }

  const borderNone = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const borderThin = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '333333' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '333333' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '333333' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '333333' },
  };

  // Create Boundary Schedule Table
  const boundaryRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          borders: borderThin,
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'DIRECTION', bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          borders: borderThin,
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'BOUNDED BY (హద్దులు)', bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          borders: borderThin,
          width: { size: 30, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'MEASUREMENT (కొలత)', bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'NORTH (ఉత్తరం)', bold: true, size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: b.northBoundary || 'Land of Others', size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: formatDimensionDisplay(b.northDim), bold: true, size: 19 })] })] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'SOUTH (దక్షిణం)', bold: true, size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: b.southBoundary || 'Road', size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: formatDimensionDisplay(b.southDim), bold: true, size: 19 })] })] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'EAST (తూర్పు)', bold: true, size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: b.eastBoundary || 'Neighbour Plot', size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: formatDimensionDisplay(b.eastDim), bold: true, size: 19 })] })] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: 'WEST (పడమర)', bold: true, size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: b.westBoundary || 'Neighbour Plot', size: 19 })] })] }),
        new TableCell({ borders: borderThin, children: [new Paragraph({ children: [new TextRun({ text: formatDimensionDisplay(b.westDim), bold: true, size: 19 })] })] }),
      ],
    }),
  ];

  const docChildren: any[] = [
    // Header Title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: (title || 'SCHEDULE OF PROPERTY / PLAN OF PROPERTY').toUpperCase(),
          bold: true,
          size: 26,
          underline: {},
        }),
      ],
    }),

    // Property Description
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 200, line: 280 },
      children: [
        new TextRun({
          text: propertyDescription.toUpperCase(),
          size: 21,
        }),
      ],
    }),

    // Boundaries Heading
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [
        new TextRun({
          text: 'SCHEDULE OF BOUNDARIES & MEASUREMENTS:',
          bold: true,
          size: 22,
        }),
      ],
    }),

    new Table({
      rows: boundaryRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),

    // Executants
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: 'EXECUTANT/S (SELLER/S):',
          bold: true,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: executantText.toUpperCase(),
          size: 20,
        }),
      ],
    }),

    // Claimants
    new Paragraph({
      spacing: { before: 100, after: 80 },
      children: [
        new TextRun({
          text: 'CLAIMANT/S (PURCHASER/S):',
          bold: true,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: claimantText.toUpperCase(),
          size: 20,
        }),
      ],
    }),
  ];

  // If image was captured, embed high-res plan
  if (imgBytes) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: 'PLAN / SKETCH DRAWING (నక్షా)',
            bold: true,
            size: 22,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [
          new ImageRun({
            data: imgBytes,
            type: 'png',
            transformation: {
              width: Math.min(680, canvasWidth),
              height: Math.min(750, canvasHeight),
            },
          }),
        ],
      })
    );
  }

  // Signature Block
  docChildren.push(
    new Paragraph({
      spacing: { before: 300, after: 200 },
      children: [
        new TextRun({
          text: 'SIGNATURES OF PARTIES:',
          bold: true,
          size: 21,
        }),
      ],
    }),
    new Table({
      borders: borderNone,
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: borderNone,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 400 },
                  children: [new TextRun({ text: '__________________________\nEXECUTANT/S SIGNATURE(S)', bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              borders: borderNone,
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { before: 400 },
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: '__________________________\nCLAIMANT/S SIGNATURE(S)', bold: true, size: 20 })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const docxDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const rawSurvey = p.surveyNo || p.plotNo || 'Doc';
  const cleanSurvey = rawSurvey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Deed_${cleanSurvey}_${(p.village || 'Registration').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

  const blob = await Packer.toBlob(docxDoc);
  saveAs(blob, fileName);
}
